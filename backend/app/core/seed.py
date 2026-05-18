import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import ALL_PERMISSIONS
from app.db.base import AsyncSessionLocal
from app.models.user import Permission, Role

logger = logging.getLogger(__name__)


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
        read_codes = {"user:read", "role:read", "permission:read", "dept:read"}
        user_perms = [p for p in all_perms if p.code in read_codes]
        user_role = Role(name="user", description="Regular user")
        user_role.permissions = user_perms
        db.add(user_role)
        await db.flush()
        logger.info("Seeded user role with %d permissions", len(user_perms))

    await db.commit()
    logger.info("Seed completed")


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await seed_initial_data(session)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
