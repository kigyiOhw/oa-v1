# FULLSTACK_MODULE

You are an expert at scaffolding complete full-stack modules for the OA system. When a new business module is needed (e.g., "Training Management", "Meeting Rooms", "Contract Management"), you create all layers — backend through frontend — following the project's established patterns.

## When to Invoke

Invoke when:
- Adding a completely new business domain module (not just extending an existing one)
- The module needs: model + migration + repository + service + schema + API route + test + frontend pages + API client + i18n
- User says "add a new module for X" or "create X management feature"

## Module Types

### Type A: Workflow-Linked Module (like Leave, Expense, Overtime)
- Has its own request table linked to `workflow_instances.id`
- Status synced from workflow engine on approval
- User pages: list, create, detail, edit
- Admin: typically managed through workflow

### Type B: Admin Management Module (like Asset, Consumable)
- Independent CRUD with admin-only write access
- May have user-facing read-only views
- Admin pages: list, create, detail, edit

### Type C: Self-Service Module (like Attendance, MyProfile)
- User operates on their own data
- Admin may have team/department view

## File Checklist

For a new module named `{module}` (e.g., `training`), create/modify these files:

### Backend (12 files)

| # | File | Action |
|---|------|--------|
| 1 | `backend/app/models/{module}.py` | CREATE — ORM model, SQLAlchemy 2.0 mapped_column style |
| 2 | `backend/app/models/__init__.py` | EDIT — import new model |
| 3 | `backend/alembic/env.py` | EDIT — import new model for autogenerate |
| 4 | `backend/app/repositories/{module}.py` | CREATE — CRUD operations, pagination |
| 5 | `backend/app/schemas/{module}.py` | CREATE — {Module}Create, {Module}Update, {Module}Out |
| 6 | `backend/app/services/{module}.py` | CREATE — business logic, validation |
| 7 | `backend/app/api/v1/{module}.py` | CREATE — REST endpoints, permission guards |
| 8 | `backend/app/main.py` | EDIT — import + include_router |
| 9 | `backend/app/core/permissions.py` | EDIT — add permission enum values |
| 10 | `backend/app/core/seed.py` | EDIT — add permission descriptions + role assignments |
| 11 | `backend/tests/test_{module}.py` | CREATE — pytest-asyncio + httpx AsyncClient |
| 12 | Migration file | GENERATE — `alembic revision --autogenerate` |

### Frontend (5-8 files)

| # | File | Action |
|---|------|--------|
| 1 | `frontend/src/api/{module}.ts` | CREATE — TypeScript types + API functions |
| 2 | `frontend/src/pages/{module}/List.tsx` | CREATE — list page with shadcn Table + pagination |
| 3 | `frontend/src/pages/{module}/Create.tsx` | CREATE — form page with shadcn Input/Select + validation |
| 4 | `frontend/src/pages/{module}/Detail.tsx` | CREATE — detail view (may be combined with Create for edit) |
| 5 | `frontend/src/App.tsx` | EDIT — add routes |
| 6 | `frontend/src/components/AdminLayout.tsx` | EDIT — add nav item (if admin module) |
| 7 | `frontend/src/i18n/locales/zh.json` | EDIT — add translation keys |
| 8 | `frontend/src/i18n/locales/en.json` | EDIT — add translation keys |

### If Workflow-Linked (additional)

| # | File | Action |
|---|------|--------|
| 1 | `backend/app/models/{module}.py` | ADD — `workflow_instance_id` FK field |
| 2 | `backend/app/services/{module}.py` | ADD — `sync_status()` method |
| 3 | `backend/app/services/workflow/engine.py` | EDIT — add sync hook in `process_task()` end node |

## Model Template

```python
from datetime import datetime
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class XxxRequest(Base):
    __tablename__ = "xxx_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    applicant_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # workflow_instance_id for Type A modules:
    # workflow_instance_id: Mapped[int | None] = mapped_column(
    #     Integer, ForeignKey("workflow_instances.id"), nullable=True
    # )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    applicant: Mapped["User"] = relationship("User", foreign_keys=[applicant_id])
```

## Registration Points

When adding a module, these centralized files MUST be updated:

1. **`backend/app/main.py`** — `include_router(xxx_router, prefix="/api/v1")`
2. **`backend/app/core/permissions.py`** — add `XXX_CREATE`, `XXX_READ`, etc. to `Permissions` enum
3. **`backend/app/core/seed.py`** — add permission descriptions + role assignments
4. **`backend/app/core/audit.py`** — add model name to `AUDITABLE_MODELS` set (if it should be audited)
5. **`frontend/src/App.tsx`** — add route(s)
6. **`frontend/src/components/AdminLayout.tsx`** — add nav item (if admin module) with icon + permission

## Verification Checklist

After scaffolding, verify:
1. `uv run alembic revision --autogenerate -m "add xxx"` generates migration correctly
2. `uv run alembic upgrade head` succeeds
3. `uv run python -m app.core.seed` seeds without errors
4. `uv run pytest tests/test_xxx.py -v` passes
5. `npm run build` succeeds (TypeScript check)
6. Module appears in admin sidebar (if admin module)
7. Module pages render without console errors
