"""Expense request service — inherits common CRUD from DraftWorkflowService."""

import logging

from app.models.expense_request import ExpenseRequest
from app.models.user import User
from app.repositories.expense_request import ExpenseRequestRepository
from app.schemas.expense import ExpenseCreate, ExpenseUpdate
from app.services.workflow.draft_service import DraftWorkflowService

logger = logging.getLogger(__name__)


class ExpenseService(DraftWorkflowService[ExpenseRequest, ExpenseCreate, ExpenseUpdate]):
    model = ExpenseRequest
    workflow_name = "Expense Approval"

    def __init__(self, session):
        super().__init__(session)
        self.repo = ExpenseRequestRepository(session)

    # -- API-compatible wrappers -----------------------------------------

    async def list_my_expenses(self, user: User, status: str | None, page: int, page_size: int):
        logger.info("ExpenseService.list_my_expenses | user=%s", user.id)
        return await self.list_my(user, "expense", status, page, page_size)

    async def get_expense(self, expense_id: int) -> ExpenseRequest:
        return await self.get(expense_id)

    # -- hook overrides --------------------------------------------------

    def _build_create(self, user: User, data: ExpenseCreate) -> ExpenseRequest:
        return ExpenseRequest(
            user_id=user.id,
            expense_type=data.expense_type,
            amount=data.amount,
            description=data.description,
            attachment_urls=data.attachment_urls,
            status="draft",
        )

    def _apply_update(self, obj: ExpenseRequest, data: ExpenseUpdate) -> None:
        if data.expense_type is not None:
            obj.expense_type = data.expense_type
        if data.amount is not None:
            obj.amount = data.amount
        if data.description is not None:
            obj.description = data.description
        if data.attachment_urls is not None:
            obj.attachment_urls = data.attachment_urls

    def _build_title(self, user: User, obj: ExpenseRequest) -> str:
        return f"{user.full_name or user.username} - {obj.expense_type} expense ¥{obj.amount}"

    def _build_form_data(self, obj: ExpenseRequest) -> dict:
        return {
            "expense_type": obj.expense_type,
            "amount": float(obj.amount),
            "description": obj.description,
            "attachment_urls": obj.attachment_urls or [],
        }
