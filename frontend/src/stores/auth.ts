import { create } from 'zustand'

export interface RoleInfo {
  id: number
  name: string
  role_type: string
  admin_scope: string | null
}

interface User {
  id: number
  username: string
  email: string
  full_name: string | null
  is_active: boolean
  is_superuser: boolean
  department_id: number | null
  roles: RoleInfo[]
  permissions: string[]
}

export function getAdminLevel(user: User | null): 'super_admin' | 'module_admin' | 'dept_admin' | 'user' {
  if (!user) return 'user'
  if (user.is_superuser) return 'super_admin'
  for (const role of user.roles) {
    if (role.role_type === 'super_admin') return 'super_admin'
  }
  for (const role of user.roles) {
    if (role.role_type === 'module_admin') return 'module_admin'
  }
  for (const role of user.roles) {
    if (role.role_type === 'dept_admin') return 'dept_admin'
  }
  return 'user'
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  login: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    set({ user, isAuthenticated: true })
  },
  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },
  hasPermission: (permission: string) => {
    const state = get()
    if (!state.user) return false
    if (state.user.is_superuser) return true
    return state.user.permissions.includes(permission)
  },
}))
