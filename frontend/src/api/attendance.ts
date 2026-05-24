import api from './client'

export interface AttendanceRecord {
  id: number
  user_id: number
  record_date: string
  check_in_time: string | null
  check_out_time: string | null
  status: string
  source: string
  leave_request_id: number | null
  created_at: string
  updated_at: string
}

export interface PaginatedAttendance {
  items: AttendanceRecord[]
  total: number
  page: number
  page_size: number
}

export interface MonthlySummary {
  year: number
  month: number
  total_days: number
  normal_days: number
  late_days: number
  early_days: number
  absent_days: number
  leave_days: number
  business_trip_days: number
}

export interface TeamMemberSummary {
  user_id: number
  username: string
  full_name: string | null
  department_name: string | null
  summary: MonthlySummary
}

export interface TeamMemberDetail {
  user_id: number
  username: string
  full_name: string | null
  email: string
  department_name: string | null
  phone: string | null
  join_date: string | null
  employment_status: string | null
  summary: MonthlySummary
  recent_leaves: Array<{
    id: number
    leave_type: string
    start_date: string
    end_date: string
    duration_days: number
    status: string
  }>
}

export interface AttendanceConfig {
  work_start_time: string
  work_end_time: string
  late_tolerance_minutes: number
  enable_mandatory_check_in: boolean
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    normal: 'Normal',
    late: 'Late',
    early: 'Early',
    absent: 'Absent',
    leave: 'Leave',
    business_trip: 'Business Trip',
  }
  return map[status] || status
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    normal: 'text-green-600',
    late: 'text-yellow-600',
    early: 'text-orange-600',
    absent: 'text-red-600',
    leave: 'text-blue-600',
    business_trip: 'text-purple-600',
  }
  return map[status] || ''
}

export const attendanceApi = {
  checkIn: () => api.post('/attendance/check-in'),

  checkOut: () => api.post('/attendance/check-out'),

  getMyRecords: (params: { year: number; month: number; page?: number; page_size?: number }) =>
    api.get<PaginatedAttendance>('/attendance/me', { params }),

  getMySummary: (params: { year: number; month: number }) =>
    api.get<MonthlySummary>('/attendance/me/summary', { params }),

  getTeamSummary: (params: { year: number; month: number }) =>
    api.get<TeamMemberSummary[]>('/attendance/team', { params }),

  getTeamMemberDetail: (userId: number, params: { year: number; month: number }) =>
    api.get<TeamMemberDetail>(`/attendance/team/${userId}`, { params }),

  getTeamMemberRecords: (userId: number, params: { year: number; month: number; page?: number; page_size?: number }) =>
    api.get<PaginatedAttendance>(`/attendance/team/${userId}/records`, { params }),

  getTeamMemberSummary: (userId: number, params: { year: number; month: number }) =>
    api.get<MonthlySummary>(`/attendance/team/${userId}/summary`, { params }),

  getConfig: () => api.get<AttendanceConfig>('/attendance/config'),

  updateConfig: (data: AttendanceConfig) =>
    api.put<AttendanceConfig>('/attendance/config', data),
}
