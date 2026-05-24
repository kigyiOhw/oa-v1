import logging

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions
from app.schemas.expense import ExpenseCreate, ExpenseOut, ExpenseUpdate, PaginatedExpenses
from app.services.expense import ExpenseService

router = APIRouter(prefix="/expenses", tags=["expenses"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedExpenses)
async def list_my_expenses(
    db: DBDep,
    current_user: CurrentUser,
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedExpenses:
    logger.info("----------expenses.list_my_expenses, start, user_id=%s, status=%s, page=%s",
                current_user.id, status_filter, page)
    service = ExpenseService(db)
    items, total = await service.list_my_expenses(current_user, status_filter, page, page_size)
    for item in items:
        await service.sync_status(item)
    logger.info("----------expenses.list_my_expenses, done, user_id=%s, total=%s", current_user.id, total)
    return PaginatedExpenses(
        items=[ExpenseOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
async def create_draft(
    data: ExpenseCreate,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.EXPENSE_CREATE),
) -> ExpenseOut:
    logger.info("----------expenses.create_draft, start, user_id=%s, type=%s", current_user.id, data.expense_type)
    service = ExpenseService(db)
    result = await service.create_draft(current_user, data)
    await db.commit()
    logger.info("----------expenses.create_draft, done, expense_id=%s, user_id=%s", result.id, current_user.id)
    return result


@router.get("/{expense_id}", response_model=ExpenseOut)
async def get_expense(
    expense_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> ExpenseOut:
    logger.info("----------expenses.get_expense, start, expense_id=%s, user_id=%s", expense_id, current_user.id)
    service = ExpenseService(db)
    expense = await service.get_expense(expense_id)
    await service.sync_status(expense)
    if expense.user_id != current_user.id:
        logger.info("----------expenses.get_expense, cross_user_read, expense_id=%s, owner=%s, requester=%s",
                    expense_id, expense.user_id, current_user.id)
        await require_permission(Permissions.EXPENSE_READ)(current_user, db)
    logger.info("----------expenses.get_expense, done, expense_id=%s", expense_id)
    return expense


@router.put("/{expense_id}", response_model=ExpenseOut)
async def update_draft(
    expense_id: int,
    data: ExpenseUpdate,
    db: DBDep,
    current_user: CurrentUser,
) -> ExpenseOut:
    logger.info("----------expenses.update_draft, start, expense_id=%s, user_id=%s", expense_id, current_user.id)
    service = ExpenseService(db)
    result = await service.update_draft(current_user, expense_id, data)
    await db.commit()
    logger.info("----------expenses.update_draft, done, expense_id=%s", expense_id)
    return result


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(
    expense_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> None:
    logger.info("----------expenses.delete_draft, start, expense_id=%s, user_id=%s", expense_id, current_user.id)
    service = ExpenseService(db)
    await service.delete_draft(current_user, expense_id)
    await db.commit()
    logger.info("----------expenses.delete_draft, done, expense_id=%s", expense_id)


@router.post("/{expense_id}/submit", response_model=ExpenseOut)
async def submit_expense(
    expense_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> ExpenseOut:
    logger.info("----------expenses.submit_expense, start, expense_id=%s, user_id=%s", expense_id, current_user.id)
    service = ExpenseService(db)
    result = await service.submit(current_user, expense_id)
    await db.commit()
    logger.info("----------expenses.submit_expense, done, expense_id=%s, instance_id=%s", expense_id, result.workflow_instance_id)
    return result


@router.post("/{expense_id}/cancel", response_model=ExpenseOut)
async def cancel_expense(
    expense_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> ExpenseOut:
    logger.info("----------expenses.cancel_expense, start, expense_id=%s, user_id=%s", expense_id, current_user.id)
    service = ExpenseService(db)
    result = await service.cancel(current_user, expense_id)
    await db.commit()
    logger.info("----------expenses.cancel_expense, done, expense_id=%s", expense_id)
    return result
