"""Base class for workflow-backed request services.

Leave, Expense, and Overtime services share ~80% identical code for
draft CRUD + submit/cancel/sync_status. This base class extracts the
common patterns. Subclasses override only the few differences:
  - model / repo / workflow_name
  - _build_create / _apply_update / _build_title / _build_form_data
  - _on_status_synced (optional hook, e.g. attendance sync for leave)
"""

import logging
from typing import Any, Generic, TypeVar

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import OAException
from app.models.user import User
from app.repositories.workflow_def import WorkflowDefRepository
from app.schemas.workflow import StartInstanceRequest
from app.services.workflow import WorkflowEngineService

logger = logging.getLogger(__name__)

M = TypeVar("M")  # Model (LeaveRequest | ExpenseRequest | OvertimeRequest)
C = TypeVar("C")  # Create schema
U = TypeVar("U")  # Update schema


class DraftWorkflowService(Generic[M, C, U]):
    """Base for any request type that flows through a workflow."""

    # -- Subclass overrides --------------------------------------------------
    model: type[M]
    workflow_name: str

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = None  # type: ignore[assignment]  # set in subclass
        self.def_repo = WorkflowDefRepository(session)

    # -- Helpers ------------------------------------------------------------

    async def _get_or_404(self, obj_id: int) -> M:
        obj = await self.repo.get_by_id(obj_id)  # type: ignore[union-attr]
        if not obj:
            raise OAException("Not found", status_code=404)
        return obj

    async def _check_owner(self, obj: Any, user: User) -> None:
        if obj.user_id != user.id:
            raise OAException("Access denied", status_code=403)

    def _check_draft(self, obj: Any) -> None:
        if obj.status != "draft":
            raise OAException("Only draft requests allowed", status_code=400)

    # -- Hook points (override in subclass) ---------------------------------

    def _build_create(self, user: User, data: C) -> M:
        """Build model instance from create data. Override in subclass."""
        raise NotImplementedError

    def _apply_update(self, obj: M, data: U) -> None:
        """Apply update fields to model instance. Override in subclass."""
        raise NotImplementedError

    def _build_title(self, user: User, obj: M) -> str:
        """Build workflow instance title. Override in subclass."""
        raise NotImplementedError

    def _build_form_data(self, obj: M) -> dict:
        """Build form_data dict for workflow instance. Override in subclass."""
        raise NotImplementedError

    async def _on_status_synced(self, obj: M, old_status: str) -> None:
        """Optional hook called after status sync (e.g. attendance update)."""

    # -- Shared CRUD ---------------------------------------------------------

    async def list_my(
        self, user: User, model_name: str, status: str | None, page: int, page_size: int
    ) -> tuple[list[M], int]:
        logger.info("DraftWorkflowService.list_my | %s | user=%s status=%s page=%s",
                    model_name, user.id, status, page)
        items, total = await self.repo.get_by_user(user.id, status, page, page_size)  # type: ignore[union-attr]
        logger.info("DraftWorkflowService.list_my | %s | done total=%s", model_name, total)
        return items, total

    async def get(self, obj_id: int) -> M:
        return await self._get_or_404(obj_id)

    async def create_draft(self, user: User, data: C) -> M:
        obj = self._build_create(user, data)
        result = await self.repo.create(obj)  # type: ignore[union-attr]
        logger.info("DraftWorkflowService.create_draft | done id=%s", result.id)
        return result

    async def update_draft(self, user: User, obj_id: int, data: U) -> M:
        obj = await self._get_or_404(obj_id)
        await self._check_owner(obj, user)
        self._check_draft(obj)
        self._apply_update(obj, data)
        result = await self.repo.update(obj)  # type: ignore[union-attr]
        logger.info("DraftWorkflowService.update_draft | done id=%s", obj_id)
        return result

    async def delete_draft(self, user: User, obj_id: int) -> None:
        obj = await self._get_or_404(obj_id)
        await self._check_owner(obj, user)
        self._check_draft(obj)
        await self.repo.delete(obj)  # type: ignore[union-attr]
        logger.info("DraftWorkflowService.delete_draft | done id=%s", obj_id)

    async def submit(self, user: User, obj_id: int) -> M:
        obj = await self._get_or_404(obj_id)
        await self._check_owner(obj, user)
        self._check_draft(obj)

        wf_def = await self.def_repo.get_by_name(self.workflow_name)
        if not wf_def:
            raise OAException(f"Workflow definition '{self.workflow_name}' not found", status_code=500)

        title = self._build_title(user, obj)
        form_data = self._build_form_data(obj)

        engine = WorkflowEngineService(self.session)
        instance = await engine.start_instance(
            user,
            StartInstanceRequest(workflow_def_id=wf_def.id, title=title, form_data=form_data),
        )

        obj.workflow_instance_id = instance.id  # type: ignore[attr-defined]
        obj.status = "submitted"  # type: ignore[attr-defined]
        result = await self.repo.update(obj)  # type: ignore[union-attr]
        logger.info("DraftWorkflowService.submit | done id=%s instance=%s", obj_id, instance.id)
        return result

    async def cancel(self, user: User, obj_id: int) -> M:
        obj = await self._get_or_404(obj_id)
        await self._check_owner(obj, user)
        if obj.status not in ("submitted", "pending"):  # type: ignore[attr-defined]
            raise OAException("Cannot cancel this request", status_code=400)
        if not obj.workflow_instance_id:  # type: ignore[attr-defined]
            raise OAException("No workflow instance associated", status_code=500)

        engine = WorkflowEngineService(self.session)
        await engine.cancel_instance(user, obj.workflow_instance_id)  # type: ignore[attr-defined]

        obj.status = "cancelled"  # type: ignore[attr-defined]
        result = await self.repo.update(obj)  # type: ignore[union-attr]
        logger.info("DraftWorkflowService.cancel | done id=%s", obj_id)
        return result

    async def sync_status(self, obj: M) -> M:
        if not obj.workflow_instance_id:  # type: ignore[attr-defined]
            return obj

        from app.repositories.workflow_instance import WorkflowInstanceRepository

        instance_repo = WorkflowInstanceRepository(self.session)
        instance = await instance_repo.get_by_id(obj.workflow_instance_id)  # type: ignore[attr-defined]
        if instance and instance.status in ("approved", "rejected", "cancelled"):
            old_status = obj.status  # type: ignore[attr-defined]
            logger.info("DraftWorkflowService.sync_status | id=%s from=%s to=%s",
                        obj.id, old_status, instance.status)  # type: ignore[attr-defined]
            obj.status = instance.status  # type: ignore[attr-defined]
            await self.repo.update(obj)  # type: ignore[union-attr]
            await self._on_status_synced(obj, old_status)

        return obj
