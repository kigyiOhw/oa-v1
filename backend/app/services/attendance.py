import json
import logging
from datetime import UTC, datetime, time, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.attendance import AttendanceRecord
from app.models.leave_request import LeaveRequest
from app.models.user import User
from app.repositories.attendance import AttendanceRepository
from app.repositories.leave_request import LeaveRequestRepository
from app.repositories.setting import SettingRepository
from app.repositories.user import UserRepository
from app.schemas.attendance import AttendanceConfigSchema, MonthlySummary

logger = logging.getLogger(__name__)

ATTENDANCE_CONFIG_KEY = "attendance_config"

DEFAULT_CONFIG: dict = {
    "work_start_time": "09:00",
    "work_end_time": "18:00",
    "late_tolerance_minutes": 0,
    "enable_mandatory_check_in": False,
}


class AttendanceService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = AttendanceRepository(session)
        self.user_repo = UserRepository(session)
        self.setting_repo = SettingRepository(session)
        self.leave_repo = LeaveRequestRepository(session)

    async def _get_config(self) -> dict:
        setting = await self.setting_repo.get(ATTENDANCE_CONFIG_KEY)
        if setting and setting.value:
            try:
                return {**DEFAULT_CONFIG, **json.loads(setting.value)}
            except (json.JSONDecodeError, TypeError):
                return dict(DEFAULT_CONFIG)
        return dict(DEFAULT_CONFIG)

    @staticmethod
    def _parse_time(time_str: str) -> time:
        return datetime.strptime(time_str, "%H:%M").time()

    def _determine_check_in_status(self, check_in_dt: datetime, config: dict) -> str:
        work_start = self._parse_time(config["work_start_time"])
        tolerance = timedelta(minutes=config.get("late_tolerance_minutes", 0))
        deadline = datetime.combine(check_in_dt.date(), work_start, tzinfo=check_in_dt.tzinfo) + tolerance
        if check_in_dt <= deadline:
            return "normal"
        return "late"

    def _determine_check_out_status(self, check_out_dt: datetime, config: dict) -> str:
        work_end = self._parse_time(config["work_end_time"])
        end_boundary = datetime.combine(check_out_dt.date(), work_end, tzinfo=check_out_dt.tzinfo)
        if check_out_dt >= end_boundary:
            return "normal"
        return "early"

    async def check_in(self, user: User) -> AttendanceRecord:
        logger.info("----------AttendanceService.check_in, start, user_id=%s", user.id)
        config = await self._get_config()
        now = datetime.now(UTC)
        today = now.date()

        existing = await self.repo.get_by_user_and_date(user.id, today)

        if existing and existing.check_in_time is not None and existing.check_out_time is not None:
            logger.warning("----------AttendanceService.check_in, already_completed, user_id=%s", user.id)
            raise OAException("Already checked in and out for today", status_code=400)

        if existing:
            existing.check_in_time = now
            status = self._determine_check_in_status(now, config)
            if existing.source != "leave_sync":
                existing.status = status
            result = await self.repo.update(existing)
            logger.info("----------AttendanceService.check_in, updated, user_id=%s, record_id=%s, status=%s",
                        user.id, result.id, result.status)
            return result

        status = self._determine_check_in_status(now, config)
        record = AttendanceRecord(
            user_id=user.id,
            record_date=today,
            check_in_time=now,
            status=status,
            source="check_in",
        )
        result = await self.repo.create(record)
        logger.info("----------AttendanceService.check_in, created, user_id=%s, record_id=%s, status=%s",
                    user.id, result.id, result.status)
        return result

    async def check_out(self, user: User) -> AttendanceRecord:
        logger.info("----------AttendanceService.check_out, start, user_id=%s", user.id)
        config = await self._get_config()
        now = datetime.now(UTC)
        today = now.date()

        existing = await self.repo.get_by_user_and_date(user.id, today)
        if not existing or existing.check_in_time is None:
            logger.warning("----------AttendanceService.check_out, no_check_in, user_id=%s", user.id)
            raise OAException("Must check in before checking out", status_code=400)

        if existing.check_out_time is not None:
            logger.warning("----------AttendanceService.check_out, already_checked_out, user_id=%s", user.id)
            raise OAException("Already checked out for today", status_code=400)

        existing.check_out_time = now
        if existing.source != "leave_sync":
            existing.status = self._determine_check_out_status(now, config)
        result = await self.repo.update(existing)
        logger.info("----------AttendanceService.check_out, done, user_id=%s, record_id=%s, status=%s",
                    user.id, result.id, result.status)
        return result

    async def get_my_records(
        self, user: User, year: int, month: int, page: int, page_size: int
    ) -> tuple[list[AttendanceRecord], int]:
        logger.info("----------AttendanceService.get_my_records, user_id=%s, year=%s, month=%s",
                    user.id, year, month)
        return await self.repo.get_by_user_monthly(user.id, year, month, page, page_size)

    async def get_my_summary(self, user: User, year: int, month: int) -> MonthlySummary:
        logger.info("----------AttendanceService.get_my_summary, user_id=%s, year=%s, month=%s",
                    user.id, year, month)
        counts = await self.repo.get_monthly_status_counts(user.id, year, month)
        total = await self.repo.get_total_days_in_month(user.id, year, month)
        return MonthlySummary(
            year=year,
            month=month,
            total_days=total,
            normal_days=counts.get("normal", 0),
            late_days=counts.get("late", 0),
            early_days=counts.get("early", 0),
            absent_days=counts.get("absent", 0),
            leave_days=counts.get("leave", 0),
            business_trip_days=counts.get("business_trip", 0),
        )

    async def get_team_summary(
        self, manager: User, year: int, month: int
    ) -> list[dict]:
        """Get attendance summary for all direct subordinates."""
        logger.info("----------AttendanceService.get_team_summary, manager_id=%s, year=%s, month=%s",
                    manager.id, year, month)
        subs = await self.user_repo.get_subordinates(manager.id)
        if not subs:
            return []

        sub_ids = [s.id for s in subs]
        summaries = await self.repo.get_users_monthly_summary(sub_ids, year, month)
        summaries_by_user = {s["user_id"]: s for s in summaries}

        result = []
        for sub in subs:
            counts = summaries_by_user.get(sub.id, {})
            dept_name = sub.department.name if sub.department else None
            result.append({
                "user_id": sub.id,
                "username": sub.username,
                "full_name": sub.full_name,
                "department_name": dept_name,
                "summary": MonthlySummary(
                    year=year,
                    month=month,
                    total_days=sum(counts.get(k, 0) for k in ("normal", "late", "early", "absent", "leave", "business_trip")),
                    normal_days=counts.get("normal", 0),
                    late_days=counts.get("late", 0),
                    early_days=counts.get("early", 0),
                    absent_days=counts.get("absent", 0),
                    leave_days=counts.get("leave", 0),
                    business_trip_days=counts.get("business_trip", 0),
                ),
            })
        return result

    async def get_team_member_detail(
        self, manager: User, member_id: int, year: int, month: int
    ) -> dict:
        """Get detailed view for a specific subordinate."""
        logger.info("----------AttendanceService.get_team_member_detail, manager_id=%s, member_id=%s",
                    manager.id, member_id)
        member = await self.user_repo.get_by_id_with_profile(member_id)
        if not member:
            raise OAException("User not found", status_code=404)

        if member.manager_id != manager.id:
            raise OAException("Not your subordinate", status_code=403)

        counts = await self.repo.get_monthly_status_counts(member_id, year, month)
        total = await self.repo.get_total_days_in_month(member_id, year, month)

        profile = member.employee_profile
        dept_name = member.department.name if member.department else None

        # Get recent leaves (last 5)
        leaves_result = await self.leave_repo.get_by_user(member_id, None, 1, 5)
        recent_leaves = [
            {
                "id": lv.id,
                "leave_type": lv.leave_type,
                "start_date": lv.start_date.isoformat(),
                "end_date": lv.end_date.isoformat(),
                "duration_days": float(lv.duration_days),
                "status": lv.status,
            }
            for lv in leaves_result[0]
        ]

        return {
            "user_id": member.id,
            "username": member.username,
            "full_name": member.full_name,
            "email": member.email,
            "department_name": dept_name,
            "phone": profile.phone if profile else None,
            "join_date": profile.join_date if profile else None,
            "employment_status": profile.employment_status if profile else None,
            "summary": MonthlySummary(
                year=year,
                month=month,
                total_days=total,
                normal_days=counts.get("normal", 0),
                late_days=counts.get("late", 0),
                early_days=counts.get("early", 0),
                absent_days=counts.get("absent", 0),
                leave_days=counts.get("leave", 0),
                business_trip_days=counts.get("business_trip", 0),
            ),
            "recent_leaves": recent_leaves,
        }

    async def get_team_member_records(
        self, manager: User, member_id: int, year: int, month: int, page: int, page_size: int
    ) -> tuple[list[AttendanceRecord], int]:
        logger.info("----------AttendanceService.get_team_member_records, manager_id=%s, member_id=%s",
                    manager.id, member_id)
        member = await self.user_repo.get_by_id(member_id)
        if not member:
            raise OAException("User not found", status_code=404)
        if member.manager_id != manager.id:
            raise OAException("Not your subordinate", status_code=403)
        return await self.repo.get_by_user_monthly(member_id, year, month, page, page_size)

    async def get_team_member_summary(
        self, manager: User, member_id: int, year: int, month: int
    ) -> MonthlySummary:
        logger.info("----------AttendanceService.get_team_member_summary, manager_id=%s, member_id=%s",
                    manager.id, member_id)
        member = await self.user_repo.get_by_id(member_id)
        if not member:
            raise OAException("User not found", status_code=404)
        if member.manager_id != manager.id:
            raise OAException("Not your subordinate", status_code=403)

        counts = await self.repo.get_monthly_status_counts(member_id, year, month)
        total = await self.repo.get_total_days_in_month(member_id, year, month)
        return MonthlySummary(
            year=year,
            month=month,
            total_days=total,
            normal_days=counts.get("normal", 0),
            late_days=counts.get("late", 0),
            early_days=counts.get("early", 0),
            absent_days=counts.get("absent", 0),
            leave_days=counts.get("leave", 0),
            business_trip_days=counts.get("business_trip", 0),
        )

    async def get_config(self) -> dict:
        return await self._get_config()

    async def update_config(self, data: AttendanceConfigSchema) -> dict:
        logger.info("----------AttendanceService.update_config, start")
        config_json = json.dumps(data.model_dump())
        await self.setting_repo.set(ATTENDANCE_CONFIG_KEY, config_json)
        logger.info("----------AttendanceService.update_config, done")
        return data.model_dump()

    async def sync_leave_record(
        self, leave: LeaveRequest, approved: bool
    ) -> None:
        """Create or remove attendance records for leave date range."""
        logger.info(
            "----------AttendanceService.sync_leave_record, leave_id=%s, approved=%s",
            leave.id, approved,
        )
        if not leave.start_date or not leave.end_date:
            return

        current = leave.start_date
        while current <= leave.end_date:
            existing = await self.repo.get_by_user_and_date(leave.user_id, current)
            if approved:
                if existing:
                    existing.status = "leave"
                    existing.source = "leave_sync"
                    existing.leave_request_id = leave.id
                    await self.repo.update(existing)
                else:
                    record = AttendanceRecord(
                        user_id=leave.user_id,
                        record_date=current,
                        status="leave",
                        source="leave_sync",
                        leave_request_id=leave.id,
                    )
                    await self.repo.create(record)
            else:
                if existing and existing.source == "leave_sync":
                    if existing.check_in_time is not None or existing.check_out_time is not None:
                        existing.status = "normal"
                        existing.source = "check_in"
                        existing.leave_request_id = None
                        await self.repo.update(existing)
                    else:
                        await self.repo.delete(existing)
            current += timedelta(days=1)

        logger.info("----------AttendanceService.sync_leave_record, done, leave_id=%s", leave.id)
