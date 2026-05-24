import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.expense_request import ExpenseRequest
from app.models.user import User
from app.repositories.expense_request import ExpenseRequestRepository
from app.repositories.workflow_def import WorkflowDefRepository
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from app.schemas.workflow import StartInstanceRequest
from app.services.workflow import WorkflowEngineService

logger = logging.getLogger(__name__)

EXPENSE_WORKFLOW_NAME = "Expense Approval"


class ExpenseService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ExpenseRequestRepository(session)
        self.def_repo = WorkflowDefRepository(session)

    async def list_my_expenses(
        self, user: User, status: str | None, page: int, page_size: int
    ) -> tuple[list[ExpenseRequest], int]:
        logger.info("----------ExpenseService.list_my_expenses, start, user_id=%s, status=%s, page=%s",
                    user.id, status, page)
        items, total = await self.repo.get_by_user(user.id, status, page, page_size)
        logger.info("----------ExpenseService.list_my_expenses, done, total=%s", total)
        return items, total

    async def get_expense(self, expense_id: int) -> ExpenseRequest:
        logger.info("----------ExpenseService.get_expense, start, expense_id=%s", expense_id)
        expense = await self.repo.get_by_id(expense_id)
        if not expense:
            logger.warning("----------ExpenseService.get_expense, not_found, expense_id=%s", expense_id)
            raise OAException("Expense request not found", status_code=404)
        logger.info("----------ExpenseService.get_expense, done, expense_id=%s, user_id=%s, status=%s",
                    expense_id, expense.user_id, expense.status)
        return expense

    async def create_draft(self, user: User, data: ExpenseCreate) -> ExpenseRequest:
        logger.info("----------ExpenseService.create_draft, start, user_id=%s, type=%s, amount=%s",
                    user.id, data.expense_type, data.amount)
        expense = ExpenseRequest(
            user_id=user.id,
            expense_type=data.expense_type,
            amount=data.amount,
            description=data.description,
            attachment_urls=data.attachment_urls,
            status="draft",
        )
        result = await self.repo.create(expense)
        logger.info("----------ExpenseService.create_draft, done, expense_id=%s, user_id=%s", result.id, user.id)
        return result

    async def update_draft(self, user: User, expense_id: int, data: ExpenseUpdate) -> ExpenseRequest:
        logger.info("----------ExpenseService.update_draft, start, expense_id=%s, user_id=%s", expense_id, user.id)
        expense = await self.repo.get_by_id(expense_id)
        if not expense:
            logger.warning("----------ExpenseService.update_draft, not_found, expense_id=%s", expense_id)
            raise OAException("Expense request not found", status_code=404)
        if expense.user_id != user.id:
            logger.warning("----------ExpenseService.update_draft, not_owner, expense_id=%s, owner=%s, requester=%s",
                           expense_id, expense.user_id, user.id)
            raise OAException("Not your expense request", status_code=403)
        if expense.status != "draft":
            logger.warning("----------ExpenseService.update_draft, not_draft, expense_id=%s, status=%s",
                           expense_id, expense.status)
            raise OAException("Only draft requests can be edited", status_code=400)

        if data.expense_type is not None:
            expense.expense_type = data.expense_type
        if data.amount is not None:
            expense.amount = data.amount
        if data.description is not None:
            expense.description = data.description
        if data.attachment_urls is not None:
            expense.attachment_urls = data.attachment_urls

        result = await self.repo.update(expense)
        logger.info("----------ExpenseService.update_draft, done, expense_id=%s", expense_id)
        return result

    async def delete_draft(self, user: User, expense_id: int) -> None:
        logger.info("----------ExpenseService.delete_draft, start, expense_id=%s, user_id=%s", expense_id, user.id)
        expense = await self.repo.get_by_id(expense_id)
        if not expense:
            logger.warning("----------ExpenseService.delete_draft, not_found, expense_id=%s", expense_id)
            raise OAException("Expense request not found", status_code=404)
        if expense.user_id != user.id:
            logger.warning("----------ExpenseService.delete_draft, not_owner, expense_id=%s, owner=%s, requester=%s",
                           expense_id, expense.user_id, user.id)
            raise OAException("Not your expense request", status_code=403)
        if expense.status != "draft":
            logger.warning("----------ExpenseService.delete_draft, not_draft, expense_id=%s, status=%s",
                           expense_id, expense.status)
            raise OAException("Only draft requests can be deleted", status_code=400)
        await self.repo.delete(expense)
        logger.info("----------ExpenseService.delete_draft, done, expense_id=%s", expense_id)

    async def submit(self, user: User, expense_id: int) -> ExpenseRequest:
        logger.info("----------ExpenseService.submit, start, expense_id=%s, user_id=%s", expense_id, user.id)
        expense = await self.repo.get_by_id(expense_id)
        if not expense:
            logger.warning("----------ExpenseService.submit, not_found, expense_id=%s", expense_id)
            raise OAException("Expense request not found", status_code=404)
        if expense.user_id != user.id:
            logger.warning("----------ExpenseService.submit, not_owner, expense_id=%s, owner=%s, requester=%s",
                           expense_id, expense.user_id, user.id)
            raise OAException("Not your expense request", status_code=403)
        if expense.status != "draft":
            logger.warning("----------ExpenseService.submit, not_draft, expense_id=%s, status=%s",
                           expense_id, expense.status)
            raise OAException("Only draft requests can be submitted", status_code=400)

        logger.info("----------ExpenseService.submit, looking_up_workflow_def, name=%s", EXPENSE_WORKFLOW_NAME)
        wf_defs = await self.def_repo.get_by_name(EXPENSE_WORKFLOW_NAME)
        if not wf_defs:
            logger.error("----------ExpenseService.submit, workflow_def_not_found, name=%s", EXPENSE_WORKFLOW_NAME)
            raise OAException("Expense approval workflow definition not found", status_code=500)
        logger.info("----------ExpenseService.submit, workflow_def_found, def_id=%s, version=%s", wf_defs.id, wf_defs.version)

        title = f"{user.full_name or user.username} - {expense.expense_type} expense ¥{expense.amount}"
        logger.info("----------ExpenseService.submit, starting_workflow, def_id=%s, title=%s", wf_defs.id, title)
        engine = WorkflowEngineService(self.session)
        instance = await engine.start_instance(
            user,
            StartInstanceRequest(
                workflow_def_id=wf_defs.id,
                title=title,
                form_data={
                    "expense_type": expense.expense_type,
                    "amount": float(expense.amount),
                    "description": expense.description,
                    "attachment_urls": expense.attachment_urls or [],
                },
            ),
        )
        logger.info("----------ExpenseService.submit, workflow_started, instance_id=%s, instance_status=%s",
                    instance.id, instance.status)

        expense.workflow_instance_id = instance.id
        expense.status = "submitted"
        result = await self.repo.update(expense)
        logger.info("----------ExpenseService.submit, done, expense_id=%s, instance_id=%s", expense_id, instance.id)
        return result

    async def cancel(self, user: User, expense_id: int) -> ExpenseRequest:
        logger.info("----------ExpenseService.cancel, start, expense_id=%s, user_id=%s", expense_id, user.id)
        expense = await self.repo.get_by_id(expense_id)
        if not expense:
            logger.warning("----------ExpenseService.cancel, not_found, expense_id=%s", expense_id)
            raise OAException("Expense request not found", status_code=404)
        if expense.user_id != user.id:
            logger.warning("----------ExpenseService.cancel, not_owner, expense_id=%s, owner=%s, requester=%s",
                           expense_id, expense.user_id, user.id)
            raise OAException("Not your expense request", status_code=403)
        if expense.status not in ("submitted", "pending"):
            logger.warning("----------ExpenseService.cancel, cannot_cancel, expense_id=%s, status=%s",
                           expense_id, expense.status)
            raise OAException("Cannot cancel this request", status_code=400)
        if not expense.workflow_instance_id:
            logger.error("----------ExpenseService.cancel, no_workflow_instance, expense_id=%s", expense_id)
            raise OAException("No workflow instance associated", status_code=500)

        logger.info("----------ExpenseService.cancel, cancelling_workflow, instance_id=%s", expense.workflow_instance_id)
        engine = WorkflowEngineService(self.session)
        await engine.cancel_instance(user, expense.workflow_instance_id)
        logger.info("----------ExpenseService.cancel, workflow_cancelled, instance_id=%s", expense.workflow_instance_id)

        expense.status = "cancelled"
        result = await self.repo.update(expense)
        logger.info("----------ExpenseService.cancel, done, expense_id=%s", expense_id)
        return result

    async def sync_status(self, expense: ExpenseRequest) -> ExpenseRequest:
        if not expense.workflow_instance_id:
            return expense

        from app.repositories.workflow_instance import WorkflowInstanceRepository

        instance_repo = WorkflowInstanceRepository(self.session)
        instance = await instance_repo.get_by_id(expense.workflow_instance_id)
        if instance and instance.status in ("approved", "rejected", "cancelled"):
            logger.info("----------ExpenseService.sync_status, syncing, expense_id=%s, from=%s, to=%s",
                        expense.id, expense.status, instance.status)
            expense.status = instance.status
            await self.repo.update(expense)

        return expense
