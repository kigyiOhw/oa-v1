import api from './client';

export interface MessageItem {
  id: number;
  sender_id: number;
  recipient_id: number;
  subject: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
  sender_deleted: boolean;
  recipient_deleted: boolean;
  created_at: string;
}

export interface MessageDetail extends MessageItem {
  sender_username?: string | null;
  recipient_username?: string | null;
}

export interface PaginatedMessages {
  items: MessageItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface UnreadMessageCount {
  count: number;
}

export const messageApi = {
  inbox: (params?: { page?: number; page_size?: number }) =>
    api.get<PaginatedMessages>('/messages/inbox', { params }),
  sent: (params?: { page?: number; page_size?: number }) =>
    api.get<PaginatedMessages>('/messages/sent', { params }),
  unreadCount: () =>
    api.get<UnreadMessageCount>('/messages/unread-count'),
  send: (data: { recipient_id: number; subject: string; body: string }) =>
    api.post<MessageItem>('/messages', data),
  getById: (id: number) =>
    api.get<MessageDetail>(`/messages/${id}`),
  markRead: (id: number) =>
    api.post<MessageItem>(`/messages/${id}/read`),
  delete: (id: number) =>
    api.delete(`/messages/${id}`),
};
