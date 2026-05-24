import api from './client'

export interface NotificationItem {
  id: number
  user_id: number
  type: string
  title: string
  message: string
  reference_type: string | null
  reference_id: number | null
  is_read: boolean
  created_at: string
}

export interface PaginatedNotifications {
  items: NotificationItem[]
  total: number
  page: number
  page_size: number
}

export interface UnreadCount {
  count: number
}

export const notificationApi = {
  list: (params?: { page?: number; page_size?: number; unread_only?: boolean }) =>
    api.get<PaginatedNotifications>('/notifications', { params }),

  unreadCount: () =>
    api.get<UnreadCount>('/notifications/unread-count'),

  markRead: (id: number) =>
    api.post<NotificationItem>(`/notifications/${id}/read`),

  markAllRead: () =>
    api.post<UnreadCount>('/notifications/read-all'),
}
