import { create } from 'zustand';
import { messageApi, MessageItem } from '../api/messages';

interface MessagesState {
  unreadCount: number;
  loading: boolean;
  fetchUnreadCount: () => Promise<void>;
  addMessage: (msg: MessageItem) => void;
  updateReadReceipt: (messageId: number, readAt: string) => void;
}

export const useMessageStore = create<MessagesState>((set, get) => ({
  unreadCount: 0,
  loading: false,

  fetchUnreadCount: async () => {
    try {
      const res = await messageApi.unreadCount();
      set({ unreadCount: res.data.count });
    } catch {
      // silently ignore - user might not be logged in
    }
  },

  addMessage: (msg: MessageItem) => {
    if (!msg.is_read) {
      set({ unreadCount: get().unreadCount + 1 });
    }
  },

  updateReadReceipt: (_messageId: number, _readAt: string) => {
    // The sent items list will re-fetch when user navigates to sent tab,
    // so we don't need to track individual message read status in store.
    // This is a placeholder for future optimistic UI updates.
  },
}));
