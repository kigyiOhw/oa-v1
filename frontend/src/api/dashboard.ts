import api from './client'

export interface OrgOverview {
  total_users: number
  total_departments: number
  users_by_department: { dept_id: number; dept_name: string; count: number }[]
}

export interface LeaveStats {
  total_this_month: number
  by_type: Record<string, number>
  by_status: Record<string, number>
}

export interface AssetOverview {
  total: number
  by_status: Record<string, number>
}

export interface WorkflowStats {
  pending_tasks: number
  initiated: number
  processed: number
}

export interface AttendanceOverview {
  work_days: number
  late_count: number
  early_count: number
  absent_count: number
  leave_count: number
}

export interface DashboardStats {
  org: OrgOverview | null
  leave: LeaveStats
  asset: AssetOverview | null
  workflow: WorkflowStats
  attendance: AttendanceOverview | null
}

export const dashboardApi = {
  getStats: () => api.get<{ success: boolean; data: DashboardStats; error: null }>('/dashboard/stats'),
}
