import api from './client'

export interface RoleItem {
  id: number
  name: string
  description: string | null
  role_type: string
  admin_scope: string | null
}

export interface RoleTypeItem {
  value: string
  label: string
  description: string
}

export interface PermissionItem {
  id: number
  code: string
  description: string | null
}

export interface RoleCreateData {
  name: string
  description?: string | null
  role_type?: string
  admin_scope?: string | null
}

export const roleApi = {
  list: () => api.get<RoleItem[]>('/roles'),
  getById: (id: number) => api.get<RoleItem>(`/roles/${id}`),
  create: (data: RoleCreateData) =>
    api.post<RoleItem>('/roles', data),
  update: (id: number, data: { name?: string; description?: string | null; role_type?: string; admin_scope?: string | null }) =>
    api.put<RoleItem>(`/roles/${id}`, data),
  delete: (id: number) => api.delete(`/roles/${id}`),
  getPermissions: (roleId: number) => api.get<PermissionItem[]>(`/roles/${roleId}/permissions`),
  assignPermissions: (roleId: number, permissionIds: number[]) =>
    api.put<RoleItem>(`/roles/${roleId}/permissions`, { permission_ids: permissionIds }),
  listPermissions: () => api.get<PermissionItem[]>('/permissions'),
  listTypes: () => api.get<RoleTypeItem[]>('/roles/types'),
}
