# CLAUDE.md
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Enterprise OA (Office Automation) system centered around configurable approval workflows. See PLAN.md for current phase status and roadmap.

## Common Commands

### Infrastructure
```bash
docker-compose up -d          # Start PostgreSQL 16 + Redis 7
```

### Backend (Python/FastAPI, use `uv` as package manager)
```bash
cd backend
uv pip install -e ".[dev]"    # Install dependencies (first time)
uv run uvicorn app.main:app --reload --port 8402   # Dev server
uv run python -m app.core.seed # Seed initial data (first time)
uv run alembic upgrade head   # Run migrations
uv run alembic revision --autogenerate -m "desc"   # Generate migration
uv run alembic downgrade -1   # Rollback one migration
uv run pytest                 # Run tests
uv run ruff check .           # Lint
uv run ruff format .          # Format
uv run mypy app               # Type check
```

### Frontend (React/TypeScript)
```bash
cd frontend
npm install                   # Install dependencies (first time)
npm run dev                   # Dev server on :5307, proxies /api to :8402
npm run build                 # Production build
npm run lint                  # ESLint
```

## Architecture

### Backend Layered Design
```
api/v1/       → Route definitions, parameter parsing, response assembly. No business logic.
services/     → Business logic. Service classes take AsyncSession in __init__.
repositories/ → Database CRUD, one class per model. Takes AsyncSession in __init__.
models/       → SQLAlchemy ORM models (declarative Base from db/base.py).
schemas/      → Pydantic models for request/response validation.
core/         → Config (pydantic-settings, reads .env), security utils.
db/           → Async engine, session factory (async_sessionmaker), Base.
utils/        → General helpers (password hashing, JWT encode/decode).
```

### Dependency Injection Pattern
FastAPI's `Annotated` + `Depends` is the standard DI approach:
- `DBDep` — yields an `AsyncSession` from `get_db()`
- `CurrentUser` — decodes JWT, looks up `User`, raises 401 on failure

New dependencies should follow this pattern.

### Auth
JWT access/refresh token pair. Access token expires in 30 min, refresh in 7 days. The Axios interceptor in `frontend/src/api/client.ts` auto-refreshes on 401. Passwords hashed with bcrypt via passlib.

### RBAC & Admin Hierarchy (Phase 8)
Roles have a `role_type` field: `super_admin` (full access), `module_admin` (module-scoped, with `admin_scope` global/department), `dept_admin` (department-scoped), `user` (self-service). `is_super_admin(user)` in `core/permissions.py` checks both `is_superuser` flag and `role_type`. `get_admin_scope(user)` returns `AdminScope(scope, dept_id)` for department-level data isolation. Employee and Asset list APIs auto-filter by department for dept_admin users. Frontend `getAdminLevel(user)` in `stores/auth.ts` mirrors this for menu visibility.

### Configuration
`backend/app/core/config.py` uses `pydantic-settings` with `.env` file support, case-sensitive. Defaults point to the docker-compose services (`oa:oa_secret@localhost:5432/oa_db`).

### Frontend
- **State**: Zustand stores — `auth.ts` (auth state + token persistence), `notification.ts` (persistent notifications synced with backend API), `theme.ts` (background theme: color/gradient/image, persisted to localStorage).
- **Routing**: React Router v6 — Dashboard `/`, Login `/login`, Register `/register`, Profile `/profile`, MyAssets `/my-assets`, Workflow (`/workflow/my`, `/workflow/tasks`, `/workflow/tasks/:id`, `/workflow/instances/:id`), Leaves (`/leaves`, `/leaves/new`, `/leaves/:id`, `/leaves/:id/edit`), Expenses (`/expenses`, `/expenses/new`, `/expenses/:id`, `/expenses/:id/edit`), Overtimes (`/overtimes`, `/overtimes/new`, `/overtimes/:id`, `/overtimes/:id/edit`), Attendance (`/attendance`, `/attendance/team`, `/attendance/team/:userId`), Notifications (`/notifications`), Contacts (`/contacts`), Admin (`/admin/*` including `/admin/users`, `/admin/roles` (with wizard for role type/scope), `/admin/departments`, `/admin/workflow-defs`, `/admin/announcements`, `/admin/media`, `/admin/employees`, `/admin/employees/:id`, `/admin/assets`, `/admin/assets/new`, `/admin/assets/:id`, `/admin/assets/:id/edit`, `/admin/asset-categories`, `/admin/consumables`, `/admin/consumables/new`, `/admin/consumables/:id`, `/admin/consumables/:id/edit`, `/admin/settings`, `/admin/attendance-config`, `/admin/audit-logs`).
- **Components**: `ThemeSwitcher` (floating FAB for background customization), `NotificationBell` (fixed bell with unread badge + dropdown, bottom-left), `LanguageSwitcher` (EN/中 toggle), `ErrorBoundary`, `ProtectedRoute`, `PermissionGuard`, `AdminLayout`.
- **API**: Axios instance with interceptors for token injection and 401 refresh handling.
- **Proxy**: Vite dev server proxies `/api` → `127.0.0.1:8402` and `/ws` → `ws://127.0.0.1:8402`.

### Database
All models use `Base = declarative_base()` from `db/base.py`. New models must be imported in `alembic/env.py` for autogenerate to detect them.

Tables: `users`, `roles` (incl. `role_type`, `admin_scope` from Phase 8), `permissions`, `role_permissions`, `user_roles`, `departments`, `workflow_defs`, `workflow_instances`, `workflow_tasks`, `workflow_history`, `announcements`, `media_files`, `settings`, `leave_requests`, `employee_profiles`, `asset_categories`, `assets`, `asset_assignments`, `consumables`, `consumable_records`, `attendance_records` (Phase 9), `notifications` (Phase 10), `expense_requests` (Phase 11), `overtime_requests` (Phase 11), `audit_logs` (Phase 12).

## Key Dependencies
| Package | Purpose |
|---------|---------|
| `sqlalchemy[asyncio]` + `asyncpg` | Async PostgreSQL via SQLAlchemy 2.0 |
| `python-jose` | JWT creation/validation |
| `passlib[bcrypt]` | Password hashing |
| `alembic` | Database migrations |
| `redis` + `websockets` | Real-time notifications via WebSocket (wired in Phase 5) |
| `ruff` / `mypy` | Linting (E, F, I, N, W, UP, B, C4, SIM rules) / strict type checking |


# Rule Priority
MUST rules override all other instructions
SHOULD rules are recommendations
NICE rules are optional

# 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

## Before implementing:
State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.

# 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

# 3. Surgical Changes
Touch only what you must. Clean up only your own mess.

## When editing existing code:
Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

# 4. Goal-Driven Execution
Define success criteria. Loop until verified.

## Transform tasks into verifiable goals:
"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"

## For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
