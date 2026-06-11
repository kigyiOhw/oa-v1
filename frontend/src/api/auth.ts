import api from './client'

export interface LoginData {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  email: string
  password: string
  full_name?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: {
    id: number
    username: string
    email: string
    full_name: string | null
    is_active: boolean
    is_superuser: boolean
    department_id: number | null
    roles: { id: number; name: string; role_type: string; admin_scope: string | null }[]
    permissions: string[]
  }
}

export interface ChangePasswordData {
  old_password: string
  new_password: string
  confirm_password: string
}

export const authApi = {
  login: (data: LoginData) => api.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterData) => api.post<AuthResponse>('/auth/register', data),
  changePassword: (data: ChangePasswordData) => api.put<{ message: string }>('/auth/me/password', data),
}
