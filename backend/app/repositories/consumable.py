import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.consumable import Consumable, ConsumableRecord

logger = logging.getLogger(__name__)


class ConsumableRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, consumable_id: int) -> Consumable | None:
        result = await self.session.execute(
            select(Consumable)
            .options(selectinload(Consumable.category))
            .where(Consumable.id == consumable_id)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        category_id: int | None = None,
    ) -> tuple[list[Consumable], int]:
        base = select(Consumable).options(selectinload(Consumable.category))
        count_base = select(func.count(Consumable.id))

        if search:
            f = Consumable.name.ilike(f"%{search}%")
            base = base.where(f)
            count_base = count_base.where(f)
        if category_id is not None:
            base = base.where(Consumable.category_id == category_id)
            count_base = count_base.where(Consumable.category_id == category_id)

        total = await self.session.scalar(count_base)
        offset = (page - 1) * page_size
        result = await self.session.execute(
            base.order_by(Consumable.id).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def create(self, consumable: Consumable) -> Consumable:
        self.session.add(consumable)
        await self.session.flush()
        return consumable

    async def update(self, consumable: Consumable) -> Consumable:
        await self.session.flush()
        await self.session.refresh(consumable)
        return consumable

    async def delete(self, consumable: Consumable) -> None:
        await self.session.delete(consumable)
        await self.session.flush()


class ConsumableRecordRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_consumable(self, consumable_id: int) -> list[ConsumableRecord]:
        result = await self.session.execute(
            select(ConsumableRecord)
            .options(selectinload(ConsumableRecord.operator))
            .where(ConsumableRecord.consumable_id == consumable_id)
            .order_by(ConsumableRecord.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(self, record: ConsumableRecord) -> ConsumableRecord:
        self.session.add(record)
        await self.session.flush()
        return record
