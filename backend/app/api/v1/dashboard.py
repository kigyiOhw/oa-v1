import logging

from fastapi import APIRouter

from app.api.deps import CurrentUser, DBDep
from app.services.dashboard import DashboardService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=dict)
async def get_dashboard_stats(
    db: DBDep,
    current_user: CurrentUser,
):
    logger.info("----------dashboard.get_stats, start, user_id=%s", current_user.id)
    service = DashboardService(db)
    stats = await service.get_stats(current_user)
    logger.info("----------dashboard.get_stats, done, user_id=%s", current_user.id)
    return {"success": True, "data": stats.model_dump(), "error": None}
