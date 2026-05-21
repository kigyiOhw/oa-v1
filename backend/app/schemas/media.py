from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MediaFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    file_path: str
    file_type: str
    file_size: int
    mime_type: str
    uploaded_by: int
    created_at: datetime


class PaginatedMediaFiles(BaseModel):
    items: list[MediaFileOut]
    total: int
    page: int
    page_size: int
