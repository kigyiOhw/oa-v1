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
