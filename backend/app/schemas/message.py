from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MessageSend(BaseModel):
    recipient_id: int
    subject: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: int
    recipient_id: int
    subject: str
    body: str
    is_read: bool
    read_at: datetime | None = None
    sender_deleted: bool
    recipient_deleted: bool
    created_at: datetime


class MessageDetailOut(MessageOut):
    sender_username: str | None = None
    recipient_username: str | None = None


class PaginatedMessages(BaseModel):
    items: list[MessageOut]
    total: int
    page: int
    page_size: int


class UnreadMessageCountOut(BaseModel):
    count: int
