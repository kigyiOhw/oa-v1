import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import ALL_PERMISSIONS
from app.db.base import AsyncSessionLocal
from app.models.announcement import Announcement
from app.models.setting import Setting
from app.models.user import Permission, Role

logger = logging.getLogger(__name__)

DEFAULT_COMPANY_INFO = json.dumps({
    "name": "OA 管理系统",
    "logo_url": "",
    "description": "欢迎使用企业办公自动化系统。本系统支持请假、报销、加班等审批流程，提供公告发布、媒体管理、内网导航等功能。",
    "address": "",
    "contact": "",
})

DEFAULT_QUICK_LINKS = json.dumps([
    {"name": "OA 门户", "url": "http://localhost:5173", "icon": "home"},
    {"name": "知识库", "url": "http://localhost:5173", "icon": "book"},
    {"name": "文件共享", "url": "http://localhost:5173", "icon": "file"},
    {"name": "会议预约", "url": "http://localhost:5173", "icon": "calendar"},
    {"name": "数据报表", "url": "http://localhost:5173", "icon": "chart"},
])


async def seed_initial_data(db: AsyncSession) -> None:
    existing = await db.execute(select(Permission.code))
    existing_codes = {row[0] for row in existing}

    new_perms: list[Permission] = []
    for code in ALL_PERMISSIONS:
        if code not in existing_codes:
            desc = {
                "user:create": "Create users",
                "user:read": "View users",
                "user:update": "Edit users",
                "user:delete": "Delete users",
                "role:create": "Create roles",
                "role:read": "View roles",
                "role:update": "Edit roles",
                "role:delete": "Delete roles",
                "permission:read": "View permissions",
                "permission:assign": "Assign permissions to roles",
                "dept:create": "Create departments",
                "dept:read": "View departments",
                "dept:update": "Edit departments",
                "dept:delete": "Delete departments",
                "workflow_def:create": "Create workflow definitions",
                "workflow_def:read": "View workflow definitions",
                "workflow_def:update": "Edit workflow definitions",
                "workflow_def:delete": "Delete workflow definitions",
                "announcement:create": "Create announcements",
                "announcement:read": "View announcements",
                "announcement:update": "Edit announcements",
                "announcement:delete": "Delete announcements",
                "media:upload": "Upload media files",
                "media:read": "View media files",
                "media:delete": "Delete media files",
            }.get(code, "")
            new_perms.append(Permission(code=code, description=desc))

    if new_perms:
        for p in new_perms:
            db.add(p)
        await db.flush()
        logger.info("Seeded %d permissions", len(new_perms))

    all_perms = list((await db.execute(select(Permission))).scalars().all())

    admin_role = (await db.execute(select(Role).where(Role.name == "admin"))).scalar_one_or_none()
    if not admin_role:
        admin_role = Role(name="admin", description="Administrator")
        admin_role.permissions = all_perms
        db.add(admin_role)
        await db.flush()
        logger.info("Seeded admin role with %d permissions", len(all_perms))

    user_role = (await db.execute(select(Role).where(Role.name == "user"))).scalar_one_or_none()
    if not user_role:
        read_codes = {"user:read", "role:read", "permission:read", "dept:read", "announcement:read", "media:read"}
        user_perms = [p for p in all_perms if p.code in read_codes]
        user_role = Role(name="user", description="Regular user")
        user_role.permissions = user_perms
        db.add(user_role)
        await db.flush()
        logger.info("Seeded user role with %d permissions", len(user_perms))

    # Seed default portal content (skip if already exists)
    existing_company = await db.execute(select(Setting).where(Setting.key == "company_info"))
    if not existing_company.scalar_one_or_none():
        db.add(Setting(key="company_info", value=DEFAULT_COMPANY_INFO))
        logger.info("Seeded default company info")

    existing_links = await db.execute(select(Setting).where(Setting.key == "quick_links"))
    if not existing_links.scalar_one_or_none():
        db.add(Setting(key="quick_links", value=DEFAULT_QUICK_LINKS))
        logger.info("Seeded default quick links")

    existing_ann = await db.execute(select(Announcement).limit(1))
    if not existing_ann.scalar_one_or_none():
        from app.models.user import User
        first_user = (await db.execute(select(User.id).order_by(User.id).limit(1))).scalar_one_or_none()
        author_id = first_user if first_user else 1
        now = datetime.now(timezone.utc)
        db.add(Announcement(
            title="欢迎使用 OA 管理系统",
            content=(
                "### 系统已上线\n\n"
                "本系统已正式投入使用，支持以下功能：\n\n"
                "- **审批流程**：请假、报销、加班等业务在线审批\n"
                "- **公告发布**：公司通知、规章制度集中管理\n"
                "- **媒体管理**：上传公司活动照片和视频\n"
                "- **内网导航**：快速访问常用系统\n\n"
                "如有问题请联系系统管理员。"
            ),
            author_id=author_id,
            is_pinned=True,
            is_published=True,
            published_at=now,
        ))
        logger.info("Seeded welcome announcement")

    await db.commit()
    logger.info("Seed completed")


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
