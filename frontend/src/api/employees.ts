import api from './client'

export interface EmployeeProfile {
  id: number
  user_id: number
  phone: string | null
  address: string | null
  birthday: string | null
  work_experience: string | null
  graduation_school: string | null
  education_level: string | null
  join_date: string | null
  employment_status: string
  resignation_date: string | null
  onboarding_complete: boolean
  created_at: string
  updated_at: string
  username: string
  full_name: string | null
  department_name: string | null
}

export interface PaginatedEmployees {
  items: EmployeeProfile[]
  total: number
  page: number
  page_size: number
}

export function employmentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: '在职',
    resigned: '已离职',
  }
  return map[status] || status
}

export function employmentStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'text-green-600',
    resigned: 'text-gray-400',
  }
  return map[status] || ''
}

export const employeeApi = {
  // Self-service
  getMyProfile: () => api.get<EmployeeProfile>('/employees/me'),

  updateMyProfile: (data: { phone?: string; address?: string }) =>
    api.put<EmployeeProfile>('/employees/me', data),

  completeOnboarding: (data: {
    phone?: string
    address?: string
    birthday?: string
    work_experience?: string
    graduation_school?: string
    education_level?: string
  }) => api.post<EmployeeProfile>('/employees/me/onboarding', data),

  // Admin
  list: (params?: {
    page?: number
    page_size?: number
    search?: string
    department_id?: number
    employment_status?: string
  }) => api.get<PaginatedEmployees>('/employees', { params }),

  getById: (id: number) => api.get<EmployeeProfile>(`/employees/${id}`),

  update: (id: number, data: Record<string, unknown>) =>
    api.put<EmployeeProfile>(`/employees/${id}`, data),

  delete: (id: number) => api.delete(`/employees/${id}`),

  resign: (id: number, data: { successor_id: number; resignation_date?: string }) =>
    api.post<EmployeeProfile>(`/employees/${id}/resign`, data),
}
