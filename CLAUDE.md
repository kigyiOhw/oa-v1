# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Enterprise OA (Office Automation) system centered around configurable approval workflows. Currently in **Phase 1** (basic skeleton): auth is implemented, workflow engine is planned but not yet built.

## Common Commands

### Infrastructure
```bash
docker-compose up -d          # Start PostgreSQL 16 + Redis 7
```

### Backend (Python/FastAPI, use `uv` as package manager)
```bash
cd backend
uv pip install -e ".[dev]"    # Install dependencies (first time)
uv run uvicorn app.main:app --reload --port 8000   # Dev server
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
npm run dev                   # Dev server on :5173, proxies /api to :8000
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

### Configuration

`backend/app/core/config.py` uses `pydantic-settings` with `.env` file support, case-sensitive. Defaults point to the docker-compose services (`oa:oa_secret@localhost:5432/oa_db`).

### Frontend

- **State**: Zustand store (`stores/auth.ts`) for auth state + token persistence in localStorage.
- **Routing**: React Router v6, currently Dashboard `/`, Login `/login`, Register `/register`.
- **API**: Axios instance with interceptors for token injection and 401 refresh handling.
- **Proxy**: Vite dev server proxies `/api` → `localhost:8000` and `/ws` → `ws://localhost:8000`.

### Database

Current migration (0001_initial) creates: `users`, `roles`, `user_roles` (many-to-many). All models use `Base = declarative_base()` from `db/base.py`. New models must be imported in `alembic/env.py` for autogenerate to detect them.

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `sqlalchemy[asyncio]` + `asyncpg` | Async PostgreSQL via SQLAlchemy 2.0 |
| `python-jose` | JWT creation/validation |
| `passlib[bcrypt]` | Password hashing |
| `alembic` | Database migrations |
| `redis` + `websockets` | Planned for real-time notifications (not yet wired) |
| `ruff` / `mypy` | Linting (E, F, I, N, W, UP, B, C4, SIM rules) / strict type checking |

## Runtime Rules

### Architecture Constraints

NEVER:
- put business logic in FastAPI routes
- access database directly from routes
- commit transactions inside repositories
- mix sync and async DB access
- introduce new architectural patterns without checking existing code

ALWAYS:
- keep routes thin
- keep business logic in services
- keep repositories persistence-only
- search existing implementation patterns before adding new code

Repositories:
- MUST use flush()
- MUST NOT call commit()
- MUST NOT call rollback()

Services:
- own transaction boundaries
- define atomic operations

Reason:
workflow operations must remain atomic.

---

### Testing Rules

Tests MUST be isolated.

NEVER:
- allow tests to hit development database
- use real DATABASE_URL during tests
- rely on manually created local test databases

ALWAYS:
- override get_db dependencies in tests
- use dedicated test sessions
- verify dependency overrides work correctly

Auth flows requiring test coverage:
- register
- login
- refresh token
- disabled users
- invalid tokens

---

### Authentication Rules

NEVER:
- leak whether username/email exists
- trust refresh JWT without DB validation

ALWAYS:
- use generic auth failure messages
- validate refresh user against database
- verify user active state during refresh

Refresh flow MUST:
1. decode JWT
2. validate token type
3. load user from database
4. verify user exists
5. verify user is active
6. issue new access token

---

### Async Rules

NEVER:
- run CPU-heavy synchronous work in async endpoints
- run bcrypt directly inside event loop

ALWAYS:
- wrap bcrypt/password hashing using asyncio.to_thread()

---

### SQLAlchemy Rules

ALWAYS:
- use SQLAlchemy 2.0 style
- use select()
- use async sessions

NEVER:
- use legacy Query API
- use implicit lazy loading
- create ORM N+1 queries
- use SELECT *

PREFER:
- selectinload
- joinedload

---

### Migration Rules

Models and migrations MUST remain consistent.

ALWAYS:
- ensure server_default matches model definitions
- make migrations reversible

NEVER:
- manually change models without migration updates
- create dangerous ALTER TABLE blindly

---

### Exception Rules

Use domain exceptions consistently.

NEVER:
- randomly mix HTTPException and custom exceptions

ALWAYS:
- keep business exceptions in service layer
- keep HTTP translation in API layer

---

### Frontend Rules

ALWAYS:
- provide 404 route
- use ErrorBoundary
- use Suspense for lazy routes

NEVER:
- leave blank screens on unknown routes
- reference missing static assets

---

### API Protection Rules

Authentication endpoints MUST have:
- rate limiting
- brute-force protection
