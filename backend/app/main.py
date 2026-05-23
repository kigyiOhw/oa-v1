import logging
import os
import time
import typing
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.responses import Response

from app.api.v1.announcements import router as announcements_router
from app.api.v1.assets import cat_router as asset_categories_router, asset_router
from app.api.v1.auth import router as auth_router
from app.api.v1.consumables import router as consumables_router
from app.api.v1.departments import router as departments_router
from app.api.v1.employees import router as employees_router
from app.api.v1.leave import router as leave_router
from app.api.v1.media import router as media_router
from app.api.v1.permissions import router as permissions_router
from app.api.v1.roles import router as roles_router
from app.api.v1.settings import router as settings_router
from app.api.v1.users import router as users_router
from app.api.v1.websocket import router as ws_router
from app.api.v1.workflow import router as workflow_router
from app.api.v1.workflow_defs import router as workflow_defs_router
from app.core.config import settings
from app.core.exceptions import OAException, oa_exception_handler
from app.core.limiter import limiter
from app.core.logging import setup_logging
from app.db.base import engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> typing.AsyncGenerator[None, None]:
    setup_logging(log_level="DEBUG" if settings.DEBUG else "INFO")
    logger.info("=" * 50)
    logger.info("Application starting up | name=%s debug=%s", settings.APP_NAME, settings.DEBUG)
    logger.info("Database URL: %s", settings.DATABASE_URL.replace("://", "://***@"))
    logger.info("=" * 50)
    yield
    logger.info("Application shutting down")
    await engine.dispose()
    logger.info("Database engine disposed")


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(OAException, oa_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(
    request: Request,
    call_next: typing.Callable[[Request], typing.Awaitable[Response]],
) -> Response:
    start = time.time()
    client_host = request.client.host if request.client else "unknown"
    logger.info(
        "----------log_requests, request_start, method=%s, path=%s, client=%s",
        request.method, request.url.path, client_host,
    )

    response = await call_next(request)

    duration = (time.time() - start) * 1000
    logger.info(
        "----------log_requests, request_end, method=%s, path=%s, status=%s, duration=%.2fms, client=%s",
        request.method, request.url.path, response.status_code, duration, client_host,
    )
    return response


os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.UPLOAD_DIR), name="media")

app.include_router(auth_router, prefix="/api/v1")
app.include_router(departments_router, prefix="/api/v1")
app.include_router(employees_router, prefix="/api/v1")
app.include_router(permissions_router, prefix="/api/v1")
app.include_router(roles_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(workflow_defs_router, prefix="/api/v1")
app.include_router(workflow_router, prefix="/api/v1")
app.include_router(announcements_router, prefix="/api/v1")
app.include_router(asset_categories_router, prefix="/api/v1")
app.include_router(asset_router, prefix="/api/v1")
app.include_router(consumables_router, prefix="/api/v1")
app.include_router(leave_router, prefix="/api/v1")
app.include_router(media_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(ws_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    logger.debug("Health check called")
    return {"status": "ok"}
