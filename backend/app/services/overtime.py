"""Overtime request service — inherits common CRUD from DraftWorkflowService."""

import logging
from datetime import datetime

from sqlalchemy import and_, select

from app.core.exceptions import OAException
from app.models.leave_request import LeaveRequest
from app.models.overtime_request import OvertimeRequest
from app.models.user import User
from app.repositories.overtime_request import OvertimeRequestRepository
from app.schemas.overtime import OvertimeCreate, OvertimeUpdate
from app.services.workflow.draft_service import DraftWorkflowService

logger = logging.getLogger(__name__)


class OvertimeService(DraftWorkflowService[OvertimeRequest, OvertimeCreate, OvertimeUpdate]):
    model = OvertimeRequest
    workflow_name = "Overtime Approval"

    def __init__(self, session):
        super().__init__(session)
        self.repo = OvertimeRequestRepository(session)

    # -- API-compatible wrappers -----------------------------------------

    async def list_my_overtimes(self, user: User, status: str | None, page: int, page_size: int):
        logger.info("OvertimeService.list_my_overtimes | user=%s", user.id)
        return await self.list_my(user, "overtime", status, page, page_size)

    async def get_overtime(self, overtime_id: int) -> OvertimeRequest:
        return await self.get(overtime_id)

    # -- leave conflict check (overtime-specific) ------------------------

    async def _check_leave_conflict(self, user_id: int, start_time: datetime, end_time: datetime) -> None:
        start_date = start_time.date() if hasattr(start_time, 'date') else datetime.fromisoformat(str(start_time)).date()
        end_date = end_time.date() if hasattr(end_time, 'date') else datetime.fromisoformat(str(end_time)).date()
        result = await self.session.execute(
            select(LeaveRequest).where(
                and_(
                    LeaveRequest.user_id == user_id,
                    LeaveRequest.status == "approved",
                    LeaveRequest.start_date <= end_date,
                    LeaveRequest.end_date >= start_date,
                )
            )
        )
        if result.scalars().all():
            raise OAException("Overtime conflicts with an approved leave request", status_code=400)

    # -- override CRUD to inject conflict check --------------------------

    async def create_draft(self, user: User, data: OvertimeCreate) -> OvertimeRequest:
        if data.end_time <= data.start_time:
            raise OAException("End time must be after start time", status_code=400)
        await self._check_leave_conflict(user.id, data.start_time, data.end_time)
        return await super().create_draft(user, data)

    async def update_draft(self, user: User, overtime_id: int, data: OvertimeUpdate) -> OvertimeRequest:
        obj = await self._get_or_404(overtime_id)
        await self._check_owner(obj, user)
        self._check_draft(obj)
        self._apply_update(obj, data)
        if obj.end_time <= obj.start_time:
            raise OAException("End time must be after start time", status_code=400)
        await self._check_leave_conflict(user.id, obj.start_time, obj.end_time)
        result = await self.repo.update(obj)
        return result

    async def submit(self, user: User, overtime_id: int) -> OvertimeRequest:
        obj = await self._get_or_404(overtime_id)
        await self._check_owner(obj, user)
        self._check_draft(obj)
        await self._check_leave_conflict(user.id, obj.start_time, obj.end_time)
        return await super().submit(user, overtime_id)

    # -- hook overrides --------------------------------------------------

    def _build_create(self, user: User, data: OvertimeCreate) -> OvertimeRequest:
        return OvertimeRequest(
            user_id=user.id,
            start_time=data.start_time,
            end_time=data.end_time,
            duration_hours=data.duration_hours,
            reason=data.reason,
            status="draft",
        )

    def _apply_update(self, obj: OvertimeRequest, data: OvertimeUpdate) -> None:
        if data.start_time is not None:
            obj.start_time = data.start_time
        if data.end_time is not None:
            obj.end_time = data.end_time
        if data.duration_hours is not None:
            obj.duration_hours = data.duration_hours
        if data.reason is not None:
            obj.reason = data.reason

    def _build_title(self, user: User, obj: OvertimeRequest) -> str:
        return f"{user.full_name or user.username} - Overtime {obj.duration_hours}h"

    def _build_form_data(self, obj: OvertimeRequest) -> dict:
        return {
            "start_time": obj.start_time.isoformat(),
            "end_time": obj.end_time.isoformat(),
            "duration_hours": float(obj.duration_hours),
            "reason": obj.reason,
        }
