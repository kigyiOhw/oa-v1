import logging
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.asset import Asset, AssetAssignment, AssetCategory
from app.repositories.asset import (
    AssetAssignmentRepository,
    AssetCategoryRepository,
    AssetRepository,
)
from app.schemas.asset import (
    AssetCategoryCreate,
    AssetCategoryUpdate,
    AssetCreate,
    AssetUpdate,
)
from app.services.notification import NotificationService

logger = logging.getLogger(__name__)

# Category prefix → code prefix
CATEGORY_CODE_PREFIX: dict[str, str] = {
    "电子设备": "IT",
    "办公家具": "FUR",
    "生活设备": "LIV",
}


class AssetService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.cat_repo = AssetCategoryRepository(session)
        self.asset_repo = AssetRepository(session)
        self.assign_repo = AssetAssignmentRepository(session)

    # ── Categories ──

    async def list_categories(self) -> list[AssetCategory]:
        return await self.cat_repo.get_all()

    async def create_category(self, data: AssetCategoryCreate) -> AssetCategory:
        if data.parent_id:
            parent = await self.cat_repo.get_by_id(data.parent_id)
            if not parent:
                raise OAException("Parent category not found", status_code=404)
        cat = AssetCategory(
            name=data.name,
            parent_id=data.parent_id,
            description=data.description,
            sort_order=data.sort_order,
        )
        return await self.cat_repo.create(cat)

    async def update_category(self, category_id: int, data: AssetCategoryUpdate) -> AssetCategory:
        cat = await self.cat_repo.get_by_id(category_id)
        if not cat:
            raise OAException("Category not found", status_code=404)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(cat, field, value)
        return await self.cat_repo.update(cat)

    async def delete_category(self, category_id: int) -> None:
        cat = await self.cat_repo.get_by_id(category_id)
        if not cat:
            raise OAException("Category not found", status_code=404)
        await self.cat_repo.delete(cat)

    # ── Assets ──

    def _resolve_code_prefix(self, category_name: str) -> str:
        for key, prefix in CATEGORY_CODE_PREFIX.items():
            if key in category_name:
                return prefix
        return "AST"

    async def _generate_asset_code(self, category_id: int) -> str:
        cat = await self.cat_repo.get_by_id(category_id)
        prefix = self._resolve_code_prefix(cat.name if cat else "AST")
        year = date.today().year
        # Use a simple approach: max id + 1 within the same prefix
        max_id = await self.asset_repo.get_max_code_suffix(prefix)
        return f"{prefix}-{year}-{max_id + 1:03d}"

    async def list_assets(
        self,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        category_id: int | None = None,
        status: str | None = None,
        department_id: int | None = None,
    ) -> tuple[list[Asset], int]:
        return await self.asset_repo.get_all(
            page=page, page_size=page_size, search=search,
            category_id=category_id, status=status, department_id=department_id,
        )

    async def list_my_assets(self, user_id: int) -> list[Asset]:
        return await self.asset_repo.get_by_user(user_id)

    async def get_asset(self, asset_id: int) -> Asset:
        asset = await self.asset_repo.get_by_id(asset_id)
        if not asset:
            raise OAException("Asset not found", status_code=404)
        return asset

    async def create_asset(self, data: AssetCreate) -> Asset:
        asset = Asset(
            name=data.name,
            category_id=data.category_id,
            asset_code=await self._generate_asset_code(data.category_id),
            department_id=data.department_id,
            purchase_date=data.purchase_date,
            purchase_price=data.purchase_price,
            supplier=data.supplier,
            specification=data.specification,
            description=data.description,
        )
        return await self.asset_repo.create(asset)

    async def update_asset(self, asset_id: int, data: AssetUpdate) -> Asset:
        asset = await self.get_asset(asset_id)
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(asset, field, value)
        return await self.asset_repo.update(asset)

    async def delete_asset(self, asset_id: int) -> None:
        asset = await self.get_asset(asset_id)
        await self.asset_repo.delete(asset)

    async def assign(self, asset_id: int, user_id: int, operator_id: int, notes: str | None = None) -> Asset:
        asset = await self.get_asset(asset_id)
        if asset.status == "scrapped":
            raise OAException("Cannot assign a scrapped asset", status_code=400)
        if asset.status == "repairing":
            raise OAException("Cannot assign an asset under repair", status_code=400)

        asset.status = "in_use"
        asset.current_user_id = user_id
        await self.asset_repo.update(asset)

        await self.assign_repo.create(AssetAssignment(
            asset_id=asset_id,
            user_id=user_id,
            action="assign",
            action_date=date.today(),
            notes=notes,
            operator_id=operator_id,
        ))

        await NotificationService.send_notification(
            self.session,
            user_id=user_id,
            type_="asset",
            title="Asset Assigned",
            message=f"You have been assigned: {asset.name} ({asset.asset_code})",
            reference_type="asset",
            reference_id=asset_id,
        )
        return asset

    async def return_asset(self, asset_id: int, operator_id: int, notes: str | None = None) -> Asset:
        asset = await self.get_asset(asset_id)
        if not asset.current_user_id:
            raise OAException("Asset is not assigned to anyone", status_code=400)

        prev_user_id = asset.current_user_id
        asset.status = "idle"
        asset.current_user_id = None
        await self.asset_repo.update(asset)

        await self.assign_repo.create(AssetAssignment(
            asset_id=asset_id,
            user_id=prev_user_id,
            action="return",
            action_date=date.today(),
            notes=notes,
            operator_id=operator_id,
        ))
        return asset
