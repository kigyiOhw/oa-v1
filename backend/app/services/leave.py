"""Leave request service — inherits common CRUD from DraftWorkflowService."""

import logging

from app.core.exceptions import OAException
from app.models.leave_request import LeaveRequest
from app.models.user import User
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

    # -- API-compatible wrappers -----------------------------------------

    async def list_my_leaves(self, user: User, status: str | None, page: int, page_size: int):
        logger.info("LeaveService.list_my_leaves | user=%s", user.id)
        return await self.list_my(user, "leave", status, page, page_size)

    async def get_leave(self, leave_id: int) -> LeaveRequest:
        return await self.get(leave_id)

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
                attendance_svc = AttendanceService(self.session)
                if instance.status == "approved":
                    await attendance_svc.sync_leave_record(leave, approved=True)
                elif old_status == "approved" and instance.status in ("rejected", "cancelled"):
                    await attendance_svc.sync_leave_record(leave, approved=False)
