import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, Reply, Trash2 } from 'lucide-react'
import { messageApi, type MessageDetail } from '../../api/messages'
import { useMessageStore } from '../../stores/messages'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Breadcrumb } from '@/components/ui/breadcrumb'

export default function MessageDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [msg, setMsg] = useState<MessageDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const fetchUnreadCount = useMessageStore((s) => s.fetchUnreadCount)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await messageApi.getById(Number(id))
        if (!cancelled) setMsg(res.data)
        // Auto-mark as read
        if (!res.data.is_read) {
          await messageApi.markRead(res.data.id)
          fetchUnreadCount()
        }
      } catch {
        if (!cancelled) setError(t('messages.notFound'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, t, fetchUnreadCount])

  const handleDelete = async () => {
    if (!id) return
    try {
      await messageApi.delete(Number(id))
      navigate('/messages')
    } catch {
      // handled by axios interceptor
    }
  }

  const handleReply = () => {
    if (msg) {
      navigate(`/messages/new?replyTo=${msg.sender_id}&subject=Re: ${encodeURIComponent(msg.subject)}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <Skeleton className="h-4 w-24 mb-4" />
          <Card>
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !msg) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <Link to="/messages" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
            {t('common.back')}
          </Link>
          <EmptyState icon={<Mail className="w-12 h-12 text-gray-300" />} title={error || t('messages.notFound')} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Breadcrumb items={[
          { label: t('common.backToHome').replace('← ', ''), href: '/' },
          { label: t('messages.title'), href: '/messages' },
          { label: msg.subject },
        ]} />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{msg.subject}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div>
                <span className="font-medium text-gray-700">{t('messages.from')}:</span>{' '}
                {msg.sender_username || `#${msg.sender_id}`}
              </div>
              <div>
                <span className="font-medium text-gray-700">{t('messages.to')}:</span>{' '}
                {msg.recipient_username || `#${msg.recipient_id}`}
              </div>
            </div>
            <div className="text-xs text-gray-400">
              {new Date(msg.created_at).toLocaleString()}
              {msg.read_at && (
                <span className="ml-3">
                  {t('messages.readAt')}: {new Date(msg.read_at).toLocaleString()}
                </span>
              )}
            </div>
            <hr />
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {msg.body}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={handleReply}>
            <Reply className="w-4 h-4 mr-1" />
            {t('messages.reply')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-1" />
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </div>
  )
}
