"""Leave request service — inherits common CRUD from DraftWorkflowService."""

import logging
from datetime import datetime

from app.core.exceptions import OAException
from app.models.leave_balance import LeaveBalance
from app.models.leave_request import LeaveRequest
from app.models.user import User
from app.repositories.leave_balance import LeaveBalanceRepository
from app.repositories.leave_request import LeaveRequestRepository
from app.schemas.leave import LeaveCreate, LeaveUpdate
from app.services.workflow.draft_service import DraftWorkflowService

logger = logging.getLogger(__name__)


class LeaveService(DraftWorkflowService[LeaveRequest, LeaveCreate, LeaveUpdate]):
    model = LeaveRequest
    workflow_name = "Leave Approval"

    def __init__(self, session):
        super().__init__(session)
        self.repo = LeaveRequestRepository(session)
        self.balance_repo = LeaveBalanceRepository(session)

    # -- API-compatible wrappers -----------------------------------------

    async def list_my_leaves(self, user: User, status: str | None, page: int, page_size: int):
        logger.info("LeaveService.list_my_leaves | user=%s", user.id)
        return await self.list_my(user, "leave", status, page, page_size)

    async def get_leave(self, leave_id: int) -> LeaveRequest:
        return await self.get(leave_id)

    async def get_balance(self, user_id: int, year: int | None = None) -> list[LeaveBalance]:
        target_year = year or datetime.now().year
        return await self.balance_repo.get_by_user_and_year(user_id, target_year)

    # -- Balance helpers -------------------------------------------------

    async def _ensure_balance(self, user_id: int, leave_type: str, year: int) -> LeaveBalance:
        balances = await self.balance_repo.get_by_user_and_year(user_id, year)
        for b in balances:
            if b.leave_type == leave_type:
                return b
        # Auto-create with default annual quota if annual leave
        total = 10.0 if leave_type == "annual" else 0.0
        balance = LeaveBalance(
            user_id=user_id,
            year=year,
            leave_type=leave_type,
            total_days=total,
            used_days=0.0,
        )
        return await self.balance_repo.create(balance)

    async def _deduct_balance(self, leave: LeaveRequest) -> None:
        year = leave.start_date.year
        balance = await self._ensure_balance(leave.user_id, leave.leave_type, year)
        days = float(leave.duration_days)
        if balance.total_days > 0 and balance.used_days + days > balance.total_days:
            raise OAException("Insufficient leave balance", status_code=400)
        balance.used_days = float(balance.used_days) + days
        await self.balance_repo.update(balance)
        logger.info("LeaveService._deduct_balance | user=%s type=%s year=%s used=%s/%s",
                    leave.user_id, leave.leave_type, year, balance.used_days, balance.total_days)

    async def _restore_balance(self, leave: LeaveRequest) -> None:
        year = leave.start_date.year
        balances = await self.balance_repo.get_by_user_and_year(leave.user_id, year)
        for balance in balances:
            if balance.leave_type == leave.leave_type:
                balance.used_days = max(0.0, float(balance.used_days) - float(leave.duration_days))
                await self.balance_repo.update(balance)
                logger.info("LeaveService._restore_balance | user=%s type=%s year=%s used=%s/%s",
                            leave.user_id, leave.leave_type, year, balance.used_days, balance.total_days)
                break

    # -- hook overrides --------------------------------------------------

    def _build_create(self, user: User, data: LeaveCreate) -> LeaveRequest:
        if data.end_date < data.start_date:
            raise OAException("End date must be after start date", status_code=400)
        actual_days = float((data.end_date - data.start_date).days + 1)
        if data.half_day:
            actual_days -= 0.5
        return LeaveRequest(
            user_id=user.id,
            leave_type=data.leave_type,
            start_date=data.start_date,
            end_date=data.end_date,
            duration_days=actual_days,
            half_day=data.half_day,
            reason=data.reason,
            status="draft",
        )

    def _apply_update(self, obj: LeaveRequest, data: LeaveUpdate) -> None:
        if data.leave_type is not None:
            obj.leave_type = data.leave_type
        if data.start_date is not None:
            obj.start_date = data.start_date
        if data.end_date is not None:
            obj.end_date = data.end_date
        if data.start_date or data.end_date:
            # Recalculate duration from actual date difference
            obj.duration_days = (obj.end_date - obj.start_date).days + 1
        if data.half_day is not None:
            obj.half_day = data.half_day
            obj.duration_days = max(0.5, (obj.end_date - obj.start_date).days + 1 - 0.5)
        if data.reason is not None:
            obj.reason = data.reason
        if obj.end_date < obj.start_date:
            raise OAException("End date must be after start date", status_code=400)

    def _build_title(self, user: User, obj: LeaveRequest) -> str:
        return f"{user.full_name or user.username} - {obj.leave_type} leave"

    def _build_form_data(self, obj: LeaveRequest) -> dict:
        return {
            "leave_type": obj.leave_type,
            "start_date": obj.start_date.isoformat(),
            "end_date": obj.end_date.isoformat(),
            "duration_days": float(obj.duration_days),
            "reason": obj.reason,
        }

    async def _on_status_synced(self, leave: LeaveRequest, old_status: str) -> None:
        from app.services.attendance import AttendanceService
        if leave.workflow_instance_id:
            from app.repositories.workflow_instance import WorkflowInstanceRepository
            instance_repo = WorkflowInstanceRepository(self.session)
            instance = await instance_repo.get_by_id(leave.workflow_instance_id)
            if instance:
                # Balance management
                if instance.status == "approved" and old_status != "approved":
                    await self._deduct_balance(leave)
                elif old_status == "approved" and instance.status in ("rejected", "cancelled"):
                    await self._restore_balance(leave)

                attendance_svc = AttendanceService(self.session)
                if instance.status == "approved":
                    await attendance_svc.sync_leave_record(leave, approved=True)
                elif old_status == "approved" and instance.status in ("rejected", "cancelled"):
                    await attendance_svc.sync_leave_record(leave, approved=False)
