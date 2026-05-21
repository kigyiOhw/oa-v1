from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    is_pinned: bool = False


class AnnouncementUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    content: str | None = None
    is_pinned: bool | None = None
    is_published: bool | None = None


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    author_id: int
    is_pinned: bool
    is_published: bool
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PaginatedAnnouncements(BaseModel):
    items: list[AnnouncementOut]
    total: int
    page: int
    page_size: int
