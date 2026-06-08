import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.message import Message
from app.models.user import User
from app.repositories.message import MessageRepository
from app.schemas.message import MessageOut, MessageSend

logger = logging.getLogger(__name__)


class MessageService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = MessageRepository(session)

    async def send_message(self, sender: User, data: MessageSend) -> Message:
        """Send a message and push WebSocket notification to recipient."""
        if data.recipient_id == sender.id:
            raise OAException("Cannot send message to yourself", status_code=400)

        # Verify recipient exists and is active
        result = await self.session.execute(
            select(User).where(User.id == data.recipient_id, User.is_active == True)
        )
        recipient = result.scalar_one_or_none()
        if recipient is None:
            raise OAException("Recipient not found", status_code=404)

        msg = Message(
            sender_id=sender.id,
            recipient_id=data.recipient_id,
            subject=data.subject,
            body=data.body,
        )
        msg = await self.repo.create(msg)
        await self.session.commit()

        # Push WebSocket event to recipient (best-effort)
        try:
            from app.api.v1.websocket import manager
            await manager.send_to_user(data.recipient_id, {
                "type": "new_message",
                "payload": MessageOut.model_validate(msg).model_dump(mode="json"),
            })
        except Exception:
            logger.debug("WebSocket send failed for user_id=%s (offline)", data.recipient_id)

        return msg

    async def get_inbox(
        self, user: User, page: int, page_size: int
    ) -> tuple[list[Message], int]:
        return await self.repo.get_inbox(user.id, page, page_size)

    async def get_sent(
        self, user: User, page: int, page_size: int
    ) -> tuple[list[Message], int]:
        return await self.repo.get_sent(user.id, page, page_size)

    async def get_unread_count(self, user: User) -> int:
        return await self.repo.get_unread_count(user.id)

    async def get_message(self, message_id: int, user: User) -> Message:
        """Get message detail. Only sender or recipient can view."""
        msg = await self.repo.get_by_id(message_id)
        if msg is None:
            raise OAException("Message not found", status_code=404)
        if msg.sender_id != user.id and msg.recipient_id != user.id:
            raise OAException("Message not found", status_code=404)
        return msg

    async def mark_read(self, message_id: int, user: User) -> Message:
        """Mark message as read. Only recipient can do this."""
        msg = await self.repo.mark_read(message_id, user.id)
        if msg is None:
            existing = await self.repo.get_by_id(message_id)
            if existing is None or existing.recipient_id != user.id:
                raise OAException("Message not found", status_code=404)
            # Already read — just return it
            return existing
        await self.session.commit()

        # Push read receipt to sender (best-effort)
        try:
            from app.api.v1.websocket import manager
            await manager.send_to_user(msg.sender_id, {
                "type": "message_read",
                "payload": {
                    "message_id": msg.id,
                    "read_at": msg.read_at.isoformat() if msg.read_at else None,
                },
            })
        except Exception:
            logger.debug("WebSocket read receipt failed for sender_id=%s", msg.sender_id)

        return msg

    async def delete_message(self, message_id: int, user: User) -> None:
        """Soft-delete message for the calling user."""
        ok = await self.repo.delete_for_user(message_id, user.id)
        if not ok:
            raise OAException("Message not found", status_code=404)
        await self.session.commit()
