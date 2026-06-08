"""Workflow completion hook registry.

Modules register callbacks keyed by hook name.
When a workflow instance reaches an end node, the engine looks up
the hook name in the registry and calls the callback.

Hook signature: async def callback(session, instance) -> None
"""

import logging
from collections.abc import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import WorkflowInstance

logger = logging.getLogger(__name__)

HookFn = Callable[[AsyncSession, WorkflowInstance], Awaitable[None]]

_registry: dict[str, HookFn] = {}


def register_hook(name: str, fn: HookFn) -> None:
    """Register a completion hook."""
    if name in _registry:
        logger.warning("Hook '%s' already registered — overwriting", name)
    _registry[name] = fn
    logger.info("Hook registered: %s", name)


def get_hook(name: str) -> HookFn | None:
    """Look up a hook by name. Returns None if not found."""
    return _registry.get(name)
