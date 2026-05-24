import api from './client'

export interface OvertimeItem {
  id: number
  user_id: number
  workflow_instance_id: number | null
  start_time: string
  end_time: string
  duration_hours: number
  reason: string
  status: string
  created_at: string
  updated_at: string
}

export interface PaginatedOvertimes {
  items: OvertimeItem[]
  total: number
  page: number
  page_size: number
}

export function overtimeStatusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'text-gray-500',
    submitted: 'text-blue-600',
    approved: 'text-green-600',
    rejected: 'text-red-600',
    cancelled: 'text-gray-400',
  }
  return map[status] || ''
}

export const overtimeApi = {
  list: (params?: { status?: string; page?: number; page_size?: number }) =>
    api.get<PaginatedOvertimes>('/overtimes', { params }),

  create: (data: {
    start_time: string
    end_time: string
    duration_hours: number
    reason: string
  }) => api.post<OvertimeItem>('/overtimes', data),

  getById: (id: number) => api.get<OvertimeItem>(`/overtimes/${id}`),

  update: (id: number, data: {
    start_time?: string
    end_time?: string
    duration_hours?: number
    reason?: string
  }) => api.put<OvertimeItem>(`/overtimes/${id}`, data),

  delete: (id: number) => api.delete(`/overtimes/${id}`),

  submit: (id: number) => api.post<OvertimeItem>(`/overtimes/${id}/submit`),

  cancel: (id: number) => api.post<OvertimeItem>(`/overtimes/${id}/cancel`),
}
