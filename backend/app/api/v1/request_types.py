import logging

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.exceptions import OAException
from app.core.permissions import Permissions
from app.models.request_type import RequestType
from app.repositories.request_type import RequestTypeRepository
from app.schemas.request_type import RequestTypeCreate, RequestTypeOut, RequestTypeUpdate

router = APIRouter(prefix="/request-types", tags=["request-types"])
logger = logging.getLogger(__name__)


@router.get("", response_model=list[RequestTypeOut])
async def list_request_types(
    db: DBDep,
    current_user: CurrentUser,
    module: str | None = None,
) -> list[RequestTypeOut]:
    logger.info("----------request_types.list, module=%s", module)
    repo = RequestTypeRepository(db)
    if module:
        items = await repo.list_by_module(module)
    else:
        items = await repo.list_all()
    return [RequestTypeOut.model_validate(i) for i in items]


@router.post("", response_model=RequestTypeOut, status_code=status.HTTP_201_CREATED)
async def create_request_type(
    data: RequestTypeCreate,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ANNOUNCEMENT_UPDATE),
) -> RequestTypeOut:
    logger.info("----------request_types.create, module=%s code=%s", data.module, data.code)
    repo = RequestTypeRepository(db)
    from sqlalchemy import select as sa_select
    existing = await db.execute(
        sa_select(RequestType).where(
            RequestType.module == data.module, RequestType.code == data.code
        )
    )
    if existing.scalar_one_or_none():
        raise OAException("Request type with this code already exists", status_code=400)

    request_type = RequestType(
        module=data.module,
        code=data.code,
        name=data.name,
        sort_order=data.sort_order,
        is_active=data.is_active,
    )
    result = await repo.create(request_type)
    logger.info("----------request_types.create, done id=%s", result.id)
    return RequestTypeOut.model_validate(result)


@router.put("/{type_id}", response_model=RequestTypeOut)
async def update_request_type(
    type_id: int,
    data: RequestTypeUpdate,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ANNOUNCEMENT_UPDATE),
) -> RequestTypeOut:
    logger.info("----------request_types.update, id=%s", type_id)
    repo = RequestTypeRepository(db)
    request_type = await repo.get_by_id(type_id)
    if not request_type:
        raise OAException("Request type not found", status_code=404)

    if data.name is not None:
        request_type.name = data.name
    if data.sort_order is not None:
        request_type.sort_order = data.sort_order
    if data.is_active is not None:
        request_type.is_active = data.is_active

    result = await repo.update(request_type)
    logger.info("----------request_types.update, done id=%s", type_id)
    return RequestTypeOut.model_validate(result)


@router.delete("/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_request_type(
    type_id: int,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ANNOUNCEMENT_UPDATE),
) -> None:
    logger.info("----------request_types.delete, id=%s", type_id)
    repo = RequestTypeRepository(db)
    request_type = await repo.get_by_id(type_id)
    if not request_type:
        raise OAException("Request type not found", status_code=404)

    await repo.delete(request_type)
    logger.info("----------request_types.delete, done id=%s", type_id)
