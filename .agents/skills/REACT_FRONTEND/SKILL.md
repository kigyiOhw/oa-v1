# REACT_FRONTEND

You are an expert on the OA system's React/TypeScript frontend architecture.

## When to Invoke

Invoke when the task involves:
- Creating new pages or modifying existing page components
- Adding or changing routes in App.tsx
- Working with Zustand stores (auth, theme, notification)
- Modifying AdminLayout navigation or sidebar
- Adding i18n translation keys (zh.json / en.json)
- Creating or modifying shadcn/ui component usage
- Working with API client modules (axios)
- Setting up WebSocket connections
- Implementing PermissionGuard / ProtectedRoute logic

## Key Files

| File | Role |
|------|------|
| `src/App.tsx` | Root component — ALL route definitions live here |
| `src/main.tsx` | Entry point — BrowserRouter + StrictMode |
| `src/api/client.ts` | Axios instance — baseURL, auth interceptor, 401 auto-refresh |
| `src/stores/auth.ts` | Auth state, JWT tokens, hasPermission(), getAdminLevel() |
| `src/stores/theme.ts` | Background theme (color/gradient/image), localStorage persistence |
| `src/stores/notification.ts` | Notification CRUD, unread count, real-time push |
| `src/components/AdminLayout.tsx` | Dark sidebar (bg-slate-900), 13 nav items, collapsible |
| `src/components/ProtectedRoute.tsx` | Redirects to /login if not authenticated |
| `src/components/PermissionGuard.tsx` | Redirects to / if missing permission |
| `src/hooks/useNotificationSocket.ts` | WebSocket auto-connect, exponential backoff reconnection |

## Route Architecture

```
/                       → Dashboard (public — no ProtectedRoute)
/login, /register       → Auth pages
/admin/*                → AdminLayout + ProtectedRoute + PermissionGuard per child
  /admin/users, /admin/roles, /admin/departments, ...
  /admin/assets, /admin/assets/new, /admin/assets/:id, /admin/assets/:id/edit
  /admin/consumables, /admin/consumables/new, /admin/consumables/:id, ...
  /admin/audit-logs, /admin/settings, /admin/attendance-config, ...
/workflow/*             → ProtectedRoute only (no AdminLayout)
/leaves/*, /expenses/*, /overtimes/* → ProtectedRoute
/attendance/*           → ProtectedRoute (team routes need PermissionGuard)
/profile, /my-assets    → ProtectedRoute
/notifications, /contacts → ProtectedRoute
```

## Adding a New Page Checklist

1. Create page component in `src/pages/<module>/`
2. Create API client in `src/api/<module>.ts` (follow existing pattern)
3. Add i18n keys to `src/i18n/locales/zh.json` and `en.json`
4. Add route in `src/App.tsx`:
   - Admin page: nest under `/admin` with `ProtectedRoute` → `AdminLayout` → `PermissionGuard`
   - User page: wrap in `ProtectedRoute` directly
5. If admin: add nav item in `src/components/AdminLayout.tsx` (with permission check + icon)
6. If needed: add permission string to `src/stores/auth.ts` (already comes from backend)

## Zustand Store Pattern

```typescript
import { create } from 'zustand'

interface XxxState {
  data: SomeType | null
  isLoading: boolean
  fetchData: () => Promise<void>
}

export const useXxxStore = create<XxxState>((set, get) => ({
  data: null,
  isLoading: false,
  fetchData: async () => {
    set({ isLoading: true })
    try {
      const res = await someApi.get()
      set({ data: res.data })
    } finally {
      set({ isLoading: false })
    }
  },
}))
```

For persistent state, follow `auth.ts` pattern: manual localStorage read on init, write in setters.

## i18n Pattern

- All user-visible strings use `t('namespace.key')` via `useTranslation()`
- Translation files are flat JSON objects organized by module namespace
- Naming convention: `moduleName.componentKey` (e.g., `admin.users`, `leave.title`)
- Both `zh.json` and `en.json` must be updated together

## Permission Model (Frontend)

- `useAuthStore.hasPermission(permission)` — checks user.permissions array
- `getAdminLevel(user)` → 'super_admin' | 'module_admin' | 'dept_admin' | 'user'
- Superusers bypass all permission checks
- PermissionGuard redirects to `/` on failure (not a 403 page)
