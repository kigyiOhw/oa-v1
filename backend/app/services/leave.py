import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.leave_request import LeaveRequest
from app.models.user import User
from app.repositories.leave_request import LeaveRequestRepository
from app.repositories.workflow_def import WorkflowDefRepository
from app.schemas.leave import LeaveCreate, LeaveUpdate
from app.schemas.workflow import StartInstanceRequest
from app.services.workflow import WorkflowEngineService

logger = logging.getLogger(__name__)

LEAVE_WORKFLOW_NAME = "Leave Approval"


class LeaveService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = LeaveRequestRepository(session)
        self.def_repo = WorkflowDefRepository(session)

    async def list_my_leaves(
        self, user: User, status: str | None, page: int, page_size: int
    ) -> tuple[list[LeaveRequest], int]:
        logger.info("----------LeaveService.list_my_leaves, start, user_id=%s, status=%s, page=%s",
                    user.id, status, page)
        items, total = await self.repo.get_by_user(user.id, status, page, page_size)
        logger.info("----------LeaveService.list_my_leaves, done, total=%s", total)
        return items, total

    async def get_leave(self, leave_id: int) -> LeaveRequest:
        logger.info("----------LeaveService.get_leave, start, leave_id=%s", leave_id)
        leave = await self.repo.get_by_id(leave_id)
        if not leave:
            logger.warning("----------LeaveService.get_leave, not_found, leave_id=%s", leave_id)
            raise OAException("Leave request not found", status_code=404)
        logger.info("----------LeaveService.get_leave, done, leave_id=%s, user_id=%s, status=%s",
                    leave_id, leave.user_id, leave.status)
        return leave

    async def create_draft(self, user: User, data: LeaveCreate) -> LeaveRequest:
        logger.info("----------LeaveService.create_draft, start, user_id=%s, type=%s, start=%s, end=%s, days=%s",
                    user.id, data.leave_type, data.start_date, data.end_date, data.duration_days)
        if data.end_date < data.start_date:
            logger.warning("----------LeaveService.create_draft, invalid_dates, user_id=%s, start=%s, end=%s",
                           user.id, data.start_date, data.end_date)
            raise OAException("End date must be after start date", status_code=400)

        leave = LeaveRequest(
            user_id=user.id,
            leave_type=data.leave_type,
            start_date=data.start_date,
            end_date=data.end_date,
            duration_days=data.duration_days,
            reason=data.reason,
            status="draft",
        )
        result = await self.repo.create(leave)
        logger.info("----------LeaveService.create_draft, done, leave_id=%s, user_id=%s", result.id, user.id)
        return result

    async def update_draft(self, user: User, leave_id: int, data: LeaveUpdate) -> LeaveRequest:
        logger.info("----------LeaveService.update_draft, start, leave_id=%s, user_id=%s", leave_id, user.id)
        leave = await self.repo.get_by_id(leave_id)
        if not leave:
            logger.warning("----------LeaveService.update_draft, not_found, leave_id=%s", leave_id)
            raise OAException("Leave request not found", status_code=404)
        if leave.user_id != user.id:
            logger.warning("----------LeaveService.update_draft, not_owner, leave_id=%s, owner=%s, requester=%s",
                           leave_id, leave.user_id, user.id)
            raise OAException("Not your leave request", status_code=403)
        if leave.status != "draft":
            logger.warning("----------LeaveService.update_draft, not_draft, leave_id=%s, status=%s", leave_id, leave.status)
            raise OAException("Only draft requests can be edited", status_code=400)

        if data.leave_type is not None:
            leave.leave_type = data.leave_type
        if data.start_date is not None:
            leave.start_date = data.start_date
        if data.end_date is not None:
            leave.end_date = data.end_date
        if data.duration_days is not None:
            leave.duration_days = data.duration_days
        if data.reason is not None:
            leave.reason = data.reason

        if leave.end_date < leave.start_date:
            logger.warning("----------LeaveService.update_draft, invalid_dates, leave_id=%s, start=%s, end=%s",
                           leave_id, leave.start_date, leave.end_date)
            raise OAException("End date must be after start date", status_code=400)

        result = await self.repo.update(leave)
        logger.info("----------LeaveService.update_draft, done, leave_id=%s", leave_id)
        return result

    async def delete_draft(self, user: User, leave_id: int) -> None:
        logger.info("----------LeaveService.delete_draft, start, leave_id=%s, user_id=%s", leave_id, user.id)
        leave = await self.repo.get_by_id(leave_id)
        if not leave:
            logger.warning("----------LeaveService.delete_draft, not_found, leave_id=%s", leave_id)
            raise OAException("Leave request not found", status_code=404)
        if leave.user_id != user.id:
            logger.warning("----------LeaveService.delete_draft, not_owner, leave_id=%s, owner=%s, requester=%s",
                           leave_id, leave.user_id, user.id)
            raise OAException("Not your leave request", status_code=403)
        if leave.status != "draft":
            logger.warning("----------LeaveService.delete_draft, not_draft, leave_id=%s, status=%s", leave_id, leave.status)
            raise OAException("Only draft requests can be deleted", status_code=400)
        await self.repo.delete(leave)
        logger.info("----------LeaveService.delete_draft, done, leave_id=%s", leave_id)

    async def submit(self, user: User, leave_id: int) -> LeaveRequest:
        logger.info("----------LeaveService.submit, start, leave_id=%s, user_id=%s", leave_id, user.id)
        leave = await self.repo.get_by_id(leave_id)
        if not leave:
            logger.warning("----------LeaveService.submit, not_found, leave_id=%s", leave_id)
            raise OAException("Leave request not found", status_code=404)
        if leave.user_id != user.id:
            logger.warning("----------LeaveService.submit, not_owner, leave_id=%s, owner=%s, requester=%s",
                           leave_id, leave.user_id, user.id)
            raise OAException("Not your leave request", status_code=403)
        if leave.status != "draft":
            logger.warning("----------LeaveService.submit, not_draft, leave_id=%s, status=%s", leave_id, leave.status)
            raise OAException("Only draft requests can be submitted", status_code=400)

        logger.info("----------LeaveService.submit, looking_up_workflow_def, name=%s", LEAVE_WORKFLOW_NAME)
        wf_defs = await self.def_repo.get_by_name(LEAVE_WORKFLOW_NAME)
        if not wf_defs:
            logger.error("----------LeaveService.submit, workflow_def_not_found, name=%s", LEAVE_WORKFLOW_NAME)
            raise OAException("Leave approval workflow definition not found", status_code=500)
        logger.info("----------LeaveService.submit, workflow_def_found, def_id=%s, version=%s", wf_defs.id, wf_defs.version)

        title = f"{user.full_name or user.username} - {leave.leave_type} leave"
        logger.info("----------LeaveService.submit, starting_workflow, def_id=%s, title=%s", wf_defs.id, title)
        engine = WorkflowEngineService(self.session)
        instance = await engine.start_instance(
            user,
            StartInstanceRequest(
                workflow_def_id=wf_defs.id,
                title=title,
                form_data={
                    "leave_type": leave.leave_type,
                    "start_date": leave.start_date.isoformat(),
                    "end_date": leave.end_date.isoformat(),
                    "duration_days": float(leave.duration_days),
                    "reason": leave.reason,
                },
            ),
        )
        logger.info("----------LeaveService.submit, workflow_started, instance_id=%s, instance_status=%s",
                    instance.id, instance.status)

        leave.workflow_instance_id = instance.id
        leave.status = "submitted"
        result = await self.repo.update(leave)
        logger.info("----------LeaveService.submit, done, leave_id=%s, instance_id=%s", leave_id, instance.id)
        return result

    async def cancel(self, user: User, leave_id: int) -> LeaveRequest:
        logger.info("----------LeaveService.cancel, start, leave_id=%s, user_id=%s", leave_id, user.id)
        leave = await self.repo.get_by_id(leave_id)
        if not leave:
            logger.warning("----------LeaveService.cancel, not_found, leave_id=%s", leave_id)
            raise OAException("Leave request not found", status_code=404)
        if leave.user_id != user.id:
            logger.warning("----------LeaveService.cancel, not_owner, leave_id=%s, owner=%s, requester=%s",
                           leave_id, leave.user_id, user.id)
            raise OAException("Not your leave request", status_code=403)
        if leave.status not in ("submitted", "pending"):
            logger.warning("----------LeaveService.cancel, cannot_cancel, leave_id=%s, status=%s", leave_id, leave.status)
            raise OAException("Cannot cancel this request", status_code=400)
        if not leave.workflow_instance_id:
            logger.error("----------LeaveService.cancel, no_workflow_instance, leave_id=%s", leave_id)
            raise OAException("No workflow instance associated", status_code=500)

        logger.info("----------LeaveService.cancel, cancelling_workflow, instance_id=%s", leave.workflow_instance_id)
        engine = WorkflowEngineService(self.session)
        await engine.cancel_instance(user, leave.workflow_instance_id)
        logger.info("----------LeaveService.cancel, workflow_cancelled, instance_id=%s", leave.workflow_instance_id)

        leave.status = "cancelled"
        result = await self.repo.update(leave)
        logger.info("----------LeaveService.cancel, done, leave_id=%s", leave_id)
        return result

    async def sync_status(self, leave: LeaveRequest) -> LeaveRequest:
        if not leave.workflow_instance_id:
            return leave

        from app.repositories.workflow_instance import WorkflowInstanceRepository

        instance_repo = WorkflowInstanceRepository(self.session)
        instance = await instance_repo.get_by_id(leave.workflow_instance_id)
        if instance and instance.status in ("approved", "rejected", "cancelled"):
            logger.info("----------LeaveService.sync_status, syncing, leave_id=%s, from=%s, to=%s",
                        leave.id, leave.status, instance.status)
            leave.status = instance.status
            await self.repo.update(leave)
        return leave
