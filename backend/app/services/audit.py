import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.audit_log import AuditLogRepository
from app.schemas.audit import AuditLogOut

logger = logging.getLogger(__name__)


class AuditService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = AuditLogRepository(session)

    async def list_logs(
        self,
        *,
        action: str | None = None,
        resource_type: str | None = None,
        start_date=None,
        end_date=None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AuditLogOut], int]:
        items, total = await self.repo.get_filtered(
            action=action,
            resource_type=resource_type,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size,
        )
        out_items: list[AuditLogOut] = []
        for item in items:
            out = AuditLogOut.model_validate(item)
            if item.user:
                out.user_name = item.user.username
            out_items.append(out)
        return out_items, total
