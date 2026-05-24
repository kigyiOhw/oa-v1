import api from './client'

export interface AuditLogItem {
  id: number
  user_id: number | null
  user_name: string | null
  action: string
  resource_type: string
  resource_id: number | null
  details: Record<string, unknown> | null
  ip_address: string
  created_at: string
}

export interface PaginatedAuditLogs {
  items: AuditLogItem[]
  total: number
  page: number
  page_size: number
}

export interface AuditLogFilters {
  action?: string
  resource_type?: string
  start_date?: string
  end_date?: string
  page?: number
  page_size?: number
}

export const auditApi = {
  list: (params?: AuditLogFilters) =>
    api.get<PaginatedAuditLogs>('/audit-logs', { params }),
}
