import asyncio
import json
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import ALL_PERMISSIONS
from app.db.base import AsyncSessionLocal
from app.models.announcement import Announcement
from app.models.asset import AssetCategory
from app.models.setting import Setting
from app.models.user import Permission, Role
from app.models.workflow import WorkflowDef

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
                "leave:create": "Create leave requests",
                "leave:read": "View leave requests",
                "leave:delete": "Delete leave requests",
                "employee:create": "Create employee profiles",
                "employee:read": "View employee profiles",
                "employee:update": "Edit employee profiles",
                "employee:delete": "Delete employee profiles",
                "asset:create": "Create assets",
                "asset:read": "View assets",
                "asset:update": "Edit assets / assign / return",
                "asset:delete": "Delete assets",
                "consumable:create": "Create consumables",
                "consumable:read": "View consumables",
                "consumable:update": "Edit consumables / stock in / out",
                "consumable:delete": "Delete consumables",
                "attendance:check-in": "Check in and out",
                "attendance:read": "View own attendance",
                "attendance:subordinates:read": "View subordinates attendance",
                "attendance:update": "Manage attendance config",
            }.get(code, "")
            new_perms.append(Permission(code=code, description=desc))

    if new_perms:
        for p in new_perms:
            db.add(p)
        await db.flush()
        logger.info("Seeded %d permissions", len(new_perms))

    all_perms = list((await db.execute(select(Permission))).scalars().all())

    super_admin_role = (await db.execute(select(Role).where(Role.name == "super_admin"))).scalar_one_or_none()
    if not super_admin_role:
        super_admin_role = Role(name="super_admin", description="超级管理员", role_type="super_admin", admin_scope="global")
        super_admin_role.permissions = all_perms
        db.add(super_admin_role)
        await db.flush()
        logger.info("Seeded super_admin role with %d permissions", len(all_perms))

    # upgrade legacy admin role to super_admin if it exists
    admin_role = (await db.execute(select(Role).where(Role.name == "admin"))).scalar_one_or_none()
    if admin_role:
        admin_role.name = "admin_legacy"
        admin_role.description = "Legacy admin (upgraded to super_admin)"
        await db.flush()
        logger.info("Renamed legacy admin role to admin_legacy")

    user_role = (await db.execute(select(Role).where(Role.name == "user"))).scalar_one_or_none()
    if not user_role:
        user_codes = {"user:read", "role:read", "permission:read", "dept:read", "announcement:read", "media:read", "leave:read", "leave:create", "leave:delete", "employee:read", "employee:update", "asset:read", "consumable:read", "attendance:check-in", "attendance:read"}
        user_perms = [p for p in all_perms if p.code in user_codes]
        user_role = Role(name="user", description="普通用户", role_type="user")
        user_role.permissions = user_perms
        db.add(user_role)
        await db.flush()
        logger.info("Seeded user role with %d permissions", len(user_perms))
    else:
        # update existing user role to have role_type
        if not user_role.role_type or user_role.role_type == "user":
            user_role.role_type = "user"
            logger.info("Updated existing user role role_type")

    dept_admin_role = (await db.execute(select(Role).where(Role.name == "dept_admin"))).scalar_one_or_none()
    if not dept_admin_role:
        dept_codes = {"employee:read", "employee:update", "asset:read", "asset:update", "consumable:read", "consumable:update",
                       "dept:read", "user:read", "leave:read", "announcement:read", "media:read", "media:upload",
                       "attendance:check-in", "attendance:read", "attendance:subordinates:read"}
        dept_perms = [p for p in all_perms if p.code in dept_codes]
        dept_admin_role = Role(name="dept_admin", description="部门管理员", role_type="dept_admin", admin_scope="department")
        dept_admin_role.permissions = dept_perms
        db.add(dept_admin_role)
        await db.flush()
        logger.info("Seeded dept_admin role with %d permissions", len(dept_perms))

    # Seed default portal content (skip if already exists)
    existing_company = await db.execute(select(Setting).where(Setting.key == "company_info"))
    if not existing_company.scalar_one_or_none():
        db.add(Setting(key="company_info", value=DEFAULT_COMPANY_INFO))
        logger.info("Seeded default company info")

    existing_links = await db.execute(select(Setting).where(Setting.key == "quick_links"))
    if not existing_links.scalar_one_or_none():
        db.add(Setting(key="quick_links", value=DEFAULT_QUICK_LINKS))
        logger.info("Seeded default quick links")

    existing_att_config = await db.execute(select(Setting).where(Setting.key == "attendance_config"))
    if not existing_att_config.scalar_one_or_none():
        db.add(Setting(key="attendance_config", value=json.dumps({
            "work_start_time": "09:00",
            "work_end_time": "18:00",
            "late_tolerance_minutes": 0,
            "enable_mandatory_check_in": False,
        })))
        logger.info("Seeded default attendance config")

    existing_ann = await db.execute(select(Announcement).limit(1))
    if not existing_ann.scalar_one_or_none():
        from app.models.user import User
        first_user = (await db.execute(select(User.id).order_by(User.id).limit(1))).scalar_one_or_none()
        if first_user:
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
                author_id=first_user,
                is_pinned=True,
                is_published=True,
                published_at=datetime.now(UTC),
            ))
            logger.info("Seeded welcome announcement")
        else:
            logger.info("Skipped welcome announcement: no users exist")

    # Seed leave approval workflow definition
    existing_wf = await db.execute(select(WorkflowDef).where(WorkflowDef.name == "Leave Approval"))
    if not existing_wf.scalar_one_or_none():
        db.add(WorkflowDef(
            name="Leave Approval",
            description="Standard leave approval: submit → manager review",
            icon="calendar",
            definition={
                "nodes": [
                    {"id": "start", "type": "start", "label": "Submit"},
                    {"id": "admin_approve", "type": "task", "label": "Admin Approval", "assignee_type": "role", "assignee_value": "admin"},
                    {"id": "end_approved", "type": "end", "label": "Approved", "outcome": "approved"},
                    {"id": "end_rejected", "type": "end", "label": "Rejected", "outcome": "rejected"},
                ],
                "transitions": [
                    {"from": "start", "action": "submit", "to": "admin_approve"},
                    {"from": "admin_approve", "action": "approve", "to": "end_approved"},
                    {"from": "admin_approve", "action": "reject", "to": "end_rejected"},
                ],
            },
        ))
        logger.info("Seeded leave approval workflow definition")

    # Seed asset categories
    existing_cat = await db.execute(select(AssetCategory).limit(1))
    if not existing_cat.scalar_one_or_none():
        _seed_asset_categories(db)
        await db.flush()
        logger.info("Seeded asset categories")

    await db.commit()
    logger.info("Seed completed")


def _seed_asset_categories(db: AsyncSession) -> None:
    def _add(parent: AssetCategory | None, name: str, *child_names: str) -> AssetCategory:
        cat = AssetCategory(name=name, parent=parent, sort_order=0)
        db.add(cat)
        for cn in child_names:
            _add(cat, cn)
        return cat

    electronics = _add(None, "电子设备")
    _add(electronics, "电脑", "笔记本", "台式机", "服务器")
    _add(electronics, "打印机")

    furniture = _add(None, "办公家具")
    _add(furniture, "办公桌")
    _add(furniture, "办公椅")
    _add(furniture, "文件柜")

    supplies = _add(None, "耗材")
    _add(supplies, "纸张")
    _add(supplies, "墨盒/硒鼓")
    _add(supplies, "文具")

    living = _add(None, "生活设备")
    _add(living, "饮水机")
    _add(living, "微波炉")


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
