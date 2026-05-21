import logging

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DBDep, require_permission
from app.core.permissions import Permissions
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementOut,
    AnnouncementUpdate,
    PaginatedAnnouncements,
)
from app.services.announcement import AnnouncementService

router = APIRouter(prefix="/announcements", tags=["announcements"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedAnnouncements)
async def list_published(
    db: DBDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
) -> PaginatedAnnouncements:
    service = AnnouncementService(db)
    items, total = await service.get_published(page, page_size)
    return PaginatedAnnouncements(items=items, total=total, page=page, page_size=page_size)


@router.get("/{ann_id}", response_model=AnnouncementOut)
async def get_announcement(ann_id: int, db: DBDep) -> AnnouncementOut:
    service = AnnouncementService(db)
    return await service.get_by_id(ann_id)


@router.post("", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    data: AnnouncementCreate,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ANNOUNCEMENT_CREATE),
) -> AnnouncementOut:
    service = AnnouncementService(db)
    ann = await service.create(data, current_user)
    await db.commit()
    return ann


@router.put("/{ann_id}", response_model=AnnouncementOut)
async def update_announcement(
    ann_id: int,
    data: AnnouncementUpdate,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ANNOUNCEMENT_UPDATE),
) -> AnnouncementOut:
    service = AnnouncementService(db)
    ann = await service.update(ann_id, data)
    await db.commit()
    return ann


@router.delete("/{ann_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_announcement(
    ann_id: int,
    db: DBDep,
    current_user: CurrentUser,
    _perm: None = require_permission(Permissions.ANNOUNCEMENT_DELETE),
) -> None:
    service = AnnouncementService(db)
    await service.delete(ann_id)
    await db.commit()
