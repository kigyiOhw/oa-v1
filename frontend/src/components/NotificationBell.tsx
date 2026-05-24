import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, BellRing, GitBranch, Megaphone, Package, X } from 'lucide-react'
import { useNotificationStore, type Notification } from '../stores/notification'
import { useNotificationSocket } from '../hooks/useNotificationSocket'

function getLink(n: Notification): string | null {
  if (n.reference_type === 'task') return `/workflow/tasks/${n.reference_id}`
  if (n.reference_type === 'instance') return `/workflow/instances/${n.reference_id}`
  if (n.reference_type === 'asset') return '/my-assets'
  return null
}

function TypeIcon({ type }: { type: string }) {
  const cls = 'text-gray-400'
  switch (type) {
    case 'workflow': return <GitBranch size={14} className={cls} />
    case 'asset': return <Package size={14} className={cls} />
    case 'announcement': return <Megaphone size={14} className={cls} />
    default: return <Bell size={14} className={cls} />
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function NotificationBell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const notifications = useNotificationStore((s) => s.notifications)
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount)
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications)
  const markRead = useNotificationStore((s) => s.markRead)

  useNotificationSocket()

  useEffect(() => {
    fetchUnreadCount()
  }, [fetchUnreadCount])

  const handleOpen = () => {
    fetchNotifications(1, 5)
    setOpen(!open)
  }

  const handleClick = async (n: Notification) => {
    if (!n.is_read) await markRead(n.id)
    setOpen(false)
    const link = getLink(n)
    if (link) navigate(link)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-6 left-6 z-50 rounded-full bg-white p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
        title={t('notification.title')}
      >
        {unreadCount > 0 ? (
          <>
            <BellRing size={20} className="text-blue-600" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </>
        ) : (
          <Bell size={20} className="text-gray-600" />
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 left-6 z-50 w-80 rounded-lg bg-white shadow-xl border border-gray-200">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold text-sm text-gray-900">{t('notification.title')}</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-80 overflow-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">{t('notification.noNotifications')}</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !n.is_read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0"><TypeIcon type={n.type} /></span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{relativeTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="shrink-0 w-2 h-2 rounded-full bg-blue-600 mt-1.5" />}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t px-4 py-3">
            <button
              onClick={() => { setOpen(false); navigate('/notifications') }}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              {t('notification.viewAll')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
