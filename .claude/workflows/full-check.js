export const meta = {
  name: 'full-check',
  description: 'Comprehensive quality check: lint, type-check, tests, build — all in parallel',
  phases: [
    { title: 'Lint & Type Check', detail: 'ruff, mypy, eslint in parallel' },
    { title: 'Tests', detail: 'Backend pytest suite' },
    { title: 'Build Check', detail: 'Frontend TypeScript compilation + build' },
    { title: 'Report', detail: 'Aggregate and summarize all results' },
  ],
}

// Phase 1: Lint and type checking (all parallel, no dependencies)
phase('Lint & Type Check')
log('Running lint and type checks in parallel...')

const checks = await parallel([
  () => agent(
    'Run: cd backend && uv run ruff check . && uv run ruff format . --check. Report any lint errors or formatting issues. Return "PASS" or list failures.',
    { label: 'ruff check' }
  ),
  () => agent(
    'Run: cd backend && uv run mypy app. Report any type errors. Return "PASS" or list failures.',
    { label: 'mypy' }
  ),
  () => agent(
    'Run: cd frontend && npm run lint. Report any ESLint errors or warnings. Return "PASS" or list failures.',
    { label: 'eslint' }
  ),
])

const ruffResult = checks[0]
const mypyResult = checks[1]
const eslintResult = checks[2]

log(`Ruff: ${ruffResult}`)
log(`Mypy: ${mypyResult}`)
log(`ESLint: ${eslintResult}`)

// Phase 2: Backend tests
phase('Tests')
log('Running backend test suite...')
const testResult = await agent(
  'Run: cd backend && uv run pytest -v. Report total tests, passed, failed, and any error details. Return summary.',
  { label: 'pytest' }
)
log(`Tests: ${testResult}`)

// Phase 3: Frontend build check
phase('Build Check')
log('Checking frontend TypeScript compilation...')
const buildResult = await agent(
  'Run: cd frontend && npm run build. This checks TypeScript types AND produces a production build. Report success or list type errors.',
  { label: 'npm build' }
)
log(`Build: ${buildResult}`)

// Phase 4: Summary report
phase('Report')
log('=== QUALITY CHECK SUMMARY ===')

const allPass = [ruffResult, mypyResult, eslintResult, testResult, buildResult]
  .every(r => r && r.toLowerCase().includes('pass'))

const summary = await agent(
  `Generate a summary of the quality check results:

  - Ruff (lint + format): ${ruffResult}
  - Mypy (type check): ${mypyResult}
  - ESLint: ${eslintResult}
  - Pytest: ${testResult}
  - Build (tsc + vite): ${buildResult}

  Overall: ${allPass ? 'ALL CHECKS PASSED ✅' : 'SOME CHECKS FAILED ❌'}

  If any failed, list the failures and suggest fixes.`,
  { label: 'summary' }
)

return {
  lint: { ruff: ruffResult, mypy: mypyResult, eslint: eslintResult },
  tests: testResult,
  build: buildResult,
  allPass,
  summary,
}
