import api from './client'

export interface DepartmentItem {
  id: number
  name: string
  parent_id: number | null
  description: string | null
  sort_order: number
  created_at: string
}

export interface DepartmentTreeItem extends DepartmentItem {
  children: DepartmentTreeItem[]
}

export interface DepartmentCreate {
  name: string
  parent_id?: number | null
  description?: string | null
  sort_order?: number
}

export interface DepartmentUpdate {
  name?: string
  parent_id?: number | null
  description?: string | null
  sort_order?: number
}

export const deptApi = {
  list: () => api.get<DepartmentItem[]>('/departments'),
  tree: () => api.get<DepartmentTreeItem[]>('/departments/tree'),
  getById: (id: number) => api.get<DepartmentItem>(`/departments/${id}`),
  create: (data: DepartmentCreate) => api.post<DepartmentItem>('/departments', data),
  update: (id: number, data: DepartmentUpdate) => api.put<DepartmentItem>(`/departments/${id}`, data),
  delete: (id: number) => api.delete(`/departments/${id}`),
}
