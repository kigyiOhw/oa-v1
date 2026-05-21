import api from './client'

export interface Announcement {
  id: number
  title: string
  content: string
  author_id: number
  is_pinned: boolean
  is_published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface PaginatedAnnouncements {
  items: Announcement[]
  total: number
  page: number
  page_size: number
}

export const announcementApi = {
  listPublished: (page = 1, pageSize = 10) =>
    api.get<PaginatedAnnouncements>('/announcements', { params: { page, page_size: pageSize } }),

  getById: (id: number) =>
    api.get<Announcement>(`/announcements/${id}`),

  create: (data: { title: string; content: string; is_pinned: boolean }) =>
    api.post<Announcement>('/announcements', data),

  update: (id: number, data: Partial<{ title: string; content: string; is_pinned: boolean; is_published: boolean }>) =>
    api.put<Announcement>(`/announcements/${id}`, data),

  delete: (id: number) =>
    api.delete(`/announcements/${id}`),
}
