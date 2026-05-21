import logging

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions
from app.schemas.setting import CompanyInfo, QuickLink, QuickLinksUpdate
from app.services.setting import SettingService

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger(__name__)


@router.get("/company-info", response_model=CompanyInfo)
async def get_company_info(db: DBDep) -> CompanyInfo:
    service = SettingService(db)
    return await service.get_company_info()


@router.put("/company-info", response_model=CompanyInfo)
async def update_company_info(
    data: CompanyInfo,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ANNOUNCEMENT_UPDATE),
) -> CompanyInfo:
    service = SettingService(db)
    return await service.update_company_info(data)


@router.get("/quick-links", response_model=list[QuickLink])
async def get_quick_links(db: DBDep) -> list[QuickLink]:
    service = SettingService(db)
    return await service.get_quick_links()


@router.put("/quick-links", response_model=list[QuickLink])
async def update_quick_links(
    data: QuickLinksUpdate,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ANNOUNCEMENT_UPDATE),
) -> list[QuickLink]:
    service = SettingService(db)
    return await service.update_quick_links(data)
