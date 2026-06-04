import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.asset import Asset, AssetAssignment, AssetCategory
from app.models.user import User

logger = logging.getLogger(__name__)


class AssetCategoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self) -> list[AssetCategory]:
        result = await self.session.execute(
            select(AssetCategory).order_by(AssetCategory.sort_order, AssetCategory.id)
        )
        return list(result.scalars().all())

    async def get_by_id(self, category_id: int) -> AssetCategory | None:
        result = await self.session.execute(
            select(AssetCategory).where(AssetCategory.id == category_id)
        )
        return result.scalar_one_or_none()

    async def create(self, category: AssetCategory) -> AssetCategory:
        self.session.add(category)
        await self.session.flush()
        return category

    async def update(self, category: AssetCategory) -> AssetCategory:
        await self.session.flush()
        await self.session.refresh(category)
        return category

    async def delete(self, category: AssetCategory) -> None:
        await self.session.delete(category)
        await self.session.flush()


class AssetRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, asset_id: int) -> Asset | None:
        result = await self.session.execute(
            select(Asset)
            .options(
                selectinload(Asset.category),
                selectinload(Asset.department),
                selectinload(Asset.current_user),
                selectinload(Asset.assignments).selectinload(AssetAssignment.user),
                selectinload(Asset.assignments).selectinload(AssetAssignment.operator),
            )
            .where(Asset.id == asset_id)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        category_id: int | None = None,
        status: str | None = None,
        department_id: int | None = None,
    ) -> tuple[list[Asset], int]:
        base = select(Asset).options(
            selectinload(Asset.category),
            selectinload(Asset.department),
            selectinload(Asset.current_user),
        )
        count_base = select(func.count(Asset.id))

        if search:
            f = Asset.name.ilike(f"%{search}%") | Asset.asset_code.ilike(f"%{search}%")
            base = base.where(f)
            count_base = count_base.where(f)
        if category_id is not None:
            base = base.where(Asset.category_id == category_id)
            count_base = count_base.where(Asset.category_id == category_id)
        if status:
            base = base.where(Asset.status == status)
            count_base = count_base.where(Asset.status == status)
        if department_id is not None:
            base = base.where(Asset.department_id == department_id)
            count_base = count_base.where(Asset.department_id == department_id)

        total = await self.session.scalar(count_base)
        offset = (page - 1) * page_size
        result = await self.session.execute(
            base.order_by(Asset.id).offset(offset).limit(page_size)
        )
        return list(result.scalars().all()), total

    async def get_by_user(self, user_id: int) -> list[Asset]:
        result = await self.session.execute(
            select(Asset)
            .options(
                selectinload(Asset.category),
                selectinload(Asset.department),
                selectinload(Asset.current_user),
            )
            .where(Asset.current_user_id == user_id)
            .order_by(Asset.id)
        )
        return list(result.scalars().all())

    async def get_max_code_suffix(self, prefix: str) -> int:
        result = await self.session.execute(
            select(func.max(Asset.id)).where(Asset.asset_code.ilike(f"{prefix}-%"))
        )
        return result.scalar() or 0

    async def create(self, asset: Asset) -> Asset:
        self.session.add(asset)
        await self.session.flush()
        return asset

    async def update(self, asset: Asset) -> Asset:
        await self.session.flush()
        await self.session.refresh(asset)
        return asset

    async def count_by_status(self, dept_id: int | None = None) -> dict[str, int]:
        base = select(Asset.status, func.count(Asset.id))
        if dept_id is not None:
            base = base.where(Asset.department_id == dept_id)
        rows = (await self.session.execute(base.group_by(Asset.status))).all()
        return {row[0]: row[1] for row in rows}

    async def delete(self, asset: Asset) -> None:
        await self.session.delete(asset)
        await self.session.flush()


class AssetAssignmentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_asset(self, asset_id: int) -> list[AssetAssignment]:
        result = await self.session.execute(
            select(AssetAssignment)
            .options(
                selectinload(AssetAssignment.user),
                selectinload(AssetAssignment.operator),
            )
            .where(AssetAssignment.asset_id == asset_id)
            .order_by(AssetAssignment.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(self, assignment: AssetAssignment) -> AssetAssignment:
        self.session.add(assignment)
        await self.session.flush()
        return assignment
