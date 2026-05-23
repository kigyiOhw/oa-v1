from app.core.config import settings
from app.core.storage.base import StorageBackend
from app.core.storage.local import LocalStorage
from app.core.storage.s3 import S3Storage


def get_storage() -> StorageBackend:
    """Return the configured storage backend based on STORAGE_BACKEND setting."""
    backend = settings.STORAGE_BACKEND

    if backend == "s3":
        return S3Storage(
            endpoint=settings.STORAGE_S3_ENDPOINT,
            bucket=settings.STORAGE_S3_BUCKET,
            access_key=settings.STORAGE_S3_ACCESS_KEY,
            secret_key=settings.STORAGE_S3_SECRET_KEY,
            region=settings.STORAGE_S3_REGION,
        )

    return LocalStorage(settings.UPLOAD_DIR)


__all__ = ["StorageBackend", "LocalStorage", "S3Storage", "get_storage"]
