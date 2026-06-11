import logging

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DBDep
from app.schemas.workflow import (
    PaginatedInstances,
    PaginatedTasks,
    ProcessTaskRequest,
    StartInstanceRequest,
    WorkflowInstanceDetailOut,
    WorkflowInstanceOut,
    WorkflowTaskDetailOut,
    WorkflowTaskOut,
)
from app.services.workflow import WorkflowEngineService

router = APIRouter(prefix="/workflow", tags=["workflow"])
logger = logging.getLogger(__name__)


@router.post("/instances", response_model=WorkflowInstanceOut, status_code=status.HTTP_201_CREATED)
async def start_instance(
    data: StartInstanceRequest,
    db: DBDep,
    current_user: CurrentUser,
) -> WorkflowInstanceOut:
    logger.info("----------workflow.start_instance, start, user_id=%s, def_id=%s", current_user.id, data.workflow_def_id)
    service = WorkflowEngineService(db)
    result = await service.start_instance(current_user, data)
    logger.info("----------workflow.start_instance, done, instance_id=%s, user_id=%s", result.id, current_user.id)
    return result


@router.get("/instances", response_model=PaginatedInstances)
async def list_my_instances(
    db: DBDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedInstances:
    logger.info("----------workflow.list_my_instances, start, user_id=%s, page=%s", current_user.id, page)
    service = WorkflowEngineService(db)
    items, total = await service.get_my_instances(current_user, page, page_size)
    logger.info("----------workflow.list_my_instances, done, user_id=%s, total=%s", current_user.id, total)
    return PaginatedInstances(
        items=[WorkflowInstanceOut.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/instances/{instance_id}", response_model=WorkflowInstanceDetailOut)
async def get_instance_detail(
    instance_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> WorkflowInstanceDetailOut:
    logger.info("----------workflow.get_instance_detail, start, instance_id=%s, user_id=%s", instance_id, current_user.id)
    service = WorkflowEngineService(db)
    result = await service.get_instance_detail(current_user, instance_id)
    logger.info("----------workflow.get_instance_detail, done, instance_id=%s", instance_id)
    return result


@router.post("/instances/{instance_id}/cancel", response_model=WorkflowInstanceOut)
async def cancel_instance(
    instance_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> WorkflowInstanceOut:
    logger.info("----------workflow.cancel_instance, start, instance_id=%s, user_id=%s", instance_id, current_user.id)
    service = WorkflowEngineService(db)
    result = await service.cancel_instance(current_user, instance_id)
    logger.info("----------workflow.cancel_instance, done, instance_id=%s", instance_id)
    return result


@router.get("/tasks", response_model=PaginatedTasks)
async def list_my_tasks(
    db: DBDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> PaginatedTasks:
    logger.info("----------workflow.list_my_tasks, start, user_id=%s, page=%s", current_user.id, page)
    service = WorkflowEngineService(db)
    items, total = await service.get_my_tasks(current_user, page, page_size)
    logger.info("----------workflow.list_my_tasks, done, user_id=%s, total=%s", current_user.id, total)
    return PaginatedTasks(
        items=[WorkflowTaskOut.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/tasks/{task_id}", response_model=WorkflowTaskDetailOut)
async def get_task_detail(
    task_id: int,
    db: DBDep,
    current_user: CurrentUser,
) -> WorkflowTaskDetailOut:
    logger.info("----------workflow.get_task_detail, start, task_id=%s, user_id=%s", task_id, current_user.id)
    service = WorkflowEngineService(db)
    result = await service.get_task_detail(current_user, task_id)
    logger.info("----------workflow.get_task_detail, done, task_id=%s", task_id)
    return result


@router.post("/tasks/{task_id}/approve", response_model=WorkflowTaskOut)
async def approve_task(
    task_id: int,
    data: ProcessTaskRequest,
    db: DBDep,
    current_user: CurrentUser,
) -> WorkflowTaskOut:
    logger.info("----------workflow.approve_task, start, task_id=%s, user_id=%s", task_id, current_user.id)
    service = WorkflowEngineService(db)
    result = await service.process_task(current_user, task_id, "approve", data)
    logger.info("----------workflow.approve_task, done, task_id=%s", task_id)
    return result


@router.post("/tasks/{task_id}/reject", response_model=WorkflowTaskOut)
async def reject_task(
    task_id: int,
    data: ProcessTaskRequest,
    db: DBDep,
    current_user: CurrentUser,
) -> WorkflowTaskOut:
    logger.info("----------workflow.reject_task, start, task_id=%s, user_id=%s", task_id, current_user.id)
    service = WorkflowEngineService(db)
    result = await service.process_task(current_user, task_id, "reject", data)
    logger.info("----------workflow.reject_task, done, task_id=%s", task_id)
    return result
