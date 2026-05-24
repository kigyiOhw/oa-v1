import logging
from datetime import datetime

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.leave_request import LeaveRequest
from app.models.overtime_request import OvertimeRequest
from app.models.user import User
from app.repositories.overtime_request import OvertimeRequestRepository
from app.repositories.workflow_def import WorkflowDefRepository
from app.schemas.overtime import OvertimeCreate, OvertimeUpdate
from app.schemas.workflow import StartInstanceRequest
from app.services.workflow import WorkflowEngineService

logger = logging.getLogger(__name__)

OVERTIME_WORKFLOW_NAME = "Overtime Approval"


class OvertimeService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = OvertimeRequestRepository(session)
        self.def_repo = WorkflowDefRepository(session)

    async def _check_leave_conflict(self, user_id: int, start_time: datetime, end_time: datetime) -> None:
        """Check if user has approved leave overlapping with the overtime period."""
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
        conflicting = result.scalars().all()
        if conflicting:
            logger.warning("----------OvertimeService._check_leave_conflict, conflict, user_id=%s, count=%s",
                           user_id, len(conflicting))
            raise OAException("Overtime conflicts with an approved leave request on the same day", status_code=400)

    async def list_my_overtimes(
        self, user: User, status: str | None, page: int, page_size: int
    ) -> tuple[list[OvertimeRequest], int]:
        logger.info("----------OvertimeService.list_my_overtimes, start, user_id=%s, status=%s, page=%s",
                    user.id, status, page)
        items, total = await self.repo.get_by_user(user.id, status, page, page_size)
        logger.info("----------OvertimeService.list_my_overtimes, done, total=%s", total)
        return items, total

    async def get_overtime(self, overtime_id: int) -> OvertimeRequest:
        logger.info("----------OvertimeService.get_overtime, start, overtime_id=%s", overtime_id)
        overtime = await self.repo.get_by_id(overtime_id)
        if not overtime:
            logger.warning("----------OvertimeService.get_overtime, not_found, overtime_id=%s", overtime_id)
            raise OAException("Overtime request not found", status_code=404)
        logger.info("----------OvertimeService.get_overtime, done, overtime_id=%s, user_id=%s, status=%s",
                    overtime_id, overtime.user_id, overtime.status)
        return overtime

    async def create_draft(self, user: User, data: OvertimeCreate) -> OvertimeRequest:
        logger.info("----------OvertimeService.create_draft, start, user_id=%s, start=%s, end=%s, hours=%s",
                    user.id, data.start_time, data.end_time, data.duration_hours)
        if data.end_time <= data.start_time:
            logger.warning("----------OvertimeService.create_draft, invalid_times, user_id=%s, start=%s, end=%s",
                           user.id, data.start_time, data.end_time)
            raise OAException("End time must be after start time", status_code=400)

        await self._check_leave_conflict(user.id, data.start_time, data.end_time)

        overtime = OvertimeRequest(
            user_id=user.id,
            start_time=data.start_time,
            end_time=data.end_time,
            duration_hours=data.duration_hours,
            reason=data.reason,
            status="draft",
        )
        result = await self.repo.create(overtime)
        logger.info("----------OvertimeService.create_draft, done, overtime_id=%s, user_id=%s", result.id, user.id)
        return result

    async def update_draft(self, user: User, overtime_id: int, data: OvertimeUpdate) -> OvertimeRequest:
        logger.info("----------OvertimeService.update_draft, start, overtime_id=%s, user_id=%s", overtime_id, user.id)
        overtime = await self.repo.get_by_id(overtime_id)
        if not overtime:
            logger.warning("----------OvertimeService.update_draft, not_found, overtime_id=%s", overtime_id)
            raise OAException("Overtime request not found", status_code=404)
        if overtime.user_id != user.id:
            logger.warning("----------OvertimeService.update_draft, not_owner, overtime_id=%s, owner=%s, requester=%s",
                           overtime_id, overtime.user_id, user.id)
            raise OAException("Not your overtime request", status_code=403)
        if overtime.status != "draft":
            logger.warning("----------OvertimeService.update_draft, not_draft, overtime_id=%s, status=%s",
                           overtime_id, overtime.status)
            raise OAException("Only draft requests can be edited", status_code=400)

        if data.start_time is not None:
            overtime.start_time = data.start_time
        if data.end_time is not None:
            overtime.end_time = data.end_time
        if data.duration_hours is not None:
            overtime.duration_hours = data.duration_hours
        if data.reason is not None:
            overtime.reason = data.reason

        if overtime.end_time <= overtime.start_time:
            logger.warning("----------OvertimeService.update_draft, invalid_times, overtime_id=%s, start=%s, end=%s",
                           overtime_id, overtime.start_time, overtime.end_time)
            raise OAException("End time must be after start time", status_code=400)

        await self._check_leave_conflict(user.id, overtime.start_time, overtime.end_time)

        result = await self.repo.update(overtime)
        logger.info("----------OvertimeService.update_draft, done, overtime_id=%s", overtime_id)
        return result

    async def delete_draft(self, user: User, overtime_id: int) -> None:
        logger.info("----------OvertimeService.delete_draft, start, overtime_id=%s, user_id=%s", overtime_id, user.id)
        overtime = await self.repo.get_by_id(overtime_id)
        if not overtime:
            logger.warning("----------OvertimeService.delete_draft, not_found, overtime_id=%s", overtime_id)
            raise OAException("Overtime request not found", status_code=404)
        if overtime.user_id != user.id:
            logger.warning("----------OvertimeService.delete_draft, not_owner, overtime_id=%s, owner=%s, requester=%s",
                           overtime_id, overtime.user_id, user.id)
            raise OAException("Not your overtime request", status_code=403)
        if overtime.status != "draft":
            logger.warning("----------OvertimeService.delete_draft, not_draft, overtime_id=%s, status=%s",
                           overtime_id, overtime.status)
            raise OAException("Only draft requests can be deleted", status_code=400)
        await self.repo.delete(overtime)
        logger.info("----------OvertimeService.delete_draft, done, overtime_id=%s", overtime_id)

    async def submit(self, user: User, overtime_id: int) -> OvertimeRequest:
        logger.info("----------OvertimeService.submit, start, overtime_id=%s, user_id=%s", overtime_id, user.id)
        overtime = await self.repo.get_by_id(overtime_id)
        if not overtime:
            logger.warning("----------OvertimeService.submit, not_found, overtime_id=%s", overtime_id)
            raise OAException("Overtime request not found", status_code=404)
        if overtime.user_id != user.id:
            logger.warning("----------OvertimeService.submit, not_owner, overtime_id=%s, owner=%s, requester=%s",
                           overtime_id, overtime.user_id, user.id)
            raise OAException("Not your overtime request", status_code=403)
        if overtime.status != "draft":
            logger.warning("----------OvertimeService.submit, not_draft, overtime_id=%s, status=%s",
                           overtime_id, overtime.status)
            raise OAException("Only draft requests can be submitted", status_code=400)

        await self._check_leave_conflict(user.id, overtime.start_time, overtime.end_time)

        logger.info("----------OvertimeService.submit, looking_up_workflow_def, name=%s", OVERTIME_WORKFLOW_NAME)
        wf_defs = await self.def_repo.get_by_name(OVERTIME_WORKFLOW_NAME)
        if not wf_defs:
            logger.error("----------OvertimeService.submit, workflow_def_not_found, name=%s", OVERTIME_WORKFLOW_NAME)
            raise OAException("Overtime approval workflow definition not found", status_code=500)
        logger.info("----------OvertimeService.submit, workflow_def_found, def_id=%s, version=%s", wf_defs.id, wf_defs.version)

        title = f"{user.full_name or user.username} - Overtime {overtime.duration_hours}h"
        logger.info("----------OvertimeService.submit, starting_workflow, def_id=%s, title=%s", wf_defs.id, title)
        engine = WorkflowEngineService(self.session)
        instance = await engine.start_instance(
            user,
            StartInstanceRequest(
                workflow_def_id=wf_defs.id,
                title=title,
                form_data={
                    "start_time": overtime.start_time.isoformat(),
                    "end_time": overtime.end_time.isoformat(),
                    "duration_hours": float(overtime.duration_hours),
                    "reason": overtime.reason,
                },
            ),
        )
        logger.info("----------OvertimeService.submit, workflow_started, instance_id=%s, instance_status=%s",
                    instance.id, instance.status)

        overtime.workflow_instance_id = instance.id
        overtime.status = "submitted"
        result = await self.repo.update(overtime)
        logger.info("----------OvertimeService.submit, done, overtime_id=%s, instance_id=%s", overtime_id, instance.id)
        return result

    async def cancel(self, user: User, overtime_id: int) -> OvertimeRequest:
        logger.info("----------OvertimeService.cancel, start, overtime_id=%s, user_id=%s", overtime_id, user.id)
        overtime = await self.repo.get_by_id(overtime_id)
        if not overtime:
            logger.warning("----------OvertimeService.cancel, not_found, overtime_id=%s", overtime_id)
            raise OAException("Overtime request not found", status_code=404)
        if overtime.user_id != user.id:
            logger.warning("----------OvertimeService.cancel, not_owner, overtime_id=%s, owner=%s, requester=%s",
                           overtime_id, overtime.user_id, user.id)
            raise OAException("Not your overtime request", status_code=403)
        if overtime.status not in ("submitted", "pending"):
            logger.warning("----------OvertimeService.cancel, cannot_cancel, overtime_id=%s, status=%s",
                           overtime_id, overtime.status)
            raise OAException("Cannot cancel this request", status_code=400)
        if not overtime.workflow_instance_id:
            logger.error("----------OvertimeService.cancel, no_workflow_instance, overtime_id=%s", overtime_id)
            raise OAException("No workflow instance associated", status_code=500)

        logger.info("----------OvertimeService.cancel, cancelling_workflow, instance_id=%s", overtime.workflow_instance_id)
        engine = WorkflowEngineService(self.session)
        await engine.cancel_instance(user, overtime.workflow_instance_id)
        logger.info("----------OvertimeService.cancel, workflow_cancelled, instance_id=%s", overtime.workflow_instance_id)

        overtime.status = "cancelled"
        result = await self.repo.update(overtime)
        logger.info("----------OvertimeService.cancel, done, overtime_id=%s", overtime_id)
        return result

    async def sync_status(self, overtime: OvertimeRequest) -> OvertimeRequest:
        if not overtime.workflow_instance_id:
            return overtime

        from app.repositories.workflow_instance import WorkflowInstanceRepository

        instance_repo = WorkflowInstanceRepository(self.session)
        instance = await instance_repo.get_by_id(overtime.workflow_instance_id)
        if instance and instance.status in ("approved", "rejected", "cancelled"):
            logger.info("----------OvertimeService.sync_status, syncing, overtime_id=%s, from=%s, to=%s",
                        overtime.id, overtime.status, instance.status)
            overtime.status = instance.status
            await self.repo.update(overtime)

        return overtime
