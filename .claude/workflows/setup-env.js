export const meta = {
  name: 'setup-env',
  description: 'One-click development environment startup: Docker → migrations → seed → servers',
  phases: [
    { title: 'Infrastructure', detail: 'Start PostgreSQL + Redis via Docker Compose' },
    { title: 'Database', detail: 'Run migrations and seed data' },
    { title: 'Servers', detail: 'Start backend and frontend dev servers' },
    { title: 'Verify', detail: 'Health check and dev server status' },
  ],
}

// Phase 1: Start infrastructure
phase('Infrastructure')
log('Starting Docker Compose (PostgreSQL 16 + Redis 7)...')
const dockerResult = await agent(
  'Run: docker-compose up -d. Wait for both services to be healthy. Report status.',
  { label: 'docker-compose up' }
)
log(`Docker: ${dockerResult}`)

// Phase 2: Database setup
phase('Database')
log('Running database migrations...')
const migrateResult = await agent(
  'Run: cd backend && uv run alembic upgrade head. Report any errors or "already up to date".',
  { label: 'alembic upgrade' }
)
log(`Migrations: ${migrateResult}`)

log('Seeding initial data...')
const seedResult = await agent(
  'Run: cd backend && uv run python -m app.core.seed. Report permissions, roles, and admin user created.',
  { label: 'seed data' }
)
log(`Seed: ${seedResult}`)

// Phase 3: Start servers in parallel
phase('Servers')
log('Starting backend and frontend in parallel...')
const servers = await parallel([
  () => agent(
    'Start the FastAPI backend: cd backend && uv run uvicorn app.main:app --reload --port 8000. Run in background. Note the URL.',
    { label: 'backend server' }
  ),
  () => agent(
    'Start the React frontend: cd frontend && npm run dev. Run in background. Note the URL and any warnings.',
    { label: 'frontend server' }
  ),
])

log(`Backend: ${servers[0]}`)
log(`Frontend: ${servers[1]}`)

// Phase 4: Verify
phase('Verify')
log('Running health checks...')
const healthResult = await agent(
  'Run: curl -s http://localhost:8000/health. Confirm it returns {"status":"ok"}. Also check http://localhost:5173 is reachable.',
  { label: 'health check' }
)
log(`Health: ${healthResult}`)

return {
  docker: dockerResult,
  migration: migrateResult,
  seed: seedResult,
  backend: servers[0],
  frontend: servers[1],
  health: healthResult,
}
