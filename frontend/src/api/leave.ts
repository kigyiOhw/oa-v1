import api from './client'

export interface LeaveItem {
  id: number
  user_id: number
  workflow_instance_id: number | null
  leave_type: string
  start_date: string
  end_date: string
  duration_days: number
  reason: string
  status: string
  created_at: string
  updated_at: string
}

export interface PaginatedLeaves {
  items: LeaveItem[]
  total: number
  page: number
  page_size: number
}

const LEAVE_TYPES: Record<string, string> = {
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  annual: 'Annual Leave',
  other: 'Other',
}

export function leaveTypeLabel(type: string): string {
  return LEAVE_TYPES[type] || type
}

export function leaveStatusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'text-gray-500',
    submitted: 'text-blue-600',
    approved: 'text-green-600',
    rejected: 'text-red-600',
    cancelled: 'text-gray-400',
  }
  return map[status] || ''
}

export const leaveApi = {
  list: (params?: { status?: string; page?: number; page_size?: number }) =>
    api.get<PaginatedLeaves>('/leaves', { params }),

  create: (data: {
    leave_type: string
    start_date: string
    end_date: string
    duration_days: number
    reason: string
  }) => api.post<LeaveItem>('/leaves', data),

  getById: (id: number) => api.get<LeaveItem>(`/leaves/${id}`),

  update: (id: number, data: {
    leave_type?: string
    start_date?: string
    end_date?: string
    duration_days?: number
    reason?: string
  }) => api.put<LeaveItem>(`/leaves/${id}`, data),

  delete: (id: number) => api.delete(`/leaves/${id}`),

  submit: (id: number) => api.post<LeaveItem>(`/leaves/${id}/submit`),

  cancel: (id: number) => api.post<LeaveItem>(`/leaves/${id}/cancel`),
}
