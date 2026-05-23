import logging
import os

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.core.storage import get_storage
from app.models.media import MediaFile
from app.models.user import User
from app.repositories.media import MediaRepository

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".mov"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


class MediaService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = MediaRepository(session)
        self.storage = get_storage()

    async def get_all(self, page: int, page_size: int):
        return await self.repo.get_all(page, page_size)

    async def upload(self, file: UploadFile, user: User) -> MediaFile:
        if not file.filename:
            raise OAException("No file selected", status_code=400)

        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise OAException(f"File type '{ext}' not allowed", status_code=400)

        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
        if size > MAX_FILE_SIZE:
            raise OAException("File size exceeds 50MB limit", status_code=400)

        file_path = await self.storage.upload(file)

        is_video = ext in {".mp4", ".webm", ".mov"}
        media = MediaFile(
            title=file.filename,
            file_path=file_path,
            file_type="video" if is_video else "image",
            file_size=size,
            mime_type=file.content_type or "application/octet-stream",
            uploaded_by=user.id,
        )
        media = await self.repo.create(media)
        logger.info("Media uploaded | id=%d type=%s title=%s", media.id, media.file_type, media.title)
        return media

    async def delete(self, media_id: int) -> None:
        media = await self.repo.get_by_id(media_id)
        if not media:
            raise OAException("Media file not found", status_code=404)
        await self.storage.delete(media.file_path)
        await self.repo.delete(media)
        logger.info("Media deleted | id=%d", media_id)
