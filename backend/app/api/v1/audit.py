import logging
from datetime import datetime

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBDep, require_permission
from app.schemas.audit import PaginatedAuditLogs
from app.services.audit import AuditService

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])
logger = logging.getLogger(__name__)


@router.get("", response_model=PaginatedAuditLogs)
async def list_audit_logs(
    db: DBDep,
    current_user: CurrentUser,
    _: None = require_permission("audit:read"),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedAuditLogs:
    logger.info(
        "audit-logs.list user_id=%s action=%s resource_type=%s page=%s",
        current_user.id, action, resource_type, page,
    )
    service = AuditService(db)
    items, total = await service.list_logs(
        action=action,
        resource_type=resource_type,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )
    logger.info("audit-logs.list done total=%s", total)
    return PaginatedAuditLogs(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
