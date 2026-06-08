Start the complete OA development environment.

**Steps** (execute in order):
1. Start infrastructure: `docker-compose up -d` — ensure PostgreSQL 16 + Redis 7 are healthy
2. Run migrations: `cd backend && uv run alembic upgrade head`
3. Seed data: `cd backend && uv run python -m app.core.seed`
4. Start backend: `cd backend && uv run uvicorn app.main:app --reload --port 8000`
5. Start frontend: `cd frontend && npm run dev`
6. Health check: `curl http://localhost:8000/health` should return `{"status":"ok"}`

After all steps complete, report:
- ✅ Docker services running
- ✅ Migrations applied
- ✅ Seed data loaded
- ✅ Backend at http://localhost:8000 (Swagger at /docs)
- ✅ Frontend at http://localhost:5173

If any step fails, stop and report the error before continuing.
