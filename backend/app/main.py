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

from app.api.v1.audit import router as audit_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.announcements import router as announcements_router
from app.api.v1.attendance import router as attendance_router
from app.api.v1.assets import cat_router as asset_categories_router, asset_router
from app.api.v1.auth import router as auth_router
from app.api.v1.contacts import router as contacts_router
from app.api.v1.consumables import router as consumables_router
from app.api.v1.departments import router as departments_router
from app.api.v1.employees import router as employees_router
from app.api.v1.expense import router as expense_router
from app.api.v1.leave import router as leave_router
from app.api.v1.overtime import router as overtime_router
from app.api.v1.media import router as media_router
from app.api.v1.messages import router as messages_router
from app.api.v1.request_types import router as request_types_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.permissions import router as permissions_router
from app.api.v1.roles import router as roles_router
from app.api.v1.settings import router as settings_router
from app.api.v1.users import router as users_router
from app.api.v1.websocket import router as ws_router
from app.api.v1.workflow import router as workflow_router
from app.api.v1.workflow_defs import router as workflow_defs_router
from app.core.audit import register_audit_listener
from app.core.config import settings
from app.core.exceptions import OAException, oa_exception_handler
from app.core.limiter import limiter
from app.core.logging import setup_logging
from app.db.base import engine

logger = logging.getLogger(__name__)


def _register_workflow_hooks() -> None:
    """Register workflow completion hooks (replaces hardcoded engine branches)."""
    from sqlalchemy import select as sa_select

    from app.models.expense_request import ExpenseRequest
    from app.models.leave_request import LeaveRequest
    from app.models.overtime_request import OvertimeRequest
    from app.services.workflow.hooks import register_hook

    async def leave_hook(session, instance):
        from app.services.leave import LeaveService
        leave = (await session.execute(
            sa_select(LeaveRequest).where(LeaveRequest.workflow_instance_id == instance.id)
        )).scalar_one_or_none()
        if leave:
            await LeaveService(session).sync_status(leave)

    async def expense_hook(session, instance):
        from app.services.expense import ExpenseService
        expense = (await session.execute(
            sa_select(ExpenseRequest).where(ExpenseRequest.workflow_instance_id == instance.id)
        )).scalar_one_or_none()
        if expense:
            await ExpenseService(session).sync_status(expense)

    async def overtime_hook(session, instance):
        from app.services.overtime import OvertimeService
        overtime = (await session.execute(
            sa_select(OvertimeRequest).where(OvertimeRequest.workflow_instance_id == instance.id)
        )).scalar_one_or_none()
        if overtime:
            await OvertimeService(session).sync_status(overtime)

    register_hook("leave.sync_status", leave_hook)
    register_hook("expense.sync_status", expense_hook)
    register_hook("overtime.sync_status", overtime_hook)


@asynccontextmanager
async def lifespan(app: FastAPI) -> typing.AsyncGenerator[None, None]:
    setup_logging(log_level="DEBUG" if settings.DEBUG else "INFO")
    register_audit_listener()
    _register_workflow_hooks()
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
    allow_origins=["http://localhost:5307"],
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
app.include_router(attendance_router, prefix="/api/v1")
app.include_router(asset_categories_router, prefix="/api/v1")
app.include_router(asset_router, prefix="/api/v1")
app.include_router(consumables_router, prefix="/api/v1")
app.include_router(contacts_router, prefix="/api/v1")
app.include_router(messages_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(leave_router, prefix="/api/v1")
app.include_router(media_router, prefix="/api/v1")
app.include_router(request_types_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(expense_router, prefix="/api/v1")
app.include_router(overtime_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(ws_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    logger.debug("Health check called")
    return {"status": "ok"}
