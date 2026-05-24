import api from './client'

export interface ExpenseItem {
  id: number
  user_id: number
  workflow_instance_id: number | null
  expense_type: string
  amount: number
  description: string
  attachment_urls: string[] | null
  status: string
  created_at: string
  updated_at: string
}

export interface PaginatedExpenses {
  items: ExpenseItem[]
  total: number
  page: number
  page_size: number
}

const EXPENSE_TYPES: Record<string, string> = {
  travel: 'Travel',
  office: 'Office Supplies',
  entertainment: 'Entertainment',
  other: 'Other',
}

export function expenseTypeLabel(type: string): string {
  return EXPENSE_TYPES[type] || type
}

export function expenseStatusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'text-gray-500',
    submitted: 'text-blue-600',
    approved: 'text-green-600',
    rejected: 'text-red-600',
    cancelled: 'text-gray-400',
  }
  return map[status] || ''
}

export const expenseApi = {
  list: (params?: { status?: string; page?: number; page_size?: number }) =>
    api.get<PaginatedExpenses>('/expenses', { params }),

  create: (data: {
    expense_type: string
    amount: number
    description: string
    attachment_urls?: string[] | null
  }) => api.post<ExpenseItem>('/expenses', data),

  getById: (id: number) => api.get<ExpenseItem>(`/expenses/${id}`),

  update: (id: number, data: {
    expense_type?: string
    amount?: number
    description?: string
    attachment_urls?: string[] | null
  }) => api.put<ExpenseItem>(`/expenses/${id}`, data),

  delete: (id: number) => api.delete(`/expenses/${id}`),

  submit: (id: number) => api.post<ExpenseItem>(`/expenses/${id}/submit`),

  cancel: (id: number) => api.post<ExpenseItem>(`/expenses/${id}/cancel`),
}
