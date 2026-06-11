import logging

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions
from app.schemas.workflow import (
    WorkflowDefCreate,
    WorkflowDefOut,
    WorkflowDefUpdate,
    ValidateDefinitionRequest,
    ValidateDefinitionResponse,
)
from app.services.workflow import WorkflowEngineService

router = APIRouter(prefix="/workflow-defs", tags=["workflow-defs"])
logger = logging.getLogger(__name__)


@router.get("", response_model=list[WorkflowDefOut])
async def list_definitions(
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.WORKFLOW_DEF_READ),
) -> list[WorkflowDefOut]:
    service = WorkflowEngineService(db)
    defs = await service.list_definitions()
    return [WorkflowDefOut.model_validate(d) for d in defs]


@router.get("/{def_id}", response_model=WorkflowDefOut)
async def get_definition(
    def_id: int,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.WORKFLOW_DEF_READ),
) -> WorkflowDefOut:
    service = WorkflowEngineService(db)
    return await service.get_definition(def_id)


@router.post("", response_model=WorkflowDefOut, status_code=status.HTTP_201_CREATED)
async def create_definition(
    data: WorkflowDefCreate,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.WORKFLOW_DEF_CREATE),
) -> WorkflowDefOut:
    service = WorkflowEngineService(db)
    return await service.create_definition(data)


@router.put("/{def_id}", response_model=WorkflowDefOut)
async def update_definition(
    def_id: int,
    data: WorkflowDefUpdate,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.WORKFLOW_DEF_UPDATE),
) -> WorkflowDefOut:
    service = WorkflowEngineService(db)
    return await service.update_definition(def_id, data)


@router.post("/validate", response_model=ValidateDefinitionResponse)
async def validate_definition(
    data: ValidateDefinitionRequest,
    _current_user: CurrentUser,
) -> ValidateDefinitionResponse:
    valid, errors = WorkflowEngineService.validate_definition(data.definition)
    return ValidateDefinitionResponse(valid=valid, errors=errors)


@router.delete("/{def_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_definition(
    def_id: int,
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.WORKFLOW_DEF_DELETE),
) -> None:
    service = WorkflowEngineService(db)
    await service.delete_definition(def_id)
