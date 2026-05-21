from abc import ABC, abstractmethod

from fastapi import UploadFile


class StorageBackend(ABC):
    @abstractmethod
    async def upload(self, file: UploadFile) -> str:
        """Upload a file and return its public URL path."""

    @abstractmethod
    async def delete(self, file_path: str) -> None:
        """Delete a file by its relative path."""

    @abstractmethod
    def get_url(self, file_path: str) -> str:
        """Return the full URL for a stored file path."""
