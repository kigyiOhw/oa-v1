import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, GitBranch, Megaphone, Package } from 'lucide-react'
import { useNotificationStore, type Notification } from '../../stores/notification'
import { Button } from '@/components/ui/button'

function getLink(n: Notification): string | null {
  if (n.reference_type === 'task') return `/workflow/tasks/${n.reference_id}`
  if (n.reference_type === 'instance') return `/workflow/instances/${n.reference_id}`
  if (n.reference_type === 'asset') return '/my-assets'
  return null
}

function TypeIcon({ type }: { type: string }) {
  const cls = 'text-gray-400'
  switch (type) {
    case 'workflow': return <GitBranch size={16} className={cls} />
    case 'asset': return <Package size={16} className={cls} />
    case 'announcement': return <Megaphone size={16} className={cls} />
    default: return <Bell size={16} className={cls} />
  }
}

function useRelativeTime() {
  const { t } = useTranslation()
  return (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('common.timeJustNow')
    if (mins < 60) return t('common.timeMinutesAgo', { n: mins })
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t('common.timeHoursAgo', { n: hours })
    const days = Math.floor(hours / 24)
    if (days < 7) return t('common.timeDaysAgo', { n: days })
    return new Date(dateStr).toLocaleDateString()
  }
}

export default function NotificationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const notifications = useNotificationStore((s) => s.notifications)
  const total = useNotificationStore((s) => s.total)
  const loading = useNotificationStore((s) => s.loading)
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications)
  const markRead = useNotificationStore((s) => s.markRead)
  const relativeTime = useRelativeTime()

  useEffect(() => {
    fetchNotifications(page, pageSize, tab === 'unread')
  }, [page, tab, fetchNotifications])

  const handleClick = async (n: Notification) => {
    if (!n.is_read) await markRead(n.id)
    const link = getLink(n)
    if (link) navigate(link)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">{t('notification.title')}</h1>
          <div className="flex gap-1 bg-white rounded-lg border p-0.5">
            <Button
              variant={tab === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setTab('all'); setPage(1) }}
            >
              {t('notification.all')}
            </Button>
            <Button
              variant={tab === 'unread' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setTab('unread'); setPage(1) }}
            >
              {t('notification.unread')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-gray-400">{t('notification.noNotifications')}</div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left rounded-lg bg-white p-4 shadow-sm hover:shadow-md transition-shadow ${
                  !n.is_read ? 'border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0"><TypeIcon type={n.type} /></span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-2">{relativeTime(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="shrink-0 w-2 h-2 rounded-full bg-blue-600 mt-1.5" />}
                </div>
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t('common.prev')}
            </Button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
