import logging

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBDep
from app.schemas.contacts import DepartmentTreeNode, PaginatedContacts
from app.services.contacts import ContactsService

router = APIRouter(prefix="/contacts", tags=["contacts"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedContacts)
async def list_contacts(
    db: DBDep,
    current_user: CurrentUser,
    search: str | None = Query(None),
    department_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedContacts:
    logger.info(
        "----------contacts.list, user_id=%s, search=%s, dept=%s, page=%s",
        current_user.id, search, department_id, page,
    )
    service = ContactsService(db)
    items, total = await service.list_contacts(search, department_id, page, page_size)
    logger.info("----------contacts.list, done, user_id=%s, total=%s", current_user.id, total)
    return PaginatedContacts(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/tree", response_model=list[DepartmentTreeNode])
async def department_tree(
    db: DBDep,
    current_user: CurrentUser,
) -> list[DepartmentTreeNode]:
    logger.info("----------contacts.tree, user_id=%s", current_user.id)
    service = ContactsService(db)
    return await service.get_tree()
