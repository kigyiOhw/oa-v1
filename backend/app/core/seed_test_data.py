"""
Seed test/demo data for all phases.

Covers:
- Phase 1-2: Departments, Users with roles, Employee profiles (Phase 6 auto-create)
- Phase 3: Workflow instances + tasks
- Phase 4: Announcements, Media files
- Phase 5: Leave requests
- Phase 6: Employee onboarding data, some resigned employees
- Phase 7: Assets, asset assignments, consumables, stock records

Run: uv run python -m app.core.seed_test_data
"""
import asyncio
import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import ALL_PERMISSIONS
from app.db.base import AsyncSessionLocal
from app.models.announcement import Announcement
from app.models.asset import Asset, AssetAssignment, AssetCategory
from app.models.consumable import Consumable, ConsumableRecord
from app.models.department import Department
from app.models.employee import EmployeeProfile
from app.models.leave_request import LeaveRequest
from app.models.media import MediaFile
from app.models.setting import Setting
from app.models.user import Permission, Role, User, user_roles as user_roles_table
from app.models.workflow import WorkflowDef, WorkflowHistory, WorkflowInstance, WorkflowTask
from app.utils.security import get_password_hash_async

logger = logging.getLogger(__name__)

PASSWORD_HASH = None  # cached after first hash

DEPARTMENTS = [
    {"name": "技术部", "description": "负责产品研发和技术架构"},
    {"name": "产品部", "description": "负责产品设计和需求管理"},
    {"name": "市场部", "description": "负责市场推广和品牌运营"},
    {"name": "人事部", "description": "负责人力资源和员工关系"},
    {"name": "财务部", "description": "负责财务管理和成本控制"},
]

USERS = [
    # (username, email, full_name, dept_index)
    ("zhangsan", "zhangsan@oa.com", "张三", 0),
    ("lisi", "lisi@oa.com", "李四", 0),
    ("wangwu", "wangwu@oa.com", "王五", 0),
    ("zhaoliu", "zhaoliu@oa.com", "赵六", 1),
    ("sunqi", "sunqi@oa.com", "孙七", 1),
    ("zhouba", "zhouba@oa.com", "周八", 1),
    ("wujiu", "wujiu@oa.com", "吴九", 2),
    ("zhengshi", "zhengshi@oa.com", "郑十", 2),
    ("liuyi", "liuyi@oa.com", "刘一", 2),
    ("chener", "chener@oa.com", "陈二", 3),
    ("yangsan", "yangsan@oa.com", "杨三", 3),
    ("huangsi", "huangsi@oa.com", "黄四", 3),
    ("xuawu", "xuawu@oa.com", "许五", 4),
    ("heliu", "heliu@oa.com", "何六", 4),
    ("lvqi", "lvqi@oa.com", "吕七", 4),
    ("shiba", "shiba@oa.com", "施八", 0),
    ("zhangjiu", "zhangjiu@oa.com", "张九", 1),
    ("kongshi", "kongshi@oa.com", "孔十", 2),
    ("caoyi", "caoyi@oa.com", "曹一", 3),
    ("yaner", "yaner@oa.com", "严二", 4),
    ("huasan", "huasan@oa.com", "华三", 0),
    ("jinsi", "jinsi@oa.com", "金四", 1),
    ("weiwu", "weiwu@oa.com", "魏五", 2),
    ("taoliu", "taoliu@oa.com", "陶六", 3),
    ("jiangqi", "jiangqi@oa.com", "姜七", 4),
]

ANNOUNCEMENTS = [
    {"title": "关于2026年端午节放假安排的通知", "content": "根据国家法定节假日安排，端午节假期为6月9日至6月11日，共3天。请各部门做好工作安排。", "is_pinned": True},
    {"title": "OA系统已上线 — 使用指南", "content": "新OA系统已正式上线，支持请假、审批、公告等功能。请在「个人档案」页面完善个人信息。如有问题请联系技术支持。", "is_pinned": True},
    {"title": "第二季度绩效考核通知", "content": "第二季度绩效考核将于6月25日开始，请各部门主管提前准备考核材料。考核结果将影响年终奖金评定。", "is_pinned": False},
    {"title": "办公环境优化项目启动", "content": "公司将对办公区域进行改造升级，包括增加休息区、优化空调系统、更换部分办公桌椅。预计7月中旬完工。", "is_pinned": False},
    {"title": "新员工入职培训安排", "content": "6月新员工入职培训定于6月15日上午9:00在3楼会议室举行，请相关新员工准时参加。", "is_pinned": False},
    {"title": "服务器例行维护公告", "content": "技术部计划于6月18日凌晨2:00-4:00进行服务器例行维护，届时OA系统将短暂不可用。", "is_pinned": False},
    {"title": "团建活动报名通知", "content": "公司年度团建活动定于7月1日在郊区拓展基地举行，活动内容包括团队协作和户外烧烤。请于6月20日前完成报名。", "is_pinned": False},
    {"title": "报销流程优化说明", "content": "即日起报销流程简化为三步：提交发票 → 部门审批 → 财务放款。支持手机拍照上传发票，电子发票可直接导入。", "is_pinned": False},
]

LEAVE_TYPES = ["annual", "sick", "personal", "other"]
LEAVE_REASONS = {
    "annual": ["年假休息", "家庭旅游", "回老家探亲", "带孩子出游"],
    "sick": ["感冒发烧", "肠胃不适", "头痛就诊", "牙科检查", "体检"],
    "personal": ["家里有事", "办理证件", "搬家", "参加婚礼"],
    "other": ["调休", "产检陪护", "事假处理"],
}


async def seed_test_data(db: AsyncSession) -> None:
    global PASSWORD_HASH
    if PASSWORD_HASH is None:
        PASSWORD_HASH = await get_password_hash_async("password123")

    # ── Departments ──
    existing_depts = (await db.execute(select(Department.id).limit(1))).first()
    if existing_depts:
        logger.info("Test data already exists — skipping")
        return

    dept_objs: list[Department] = []
    for d in DEPARTMENTS:
        dept = Department(name=d["name"], description=d["description"])
        db.add(dept)
        dept_objs.append(dept)
    await db.flush()
    logger.info("Seeded %d departments", len(dept_objs))

    # ── Users + Employee Profiles ──
    user_role = (await db.execute(select(Role).where(Role.name == "user"))).scalar_one()
    users: list[User] = []
    for username, email, full_name, dept_idx in USERS:
        user = User(
            username=username,
            email=email,
            hashed_password=PASSWORD_HASH,
            full_name=full_name,
            department_id=dept_objs[dept_idx].id,
        )
        db.add(user)
        await db.flush()

        # Auto-create employee profile
        db.add(EmployeeProfile(user_id=user.id))
        await db.flush()

        # Assign user role via association table (avoids lazy-loading issue)
        await db.execute(
            user_roles_table.insert().values(user_id=user.id, role_id=user_role.id)
        )

        users.append(user)
    await db.flush()
    logger.info("Seeded %d users with profiles", len(users))

    # ── Complete onboarding for first 20 users ──
    education_levels = ["bachelor", "master", "doctor", "bachelor", "associate"]
    schools = ["清华大学", "北京大学", "浙江大学", "复旦大学", "上海交通大学"]
    for i, user in enumerate(users[:20]):
        profile = (await db.execute(
            select(EmployeeProfile).where(EmployeeProfile.user_id == user.id)
        )).scalar_one()
        profile.phone = f"138{10000000 + i:08d}"[:11]
        profile.address = f"北京市朝阳区某某路{i+1}号"
        profile.birthday = date(1985 + (i % 10), (i % 12) + 1, (i % 28) + 1)
        profile.work_experience = f"{5 + i % 15}年工作经验，曾在{'互联网' if i % 2 == 0 else '金融'}行业任职"
        profile.graduation_school = schools[i % len(schools)]
        profile.education_level = education_levels[i % len(education_levels)]
        profile.onboarding_complete = True
    await db.flush()
    logger.info("Completed onboarding for 20 users")

    # ── Resign 2 employees ──
    for i in range(20, 22):
        profile = (await db.execute(
            select(EmployeeProfile).where(EmployeeProfile.user_id == users[i].id)
        )).scalar_one()
        profile.employment_status = "resigned"
        profile.resignation_date = date.today() - timedelta(days=30 + i)
    await db.flush()
    logger.info("Set 2 employees as resigned")

    # ── Manager relationships ──
    # Users[0] manages users[1..3], Users[4] manages users[5..7], etc.
    for i, user in enumerate(users):
        if i % 5 != 0:
            manager_idx = (i // 5) * 5
            user.manager_id = users[manager_idx].id
    await db.flush()
    logger.info("Set up manager relationships")

    # ── Workflow Instances + Tasks ──
    wf = (await db.execute(select(WorkflowDef).where(WorkflowDef.name == "Leave Approval"))).scalar_one()

    for i in range(25):
        initiator = users[i % len(users)]
        is_approved = i % 3 == 0
        is_rejected = i % 7 == 0
        is_pending = not (is_approved or is_rejected)

        status = "pending" if is_pending else ("approved" if is_approved else "rejected")
        current_node = "admin_approve" if is_pending else ("end_approved" if is_approved else "end_rejected")

        instance = WorkflowInstance(
            workflow_def_id=wf.id,
            title=f"请假申请 — {initiator.full_name}",
            initiator_id=initiator.id,
            status=status,
            current_node_id=current_node,
            form_data={"leave_type": "annual", "days": i % 5 + 1},
        )
        db.add(instance)
        await db.flush()

        if is_pending:
            # One pending task assigned to admin
            task = WorkflowTask(
                instance_id=instance.id,
                node_id="admin_approve",
                assignee_id=users[0].id,  # 张三 gets all pending tasks
                status="pending",
            )
            db.add(task)
        else:
            # Completed task + history
            task = WorkflowTask(
                instance_id=instance.id,
                node_id="admin_approve",
                assignee_id=users[0].id,
                status="completed",
                comment="同意" if is_approved else "材料不符合要求",
            )
            db.add(task)
            await db.flush()

            history = WorkflowHistory(
                instance_id=instance.id,
                node_id="admin_approve",
                action="approve" if is_approved else "reject",
                comment="同意" if is_approved else "材料不符合要求",
                operator_id=users[0].id,
            )
            db.add(history)
    await db.flush()
    logger.info("Seeded 25 workflow instances with tasks and history")

    # ── Leave Requests ──
    for i in range(30):
        user = users[i % len(users)]
        ltype = LEAVE_TYPES[i % 4]
        reason_pool = LEAVE_REASONS.get(ltype, ["其他原因"])
        start = date.today() + timedelta(days=(i % 30) + 1)
        duration = (i % 5) + 1

        if i < 5:
            status = "draft"
        elif i < 12:
            status = "submitted"
        elif i < 22:
            status = "approved"
        elif i < 27:
            status = "rejected"
        else:
            status = "cancelled"

        leave = LeaveRequest(
            user_id=user.id,
            leave_type=ltype,
            start_date=start,
            end_date=start + timedelta(days=duration - 1),
            duration_days=duration,
            reason=reason_pool[i % len(reason_pool)],
            status=status,
        )
        db.add(leave)
    await db.flush()
    logger.info("Seeded 30 leave requests across all statuses")

    # ── Announcements ──
    for i, ann in enumerate(ANNOUNCEMENTS):
        db.add(Announcement(
            title=ann["title"],
            content=ann["content"],
            author_id=users[0].id,
            is_pinned=ann["is_pinned"],
            is_published=True,
            published_at=datetime.now(UTC) - timedelta(days=i * 3),
        ))
    await db.flush()
    logger.info("Seeded %d announcements", len(ANNOUNCEMENTS))

    # ── Media files ──
    media_data = [
        ("公司活动照片", "company-photo-1.jpg", "image/jpeg", "/media/company-photo-1.jpg"),
        ("年会视频", "annual-dinner.mp4", "video/mp4", "/media/annual-dinner.mp4"),
        ("团建合影", "team-building.jpg", "image/jpeg", "/media/team-building.jpg"),
        ("办公室环境", "office-photo.jpg", "image/jpeg", "/media/office-photo.jpg"),
    ]
    for title, filename, mime_type, filepath in media_data:
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
        db.add(MediaFile(
            title=title,
            file_path=filepath,
            file_type=ext,
            file_size=1024 * 100,
            mime_type=mime_type,
            uploaded_by=users[0].id,
        ))
    await db.flush()
    logger.info("Seeded %d media files", len(media_data))

    await db.commit()
    logger.info("=== All Phase 1-6 test data seeded successfully ===")


async def seed_phase7_data(db: AsyncSession) -> None:
    """Seed Phase 7 test data (assets + consumables). Safe to call repeatedly."""
    existing_asset = (await db.execute(select(Asset.id).limit(1))).first()
    if existing_asset:
        logger.info("Phase 7 test data already exists — skipping")
        return

    # Get existing data needed for FK references
    users = list((await db.execute(select(User))).scalars().all())
    depts = list((await db.execute(select(Department))).scalars().all())
    if not users or not depts:
        logger.info("Phase 7 test data requires existing users and departments — skipping")
        return

    # Ensure asset categories exist
    existing_cat = (await db.execute(select(AssetCategory.id).limit(1))).first()
    if not existing_cat:
        _seed_asset_categories(db)
        await db.flush()

    categories = list((await db.execute(select(AssetCategory))).scalars().all())
    cat_map: dict[str, int] = {}
    for c in categories:
        cat_map[c.name] = c.id
    _walk_children(categories, cat_map)

    laptop_cat = cat_map.get("笔记本", categories[0].id)
    desktop_cat = cat_map.get("台式机", categories[0].id)
    printer_cat = cat_map.get("打印机", categories[0].id)
    desk_cat = cat_map.get("办公桌", categories[0].id)
    chair_cat = cat_map.get("办公椅", categories[0].id)
    cabinet_cat = cat_map.get("文件柜", categories[0].id)
    water_cat = cat_map.get("饮水机", categories[0].id)

    ASSET_DATA = [
        ("ThinkPad X1 Carbon", laptop_cat, "idle", None, None, "联想", 8999.00, '{"color":"black","ram":"16GB","storage":"512GB SSD"}'),
        ("MacBook Pro 14", laptop_cat, "in_use", 0, None, "Apple", 14999.00, '{"color":"space gray","ram":"16GB","storage":"512GB SSD"}'),
        ("Dell OptiPlex 7090", desktop_cat, "in_use", 1, None, "Dell", 6500.00, '{"cpu":"i7-11700","ram":"32GB"}'),
        ("HP LaserJet Pro", printer_cat, "idle", None, 1, "HP", 3500.00, '{"type":"laser","color":false,"duplex":true}'),
        ("Brother MFC-L8690", printer_cat, "repairing", None, None, "Brother", 4200.00, '{"type":"laser","color":true}'),
        ("工位办公桌 A-101", desk_cat, "in_use", 2, None, "震旦", 1200.00, '{"material":"laminate","size":"140x70cm"}'),
        ("工位办公桌 A-102", desk_cat, "in_use", 3, None, "震旦", 1200.00, '{"material":"laminate","size":"140x70cm"}'),
        ("人体工学椅 ERGO-1", chair_cat, "in_use", 4, None, "网易严选", 899.00, '{"material":"mesh","armrest":"3D adjustable"}'),
        ("人体工学椅 ERGO-2", chair_cat, "idle", None, None, "网易严选", 899.00, '{"material":"mesh","armrest":"3D adjustable"}'),
        ("钢制文件柜 FG-001", cabinet_cat, "in_use", 0, 0, "钢之杰", 1800.00, '{"doors":4,"color":"gray","size":"180x90x40cm"}'),
        ("钢制文件柜 FG-002", cabinet_cat, "idle", None, 3, "钢之杰", 1800.00, '{"doors":4,"color":"gray","size":"180x90x40cm"}'),
        ("美的饮水机 MYR930", water_cat, "in_use", None, 0, "美的", 599.00, '{"type":"hot+cold","capacity":"18L"}'),
        ("iPhone 15 测试机", laptop_cat, "scrapped", None, None, "Apple", 7999.00, '{"color":"blue","storage":"256GB"}'),
        ('Samsung 显示器 27"', laptop_cat, "idle", None, 2, "Samsung", 2499.00, '{"size":"27inch","resolution":"4K","panel":"IPS"}'),
        ('Dell 显示器 24"', laptop_cat, "in_use", 5, None, "Dell", 1599.00, '{"size":"24inch","resolution":"1080p","panel":"IPS"}'),
    ]

    # Pre-compute category prefix map
    cat_prefix: dict[str, str] = {}
    for c in categories:
        cat_prefix[c.name] = _category_prefix(c.name)

    assets: list[Asset] = []
    for i, (name, cat_id, status, user_idx, dept_idx, supplier, price, spec) in enumerate(ASSET_DATA):
        cat = next((c for c in categories if c.id == cat_id), None)
        prefix = cat_prefix.get(cat.name, "GEN") if cat else "GEN"
        asset_code = f"{prefix}-2026-{i+1:03d}"
        asset = Asset(
            name=name,
            category_id=cat_id,
            asset_code=asset_code,
            status=status,
            department_id=depts[dept_idx].id if dept_idx is not None else None,
            current_user_id=users[user_idx].id if user_idx is not None else None,
            supplier=supplier,
            purchase_price=price,
            purchase_date=date.today() - timedelta(days=30 + len(assets) * 5),
            specification=spec,
            description=None,
        )
        db.add(asset)
        assets.append(asset)
    await db.flush()
    logger.info("Seeded %d assets", len(assets))

    # Asset assignments
    assign_records = 0
    for asset in assets:
        if asset.current_user_id:
            db.add(AssetAssignment(
                asset_id=asset.id,
                user_id=asset.current_user_id,
                action="assign",
                action_date=date.today() - timedelta(days=15),
                notes="新领用",
                operator_id=users[0].id,
            ))
            assign_records += 1
    await db.flush()
    logger.info("Seeded %d asset assignment records", assign_records)

    # Consumables
    paper_cat = cat_map.get("纸张", categories[0].id)
    ink_cat = cat_map.get("墨盒/硒鼓", categories[0].id)
    stationery_cat = cat_map.get("文具", categories[0].id)

    CONSUMABLE_DATA = [
        ("A4 复印纸 (70g)", paper_cat, "箱", 50, 10, "Double A 500张/包, 5包/箱"),
        ("A3 复印纸 (80g)", paper_cat, "箱", 8, 5, "Double A 500张/包, 5包/箱"),
        ("HP 56A 硒鼓", ink_cat, "个", 15, 3, "适用于 HP LaserJet Pro"),
        ("Brother TN-3480 墨粉", ink_cat, "个", 3, 5, "适用于 Brother MFC 系列"),
        ("晨光中性笔 0.5mm", stationery_cat, "盒", 200, 50, "黑色, 12支/盒"),
        ("得力笔记本 B5", stationery_cat, "本", 80, 20, "软抄本, 60页"),
        ("得力文件夹 A4", stationery_cat, "个", 40, 10, "蓝色, 双夹"),
        ("透明胶带", stationery_cat, "卷", 60, 15, "宽 18mm, 长 30m"),
    ]

    consumables: list[Consumable] = []
    for name, cat_id, unit, stock, safety, desc in CONSUMABLE_DATA:
        c = Consumable(
            name=name,
            category_id=cat_id,
            unit=unit,
            current_stock=stock,
            safety_stock=safety,
            description=desc,
        )
        db.add(c)
        consumables.append(c)
    await db.flush()
    logger.info("Seeded %d consumables", len(consumables))

    # Stock records
    for c in consumables:
        db.add(ConsumableRecord(
            consumable_id=c.id,
            type="in",
            quantity=c.current_stock + c.safety_stock,
            operator_id=users[0].id,
            record_date=date.today() - timedelta(days=30),
            notes="首次入库",
        ))
        if c.current_stock > 0:
            db.add(ConsumableRecord(
                consumable_id=c.id,
                type="out",
                quantity=c.safety_stock,
                operator_id=users[4].id if len(users) > 4 else users[0].id,
                record_date=date.today() - timedelta(days=7),
                notes="日常领用",
            ))
    await db.flush()
    logger.info("Seeded consumable stock records")
    logger.info("=== Phase 7 test data seeded ===")


def _seed_asset_categories(db: AsyncSession) -> None:
    """Create the asset category tree (same structure as seed.py)."""

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


def _walk_children(categories: list[AssetCategory], cat_map: dict[str, int]) -> None:
    """Walk the category tree and add child/grandchild names to the lookup map."""
    for parent in categories:
        children = [c for c in categories if c.parent_id == parent.id]
        for child in children:
            cat_map[child.name] = child.id
            grandchildren = [c for c in categories if c.parent_id == child.id]
            for gc in grandchildren:
                cat_map[gc.name] = gc.id


def _category_prefix(name: str) -> str:
    """Map category name to asset code prefix."""
    mapping = {
        "电脑": "IT", "笔记本": "NB", "台式机": "DT", "服务器": "SV",
        "打印机": "PR", "办公桌": "DSK", "办公椅": "CHR", "文件柜": "CAB",
        "饮水机": "WTR", "微波炉": "MWV", "纸张": "PAP", "墨盒/硒鼓": "INK", "文具": "STY",
    }
    return mapping.get(name, "GEN")


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await seed_test_data(session)
        await seed_phase7_data(session)
        await session.commit()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
