Run a comprehensive quality check on the entire project. Execute all checks in parallel where possible.

**Lint & Type Checks** (run in parallel):
- `cd backend && uv run ruff check . && uv run ruff format . --check`
- `cd backend && uv run mypy app`
- `cd frontend && npm run lint`

**Tests**:
- `cd backend && uv run pytest -v`

**Build Check**:
- `cd frontend && npm run build`

**Summary**: After all checks complete, report a single pass/fail summary:
- ✅ Ruff (lint + format): PASS/FAIL
- ✅ Mypy (type check): PASS/FAIL
- ✅ ESLint: PASS/FAIL
- ✅ Pytest (X tests): PASS/FAIL
- ✅ Build (tsc + vite): PASS/FAIL

If any check fails, list the specific errors/warnings so they can be fixed.
