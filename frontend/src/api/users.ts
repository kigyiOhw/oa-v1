import api from './client'

export interface UserItem {
  id: number
  username: string
  email: string
  full_name: string | null
  is_active: boolean
  is_superuser: boolean
  department_id: number | null
  roles: { id: number; name: string }[]
  permissions: string[]
}

export interface UserListResponse {
  items: UserItem[]
  total: number
  page: number
  page_size: number
}

export interface UserAdminUpdate {
  email?: string
  full_name?: string | null
  is_active?: boolean
  is_superuser?: boolean
  department_id?: number | null
  role_ids?: number[]
}

export const userApi = {
  list: (params?: { page?: number; page_size?: number; search?: string }) =>
    api.get<UserListResponse>('/users', { params }),
  getById: (id: number) => api.get<UserItem>(`/users/${id}`),
  update: (id: number, data: UserAdminUpdate) => api.put<UserItem>(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
}
