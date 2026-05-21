import api from './client'

export interface DefinitionItem {
  id: number
  name: string
  description: string | null
  icon: string | null
  definition: Record<string, unknown>
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface InstanceItem {
  id: number
  workflow_def_id: number
  title: string
  initiator_id: number
  status: string
  current_node_id: string
  form_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
  workflow_def?: DefinitionItem
  tasks?: TaskItem[]
  history?: HistoryItem[]
}

export interface TaskItem {
  id: number
  instance_id: number
  node_id: string
  assignee_id: number
  status: string
  comment: string | null
  created_at: string
  updated_at: string
  instance?: InstanceItem
}

export interface HistoryItem {
  id: number
  instance_id: number
  node_id: string
  action: string
  comment: string | null
  operator_id: number
  created_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export const workflowDefApi = {
  list: () => api.get<DefinitionItem[]>('/workflow-defs'),
  getById: (id: number) => api.get<DefinitionItem>(`/workflow-defs/${id}`),
  create: (data: {
    name: string
    description?: string | null
    icon?: string | null
    definition: Record<string, unknown>
  }) => api.post<DefinitionItem>('/workflow-defs', data),
  update: (id: number, data: {
    name?: string
    description?: string | null
    icon?: string | null
    definition?: Record<string, unknown>
    is_active?: boolean
  }) => api.put<DefinitionItem>(`/workflow-defs/${id}`, data),
  delete: (id: number) => api.delete(`/workflow-defs/${id}`),
}

export const workflowApi = {
  startInstance: (data: {
    workflow_def_id: number
    title: string
    form_data?: Record<string, unknown> | null
  }) => api.post<InstanceItem>('/workflow/instances', data),

  listInstances: (params?: { page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<InstanceItem>>('/workflow/instances', { params }),

  getInstance: (id: number) => api.get<InstanceItem>(`/workflow/instances/${id}`),

  cancelInstance: (id: number) => api.post<InstanceItem>(`/workflow/instances/${id}/cancel`),

  listTasks: (params?: { page?: number; page_size?: number }) =>
    api.get<PaginatedResponse<TaskItem>>('/workflow/tasks', { params }),

  getTask: (id: number) => api.get<TaskItem>(`/workflow/tasks/${id}`),

  approveTask: (id: number, comment?: string | null) =>
    api.post<TaskItem>(`/workflow/tasks/${id}/approve`, { comment }),

  rejectTask: (id: number, comment?: string | null) =>
    api.post<TaskItem>(`/workflow/tasks/${id}/reject`, { comment }),
}
