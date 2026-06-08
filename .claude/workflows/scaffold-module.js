export const meta = {
  name: 'scaffold-module',
  description: 'Scaffold a complete full-stack business module (model + repo + service + schema + route + test + frontend pages + API client + i18n)',
  phases: [
    { title: 'Plan', detail: 'Determine module type, name, and file list' },
    { title: 'Backend Core', detail: 'Model, repository, schema, service' },
    { title: 'Backend API', detail: 'Route, permissions, seed, main.py registration' },
    { title: 'Frontend Core', detail: 'API client, pages, i18n keys' },
    { title: 'Register & Verify', detail: 'Route registration, migration, build check' },
  ],
}

// args should be: { moduleName: "training", moduleType: "admin" | "workflow" | "self-service" }
// If not provided, we need to ask the user
const moduleName = args?.moduleName
const moduleType = args?.moduleType

if (!moduleName) {
  throw new Error('Missing required arg: moduleName. Pass via Workflow args: { moduleName: "training", moduleType: "admin" }')
}

// Phase 1: Plan
phase('Plan')
log(`Scaffolding module: "${moduleName}" (type: ${moduleType || 'admin'})`)

const plan = await agent(
  `Plan the module scaffolding for "${moduleName}" with type "${moduleType || 'admin'}".

  Determine:
  1. The snake_case table name (e.g., "training_records")
  2. The PascalCase class prefix (e.g., "TrainingRecord")
  3. The camelCase variable prefix (e.g., "trainingRecord")
  4. Which permissions are needed (create/read/update/delete)
  5. Whether it needs a workflow_instance_id FK (only for type "workflow")
  6. Whether it needs admin pages, user pages, or both

  Read the FULLSTACK_MODULE skill file first for the complete checklist.
  Return a structured plan with file paths and key decisions.`,
  { label: 'plan', schema: {
    type: 'object',
    properties: {
      tableName: { type: 'string' },
      className: { type: 'string' },
      varName: { type: 'string' },
      permissions: { type: 'array', items: { type: 'string' } },
      needsWorkflowLink: { type: 'boolean' },
      hasAdminPages: { type: 'boolean' },
      hasUserPages: { type: 'boolean' },
      backendFiles: { type: 'array', items: { type: 'string' } },
      frontendFiles: { type: 'array', items: { type: 'string' } },
    },
    required: ['tableName', 'className', 'varName', 'permissions', 'needsWorkflowLink', 'hasAdminPages', 'hasUserPages', 'backendFiles', 'frontendFiles'],
  }}
)

log(`Table: ${plan.tableName}, Class: ${plan.className}`)
log(`Backend files to create: ${plan.backendFiles.length}, Frontend: ${plan.frontendFiles.length}`)

// Phase 2: Backend Core (model + repo + schema + service — sequential dependency chain)
phase('Backend Core')
log('Creating backend core files...')

const backendCore = await pipeline(
  ['model', 'schema', 'repository', 'service'],
  (layer) => agent(
    `Create the ${layer} file for the "${moduleName}" module.

    Plan context:
    - Table name: ${plan.tableName}
    - Class name: ${plan.className}
    - Variable name: ${plan.varName}
    - Needs workflow link: ${plan.needsWorkflowLink}

    Follow the patterns in the FULLSTACK_MODULE skill for the ${layer} template.
    Read existing similar files (e.g., leave_request.py for workflow-linked, asset.py for admin modules) as reference.
    Write the COMPLETE file — all imports, all methods, logging on every method.
    Return the file path created.`,
    { label: `${layer}` }
  )
)

log(`Backend core files created: ${backendCore.filter(Boolean).join(', ')}`)

// Phase 3: Backend API (route + permissions + seed + main.py)
phase('Backend API')
log('Creating API route and registering...')

const backendApi = await pipeline(
  ['route', 'register'],
  (step) => agent(
    step === 'route'
      ? `Create the API route file for "${moduleName}".
         - Plan context: permissions=${plan.permissions.join(', ')}, className=${plan.className}
         - Follow existing route patterns (thin routes, call service, return standard response).
         - Write the COMPLETE file with all CRUD endpoints.
         Return the file path.`
      : `Register the "${moduleName}" module:
         1. Add permissions to backend/app/core/permissions.py (${plan.permissions.join(', ')})
         2. Add permission descriptions to backend/app/core/seed.py
         3. Import and register router in backend/app/main.py
         4. If auditable, add to AUDITABLE_MODELS in backend/app/core/audit.py
         Return what was modified.`,
    { label: `${step}` }
  )
)

log(`Backend API: ${backendApi.filter(Boolean).join(' | ')}`)

// Phase 4: Frontend (API client + pages + i18n — can run in parallel after backend is done)
phase('Frontend Core')
log('Creating frontend files...')

const frontend = await parallel([
  () => agent(
    `Create the API client module at frontend/src/api/${moduleName}.ts.
     - Plan context: className=${plan.className}, varName=${plan.varName}
     - Follow existing API client patterns (e.g., api/leave.ts or api/asset.ts).
     - Include TypeScript interfaces and all API functions.
     Return the file path.`,
    { label: 'api client' }
  ),
  () => agent(
    `Add i18n translation keys for the "${moduleName}" module.
     - Add to frontend/src/i18n/locales/zh.json (Chinese)
     - Add to frontend/src/i18n/locales/en.json (English)
     - Include keys for: title, list, create, edit, delete, fields, status labels, buttons.
     Return what was added.`,
    { label: 'i18n' }
  ),
])

log(`Frontend core: ${frontend.filter(Boolean).join(' | ')}`)

if (plan.hasAdminPages || plan.hasUserPages) {
  log('Creating page components...')
  const pages = await parallel([
    plan.hasAdminPages ? () => agent(
      `Create admin list page at frontend/src/pages/${moduleName}/List.tsx.
       - Use shadcn Table component, pagination, search input.
       - Follow existing patterns (e.g., pages/admin/Assets.tsx).
       Return the file path.`,
      { label: 'admin list page' }
    ) : null,
    plan.hasAdminPages || plan.hasUserPages ? () => agent(
      `Create form page at frontend/src/pages/${moduleName}/Form.tsx.
       - Use shadcn Input/Select/Textarea components.
       - Follow existing form patterns (e.g., AssetCreate or LeaveCreate).
       - Support both create and edit modes.
       Return the file path.`,
      { label: 'form page' }
    ) : null,
  ].filter(Boolean))

  log(`Pages: ${pages.filter(Boolean).join(', ')}`)
}

// Phase 5: Register routes and generate migration
phase('Register & Verify')
log('Registering frontend routes and generating migration...')

const finalSteps = await parallel([
  () => agent(
    `Register frontend routes for "${moduleName}":
     1. Add route(s) in frontend/src/App.tsx
     2. If admin module: add nav item in frontend/src/components/AdminLayout.tsx
     3. Add appropriate ProtectedRoute / PermissionGuard wrappers
     Return what was modified.`,
    { label: 'frontend routes' }
  ),
  () => agent(
    `Update model imports and generate database migration:
     1. Import new model in backend/app/models/__init__.py
     2. Import new model in backend/alembic/env.py
     3. Run: cd backend && uv run alembic revision --autogenerate -m "add ${plan.tableName}"
     Return the migration file created.`,
    { label: 'migration' }
  ),
])

log(`Final steps: ${finalSteps.filter(Boolean).join(' | ')}`)

// Verification
log('Running verification...')
const verify = await agent(
  `Verify the "${moduleName}" module scaffolding:
   1. Check all expected files exist
   2. Run: cd frontend && npm run build (quick TypeScript check only)
   3. Report any missing pieces or errors

  Expected backend files: ${plan.backendFiles.join(', ')}
  Expected frontend files: ${plan.frontendFiles.join(', ')}`,
  { label: 'verify' }
)

log(`Verification: ${verify}`)

return {
  moduleName,
  plan,
  backendCore,
  backendApi,
  frontend,
  verify,
}
