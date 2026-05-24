import logging
from contextvars import ContextVar
from datetime import datetime
from typing import Any

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session as SyncSession

from app.models.audit import AuditLog

logger = logging.getLogger(__name__)

_audit_user_id: ContextVar[int | None] = ContextVar("audit_user_id", default=None)
_audit_ip: ContextVar[str] = ContextVar("audit_ip", default="unknown")

AUDITABLE_MODELS: set[str] = {
    "User", "Role", "Permission", "Department",
    "WorkflowDef", "Announcement", "Setting",
    "Asset", "AssetAssignment", "AssetCategory",
    "Consumable", "EmployeeProfile",
    "LeaveRequest", "ExpenseRequest", "OvertimeRequest",
    "WorkflowInstance", "WorkflowTask",
}


def set_audit_context(user_id: int | None, ip: str = "unknown") -> None:
    _audit_user_id.set(user_id)
    _audit_ip.set(ip)


def _serialize_value(v: Any) -> Any:
    if isinstance(v, datetime):
        return v.isoformat()
    return v


def _get_column_values(obj: Any) -> dict[str, Any]:
    insp = sa_inspect(obj)
    return {c.key: _serialize_value(getattr(obj, c.key)) for c in insp.mapper.column_attrs}


def _get_changes(obj: Any) -> dict[str, Any]:
    insp = sa_inspect(obj)
    changes: dict[str, dict[str, Any]] = {}
    for attr in insp.attrs:
        hist = attr.history
        if not hist.has_changes() or attr.key in ("id", "created_at", "updated_at", "created_time", "updated_time"):
            continue
        changes[attr.key] = {
            "old": _serialize_value(hist.deleted[0]) if hist.deleted else None,
            "new": _serialize_value(hist.added[0]) if hist.added else None,
        }
    return changes


def _create_audit_entry(action: str, obj: Any, user_id: int, ip: str) -> AuditLog:
    resource_id = getattr(obj, "id", None)
    if action == "create":
        details = _get_column_values(obj)
    elif action == "update":
        changes = _get_changes(obj)
        if not changes:
            return None  # no tracked fields changed
        details = {"changes": changes}
    else:
        details = _get_column_values(obj)

    return AuditLog(
        user_id=user_id,
        action=action,
        resource_type=type(obj).__name__,
        resource_id=resource_id,
        details=details,
        ip_address=ip,
    )


def _on_after_flush(session: SyncSession, flush_context: Any) -> None:
    user_id = _audit_user_id.get()
    ip = _audit_ip.get()
    logger.debug("_on_after_flush fired | user_id=%s ip=%s new=%s dirty=%s deleted=%s",
                 user_id, ip, len(list(session.new)), len(list(session.dirty)), len(list(session.deleted)))
    if user_id is None:
        return

    entries: list[AuditLog] = []

    for obj in session.new:
        model_name = type(obj).__name__
        if model_name not in AUDITABLE_MODELS:
            continue
        entry = _create_audit_entry("create", obj, user_id, ip)
        if entry:
            entries.append(entry)
            logger.info("Audit: %s %s id=%s by user=%s", entry.action, entry.resource_type, entry.resource_id, user_id)

    for obj in session.dirty:
        model_name = type(obj).__name__
        if model_name not in AUDITABLE_MODELS:
            continue
        entry = _create_audit_entry("update", obj, user_id, ip)
        if entry:
            entries.append(entry)
            logger.info("Audit: %s %s id=%s by user=%s", entry.action, entry.resource_type, entry.resource_id, user_id)

    for obj in session.deleted:
        model_name = type(obj).__name__
        if model_name not in AUDITABLE_MODELS:
            continue
        entry = _create_audit_entry("delete", obj, user_id, ip)
        if entry:
            entries.append(entry)
            logger.info("Audit: %s %s id=%s by user=%s", entry.action, entry.resource_type, entry.resource_id, user_id)

    for entry in entries:
        session.add(entry)


def register_audit_listener() -> None:
    from sqlalchemy import event
    event.listen(SyncSession, "after_flush", _on_after_flush)
    logger.info("Audit listener registered on SQLAlchemy Session.after_flush")
