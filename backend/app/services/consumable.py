import logging
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.consumable import Consumable, ConsumableRecord
from app.repositories.consumable import ConsumableRecordRepository, ConsumableRepository
from app.schemas.consumable import ConsumableCreate, ConsumableUpdate, StockRequest

logger = logging.getLogger(__name__)


class ConsumableService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ConsumableRepository(session)
        self.record_repo = ConsumableRecordRepository(session)

    async def list_consumables(
        self,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        category_id: int | None = None,
    ) -> tuple[list[Consumable], int]:
        return await self.repo.get_all(
            page=page, page_size=page_size, search=search, category_id=category_id,
        )

    async def get_consumable(self, consumable_id: int) -> Consumable:
        c = await self.repo.get_by_id(consumable_id)
        if not c:
            raise OAException("Consumable not found", status_code=404)
        return c

    async def create_consumable(self, data: ConsumableCreate) -> Consumable:
        c = Consumable(
            name=data.name,
            category_id=data.category_id,
            unit=data.unit,
            safety_stock=data.safety_stock,
            description=data.description,
        )
        return await self.repo.create(c)

    async def update_consumable(self, consumable_id: int, data: ConsumableUpdate) -> Consumable:
        c = await self.get_consumable(consumable_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(c, field, value)
        return await self.repo.update(c)

    async def delete_consumable(self, consumable_id: int) -> None:
        c = await self.get_consumable(consumable_id)
        if c.current_stock != 0:
            raise OAException("Cannot delete consumable with non-zero stock", status_code=400)
        await self.repo.delete(c)

    async def stock_in(self, consumable_id: int, data: StockRequest, operator_id: int) -> Consumable:
        c = await self.get_consumable(consumable_id)
        c.current_stock += data.quantity
        await self.repo.update(c)

        await self.record_repo.create(ConsumableRecord(
            consumable_id=consumable_id,
            type="in",
            quantity=data.quantity,
            operator_id=operator_id,
            record_date=date.today(),
            notes=data.notes,
        ))
        return c

    async def stock_out(self, consumable_id: int, data: StockRequest, operator_id: int) -> Consumable:
        c = await self.get_consumable(consumable_id)
        if c.current_stock < data.quantity:
            raise OAException(
                f"Insufficient stock: have {c.current_stock} {c.unit}, need {data.quantity} {c.unit}",
                status_code=400,
            )
        c.current_stock -= data.quantity
        await self.repo.update(c)

        await self.record_repo.create(ConsumableRecord(
            consumable_id=consumable_id,
            type="out",
            quantity=data.quantity,
            operator_id=operator_id,
            record_date=date.today(),
            notes=data.notes,
        ))
        return c
