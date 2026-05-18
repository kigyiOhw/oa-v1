import logging
import time
import typing
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.responses import Response

from app.api.v1.auth import router as auth_router
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
        "Request start | %s %s | client=%s",
        request.method,
        request.url.path,
        client_host,
    )

    response = await call_next(request)

    duration = (time.time() - start) * 1000
    logger.info(
        "Request end | %s %s | status=%s | duration=%.2fms | client=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration,
        client_host,
    )
    return response


app.include_router(auth_router, prefix="/api/v1")


@app.get("/health")
async def health_check() -> dict[str, str]:
    logger.debug("Health check called")
    return {"status": "ok"}
