# FastAPI Rules (Claude Code)

## API Design Rules

- Use RESTful naming conventions
- Route files must be thin
- Always use Pydantic schemas for request/response
- Always return consistent response format:

{
  "success": true,
  "data": ...,
  "error": null
}

---

## Dependency Injection Rules

- Use Depends() for all external dependencies
- Never instantiate DB sessions inside routes
- Services should receive dependencies via constructor or parameters

---

## File Structure Rules

/api
  v1/
    user.py
    auth.py

/services
  user_service.py

/repositories
  user_repository.py

---

## Business Logic Rules

- Business logic must live in services/
- Never put logic in routers
- Services should be reusable and testable without FastAPI

---

## Error Handling

- Use centralized exception handlers
- Never return raw exceptions to client
- Convert all errors to HTTPException or custom error format