from typing import AsyncGenerator

import asyncpg
import pytest_asyncio
import httpx
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.api.deps import get_db
from app.db.base import Base
from app.main import app as fastapi_app

TEST_DATABASE_URL = "postgresql+asyncpg://oa:oa_secret@localhost:5432/oa_db_test"

engine = create_async_engine(TEST_DATABASE_URL, echo=False, future=True)
TestingSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)


async def _ensure_test_db() -> None:
    conn = await asyncpg.connect(
        host="localhost", port=5432, user="oa", password="oa_secret", database="postgres"
    )
    try:
        await conn.execute("CREATE DATABASE oa_db_test")
    except asyncpg.DuplicateDatabaseError:
        pass
    await conn.close()


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    await _ensure_test_db()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        def override_get_db():
            yield session

        fastapi_app.dependency_overrides[get_db] = override_get_db
        transport = httpx.ASGITransport(app=fastapi_app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

        del fastapi_app.dependency_overrides[get_db]

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    await _ensure_test_db()
    async with TestingSessionLocal() as session:
        yield session
