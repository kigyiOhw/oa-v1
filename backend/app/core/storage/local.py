import os
import uuid

import aiofiles
from fastapi import UploadFile

from app.core.storage.base import StorageBackend


class LocalStorage(StorageBackend):
    def __init__(self, upload_dir: str):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)

    async def upload(self, file: UploadFile) -> str:
        ext = os.path.splitext(file.filename or ".bin")[1] or ".bin"
        filename = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(self.upload_dir, filename)

        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()
            await f.write(content)

        return f"/media/{filename}"

    async def delete(self, file_path: str) -> None:
        filename = file_path.replace("/media/", "")
        full_path = os.path.join(self.upload_dir, filename)
        if os.path.isfile(full_path):
            os.remove(full_path)

    def get_url(self, file_path: str) -> str:
        return file_path
