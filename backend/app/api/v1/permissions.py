import logging

from fastapi import APIRouter

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions
from app.repositories.permission import PermissionRepository
from app.schemas.permission import PermissionOut

router = APIRouter(prefix="/permissions", tags=["permissions"])
logger = logging.getLogger(__name__)


@router.get("", response_model=list[PermissionOut])
async def list_permissions(
    db: DBDep,
    _current_user: CurrentUser,
    _perm: None = require_permission(Permissions.PERMISSION_READ),
) -> list[PermissionOut]:
    repo = PermissionRepository(db)
    permissions = await repo.get_all()
    return [PermissionOut.model_validate(p) for p in permissions]
