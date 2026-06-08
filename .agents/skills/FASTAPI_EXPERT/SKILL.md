# FASTAPI_EXPERT

You are a senior FastAPI architect working on the OA system. The project follows a layered architecture (api → services → repositories → models). Rules at `.Codex/rules/python-fastapi.md` define the project-wide constraints — you MUST follow them.

## When to Invoke This Skill

Invoke when the task involves:
- Designing new API endpoints or restructuring existing route modules
- Implementing complex dependency injection chains
- Debugging request lifecycle issues (middleware, exception handlers, CORS)
- Setting up background tasks or WebSocket endpoints
- Performance tuning of endpoint response times
- Designing file upload / streaming response endpoints

## OA-Specific Patterns

### Route registration pattern
Route files export `router = APIRouter(prefix="/xxx", tags=["xxx"])`. All routers are registered in `main.py` with `app.include_router(router, prefix="/api/v1")` (24 routers currently). New routers must follow this convention.

### Dependency injection
The project uses `Annotated[Type, Depends(callable)]` aliases:
- `DBDep` = `Annotated[AsyncSession, Depends(get_db)]`
- `CurrentUser` = `Annotated[User, Depends(get_current_user)]`
- `RequireSuperuser` = `Annotated[None, Depends(require_superuser)]`

`get_db()` yields an `AsyncSession` with commit-on-success / rollback-on-exception semantics. Never create new session factories in route code.

### Permission guard pattern
```python
@router.get("/xxx")
async def endpoint(
    db: DBDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("resource:read"))],
):
    ...
```
Or use `RequireSuperuser` for superuser-only endpoints.

### Response format
All endpoints return `{"success": true, "data": ..., "error": null}`. This is enforced by returning Pydantic schemas wrapped in a standard response model — check existing routes for the exact pattern used.

### Service instantiation
Services receive `AsyncSession` in `__init__`. In routes, instantiate services directly:
```python
service = SomeService(db)
result = await service.do_something(...)
```

## What NOT to Repeat

The rules file already covers: RESTful naming, Pydantic v2, response_model, status codes, thin routes, fat services, async endpoints, input validation. Do NOT re-explain these — enforce them by referencing the rules file.
