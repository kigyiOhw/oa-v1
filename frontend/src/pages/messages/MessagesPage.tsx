import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, MailOpen, Plus } from 'lucide-react'
import { messageApi, type MessageItem } from '../../api/messages'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

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

export default function MessagesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<MessageItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const pageSize = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const fetcher = tab === 'inbox' ? messageApi.inbox : messageApi.sent
      const res = await fetcher({ page, page_size: pageSize })
      setItems(res.data.items)
      setTotal(res.data.total)
    } catch {
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleClick = async (msg: MessageItem) => {
    navigate(`/messages/${msg.id}`)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
          {t('common.backToHome')}
        </Link>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">{t('messages.title')}</h1>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-white rounded-lg border p-0.5">
              <Button
                variant={tab === 'inbox' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setTab('inbox'); setPage(1) }}
              >
                {t('messages.inbox')}
              </Button>
              <Button
                variant={tab === 'sent' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => { setTab('sent'); setPage(1) }}
              >
                {t('messages.sent')}
              </Button>
            </div>
            <Button size="sm" onClick={() => navigate('/messages/new')}>
              <Plus className="w-4 h-4 mr-1" />
              {t('messages.compose')}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Mail className="w-12 h-12 text-gray-300" />}
            title={t('messages.noMessages')}
          />
        ) : (
          <div className="space-y-2">
            {items.map((msg) => (
              <button
                key={msg.id}
                onClick={() => handleClick(msg)}
                className={`w-full text-left rounded-lg bg-white p-4 shadow-sm hover:shadow-md transition-shadow ${
                  tab === 'inbox' && !msg.is_read ? 'border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {tab === 'inbox' && !msg.is_read ? (
                    <Mail className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  ) : (
                    <MailOpen className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${tab === 'inbox' && !msg.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {msg.subject}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {tab === 'inbox'
                        ? `${t('messages.from')}: ${msg.sender_id}`
                        : `${t('messages.to')}: ${msg.recipient_id}`}
                      {' · '}{relativeTime(msg.created_at)}
                    </p>
                  </div>
                  {tab === 'sent' && (
                    <span className="shrink-0 text-xs text-gray-400 mt-0.5">
                      {msg.is_read ? t('messages.read') : t('messages.unread')}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t('common.prev')}
            </Button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              {t('common.next')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
