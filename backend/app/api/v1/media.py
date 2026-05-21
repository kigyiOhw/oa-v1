import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile, status

from app.api.deps import get_current_user, get_db, require_permission
from app.core.permissions import Permissions
from app.schemas.media import MediaFileOut, PaginatedMediaFiles
from app.services.media import MediaService

router = APIRouter(prefix="/media", tags=["media"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedMediaFiles)
async def list_media(
    db: Annotated = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
) -> PaginatedMediaFiles:
    service = MediaService(db)
    items, total = await service.get_all(page, page_size)
    return PaginatedMediaFiles(items=items, total=total, page=page, page_size=page_size)


@router.post("/upload", response_model=MediaFileOut, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile = File(...),
    db: Annotated = Depends(get_db),
    current_user: Annotated = Depends(get_current_user),
    _perm: None = require_permission(Permissions.MEDIA_UPLOAD),
) -> MediaFileOut:
    service = MediaService(db)
    media = await service.upload(file, current_user)
    await db.commit()
    return media


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    media_id: int,
    db: Annotated = Depends(get_db),
    current_user: Annotated = Depends(get_current_user),
    _perm: None = require_permission(Permissions.MEDIA_DELETE),
) -> None:
    service = MediaService(db)
    await service.delete(media_id)
    await db.commit()
