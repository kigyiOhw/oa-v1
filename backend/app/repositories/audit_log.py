import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.audit import AuditLog

logger = logging.getLogger(__name__)


class AuditLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_filtered(
        self,
        *,
        action: str | None = None,
        resource_type: str | None = None,
        start_date=None,
        end_date=None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AuditLog], int]:
        base = select(AuditLog).options(joinedload(AuditLog.user))
        count_base = select(func.count(AuditLog.id))

        if action:
            base = base.where(AuditLog.action == action)
            count_base = count_base.where(AuditLog.action == action)
        if resource_type:
            base = base.where(AuditLog.resource_type == resource_type)
            count_base = count_base.where(AuditLog.resource_type == resource_type)
        if start_date:
            base = base.where(AuditLog.created_at >= start_date)
            count_base = count_base.where(AuditLog.created_at >= start_date)
        if end_date:
            base = base.where(AuditLog.created_at <= end_date)
            count_base = count_base.where(AuditLog.created_at <= end_date)

        total = await self.session.scalar(count_base)
        offset = (page - 1) * page_size
        result = await self.session.execute(
            base.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total or 0
