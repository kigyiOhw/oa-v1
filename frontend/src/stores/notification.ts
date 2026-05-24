import { create } from 'zustand'
import { notificationApi, type NotificationItem } from '../api/notification'

export type { NotificationItem as Notification }

interface NotificationState {
  notifications: NotificationItem[]
  unreadCount: number
  total: number
  loading: boolean
  fetchUnreadCount: () => Promise<void>
  fetchNotifications: (page?: number, pageSize?: number, unreadOnly?: boolean) => Promise<number>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
  addNotification: (n: NotificationItem) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  total: 0,
  loading: false,

  fetchUnreadCount: async () => {
    try {
      const res = await notificationApi.unreadCount()
      set({ unreadCount: res.data.count })
    } catch {
      // silent
    }
  },

  fetchNotifications: async (page = 1, pageSize = 20, unreadOnly = false) => {
    set({ loading: true })
    try {
      const res = await notificationApi.list({ page, page_size: pageSize, unread_only: unreadOnly })
      set({ notifications: res.data.items, total: res.data.total })
      return res.data.total
    } finally {
      set({ loading: false })
    }
  },

  markRead: async (id: number) => {
    try {
      await notificationApi.markRead(id)
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
    } catch {
      // silent
    }
  },

  markAllRead: async () => {
    try {
      await notificationApi.markAllRead()
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }))
    } catch {
      // silent
    }
  },

  addNotification: (n: NotificationItem) => {
    set((state) => ({
      notifications: [n, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }))
  },
}))
