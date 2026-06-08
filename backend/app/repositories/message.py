import logging

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message

logger = logging.getLogger(__name__)


class MessageRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_inbox(
        self, user_id: int, page: int = 1, page_size: int = 20
    ) -> tuple[list[Message], int]:
        base = select(Message).where(
            Message.recipient_id == user_id,
            Message.recipient_deleted == False,
        )
        count_base = select(func.count(Message.id)).where(
            Message.recipient_id == user_id,
            Message.recipient_deleted == False,
        )

        total = await self.session.scalar(count_base)
        offset = (page - 1) * page_size
        result = await self.session.execute(
            base.order_by(Message.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total or 0

    async def get_sent(
        self, user_id: int, page: int = 1, page_size: int = 20
    ) -> tuple[list[Message], int]:
        base = select(Message).where(
            Message.sender_id == user_id,
            Message.sender_deleted == False,
        )
        count_base = select(func.count(Message.id)).where(
            Message.sender_id == user_id,
            Message.sender_deleted == False,
        )

        total = await self.session.scalar(count_base)
        offset = (page - 1) * page_size
        result = await self.session.execute(
            base.order_by(Message.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total or 0

    async def get_unread_count(self, user_id: int) -> int:
        result = await self.session.scalar(
            select(func.count(Message.id)).where(
                Message.recipient_id == user_id,
                Message.is_read == False,
                Message.recipient_deleted == False,
            )
        )
        return result or 0

    async def get_by_id(self, message_id: int) -> Message | None:
        result = await self.session.execute(
            select(Message).where(Message.id == message_id)
        )
        return result.scalar_one_or_none()

    async def create(self, message: Message) -> Message:
        self.session.add(message)
        await self.session.flush()
        await self.session.refresh(message)
        return message

    async def mark_read(self, message_id: int, recipient_id: int) -> Message | None:
        from datetime import datetime, timezone

        result = await self.session.execute(
            update(Message)
            .where(
                Message.id == message_id,
                Message.recipient_id == recipient_id,
                Message.is_read == False,
            )
            .values(is_read=True, read_at=datetime.now(timezone.utc))
            .returning(Message)
        )
        await self.session.flush()
        return result.scalar_one_or_none()

    async def delete_for_user(self, message_id: int, user_id: int) -> bool:
        """Soft-delete for the calling user. Returns True if at least one row was updated."""
        msg = await self.get_by_id(message_id)
        if msg is None:
            return False

        if msg.sender_id == user_id:
            result = await self.session.execute(
                update(Message)
                .where(Message.id == message_id, Message.sender_deleted == False)
                .values(sender_deleted=True)
            )
        elif msg.recipient_id == user_id:
            result = await self.session.execute(
                update(Message)
                .where(Message.id == message_id, Message.recipient_deleted == False)
                .values(recipient_deleted=True)
            )
        else:
            return False

        await self.session.flush()
        return result.rowcount > 0
