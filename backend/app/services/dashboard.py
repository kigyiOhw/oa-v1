import logging
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_admin_scope
from app.models.user import User
from app.repositories.asset import AssetRepository
from app.repositories.attendance import AttendanceRepository
from app.repositories.department import DepartmentRepository
from app.repositories.leave_request import LeaveRequestRepository
from app.repositories.user import UserRepository
from app.repositories.workflow_history import WorkflowHistoryRepository
from app.repositories.workflow_task import WorkflowTaskRepository
from app.schemas.dashboard import (
    AssetOverview,
    AttendanceOverview,
    DashboardStats,
    LeaveStats,
    OrgOverview,
    WorkflowStats,
)

logger = logging.getLogger(__name__)


class DashboardService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.dept_repo = DepartmentRepository(session)
        self.leave_repo = LeaveRequestRepository(session)
        self.asset_repo = AssetRepository(session)
        self.attendance_repo = AttendanceRepository(session)
        self.task_repo = WorkflowTaskRepository(session)
        self.history_repo = WorkflowHistoryRepository(session)

    async def get_stats(self, user: User) -> DashboardStats:
        logger.info("----------DashboardService.get_stats, start, user_id=%s", user.id)
        scope = get_admin_scope(user)
        now = datetime.now(UTC)
        year, month = now.year, now.month

        # --- org overview (admin only) ---
        org_overview: OrgOverview | None = None
        if scope.scope in ("global", "department"):
            dept_id = scope.dept_id if scope.scope == "department" else None
            org_overview = await self._get_org_overview(dept_id)

        # --- leave stats ---
        if scope.scope == "global":
            leave = await self._get_leave_stats(year, month, dept_id=None)
        elif scope.scope == "department":
            leave = await self._get_leave_stats(year, month, dept_id=scope.dept_id)
        else:
            leave = await self._get_leave_stats(year, month, user_id=user.id)

        # --- asset overview (admin only) ---
        asset_overview: AssetOverview | None = None
        if scope.scope in ("global", "department"):
            dept_id = scope.dept_id if scope.scope == "department" else None
            asset_overview = await self._get_asset_overview(dept_id)

        # --- workflow stats (always personal) ---
        workflow = await self._get_workflow_stats(user.id)

        # --- attendance overview (personal) ---
        attendance = await self._get_attendance_overview(user.id, year, month)

        result = DashboardStats(
            org=org_overview,
            leave=leave,
            asset=asset_overview,
            workflow=workflow,
            attendance=attendance,
        )
        logger.info("----------DashboardService.get_stats, done, user_id=%s", user.id)
        return result

    async def _get_org_overview(self, dept_id: int | None) -> OrgOverview:
        total_users = await self.user_repo.count_active()
        total_depts = await self.dept_repo.count_all()
        users_by_dept = await self.user_repo.count_by_department()

        if dept_id is not None:
            users_by_dept = [d for d in users_by_dept if d.get("dept_id") == dept_id]
            total_users = sum(d["count"] for d in users_by_dept)

        return OrgOverview(
            total_users=total_users,
            total_departments=total_depts if dept_id is None else 1,
            users_by_department=users_by_dept,
        )

    async def _get_leave_stats(
        self, year: int, month: int, *,
        user_id: int | None = None,
        dept_id: int | None = None,
    ) -> LeaveStats:
        total = await self.leave_repo.count_total_this_month(year, month, user_id=user_id, dept_id=dept_id)
        by_type = await self.leave_repo.count_by_type_this_month(year, month, user_id=user_id, dept_id=dept_id)
        by_status = await self.leave_repo.count_by_status_this_month(year, month, user_id=user_id, dept_id=dept_id)
        return LeaveStats(
            total_this_month=total,
            by_type=by_type,
            by_status=by_status,
        )

    async def _get_asset_overview(self, dept_id: int | None) -> AssetOverview:
        by_status = await self.asset_repo.count_by_status(dept_id=dept_id)
        total = sum(by_status.values())
        return AssetOverview(total=total, by_status=by_status)

    async def _get_workflow_stats(self, user_id: int) -> WorkflowStats:
        from sqlalchemy import func, select
        from app.models.workflow import WorkflowInstance

        pending = await self.task_repo.get_pending_count(user_id)

        initiated_result = await self.session.execute(
            select(func.count(WorkflowInstance.id)).where(
                WorkflowInstance.initiator_id == user_id
            )
        )
        initiated = initiated_result.scalar() or 0

        processed = await self.history_repo.count_by_operator(user_id)

        return WorkflowStats(
            pending_tasks=pending,
            initiated=initiated,
            processed=processed,
        )

    async def _get_attendance_overview(
        self, user_id: int, year: int, month: int
    ) -> AttendanceOverview:
        status_counts = await self.attendance_repo.get_monthly_status_counts(user_id, year, month)
        return AttendanceOverview(
            work_days=status_counts.get("normal", 0),
            late_count=status_counts.get("late", 0),
            early_count=status_counts.get("early", 0),
            absent_count=status_counts.get("absent", 0),
            leave_count=status_counts.get("leave", 0),
        )
