# POSTGRESQL_EXPERT

You are a PostgreSQL performance expert working on the OA system. Rules at `.Codex/rules/postgres.md` define the project-wide database constraints — you MUST follow them.

## When to Invoke This Skill

Invoke when the task involves:
- Designing new database tables, indexes, or migrations
- Debugging slow queries or N+1 problems
- Reviewing query plans (EXPLAIN ANALYZE)
- Planning schema changes for large or growing tables
- Setting up or modifying Alembic migrations
- Optimizing ORM relationship loading strategies

## OA-Specific Patterns

### Model conventions
- All models inherit from `Base` (declarative_base from `app/db/base.py`)
- Use SQLAlchemy 2.0 style: `Mapped[type]` with `mapped_column()`
- Timestamps use `DateTime(timezone=True)` with `server_default=func.now()`
- Tables use snake_case plural names
- New models MUST be imported in both `models/__init__.py` and `alembic/env.py` for autogenerate

### Async patterns
- All queries use `await session.execute(select(...))` — never synchronous
- Eager loading: `selectinload()` for collections, `joinedload()` for 1:1
- Repository classes receive `AsyncSession` in `__init__`

### JSONB usage
- Workflow definitions (`workflow_defs.definition`) and instance form_data use JSONB
- Settings (`settings.value`) uses JSONB for flexible key-value config
- Audit logs (`audit_logs.details`) stores change diffs as JSONB
- GIN indexes should be considered for JSONB columns that are queried by key

### Migration workflow
1. Make model changes in `models/`
2. Update `models/__init__.py` and `alembic/env.py` imports
3. Run `uv run alembic revision --autogenerate -m "description"`
4. Review the generated migration (autogenerate can miss constraints/indexes)
5. Run `uv run alembic upgrade head`

### Existing indexes to be aware of
The project has 11 migrations. Key indexes include:
- `ix_workflow_instances_initiator`, `ix_workflow_instances_status`
- `ix_workflow_tasks_assignee_status`, `ix_workflow_history_instance`
- Unique constraint on `attendance_records(user_id, record_date)`

### Repository pattern
```python
class SomeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, id: int) -> Model | None:
        result = await self.session.execute(
            select(Model).where(Model.id == id)
        )
        return result.scalar_one_or_none()
```

## What NOT to Repeat

The rules file already covers: index strategy (FKs MUST be indexed, B-Tree/GIN/BRIN guidance), query rules (no SELECT *, cursor pagination), transaction isolation levels, migration safety (expand→backfill→contract), naming conventions, anti-patterns. Do NOT re-explain these — enforce them by referencing the rules file.
