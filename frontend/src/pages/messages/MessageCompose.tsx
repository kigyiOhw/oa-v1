import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Send, ArrowLeft } from 'lucide-react'
import { messageApi } from '../../api/messages'
import { contactsApi } from '../../api/contacts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function MessageCompose() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [recipientId, setRecipientId] = useState(searchParams.get('replyTo') || '')
  const [recipientSearch, setRecipientSearch] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: number; username: string; full_name: string | null }[]>([])
  const [subject, setSubject] = useState(searchParams.get('subject') || '')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (recipientSearch.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await contactsApi.list({ search: recipientSearch, page_size: 10 })
        setSearchResults(res.data.items || [])
      } catch {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [recipientSearch])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!recipientId) errs.recipient = t('messages.recipientRequired')
    if (!subject.trim()) errs.subject = t('messages.subjectRequired')
    if (!body.trim()) errs.body = t('messages.bodyRequired')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSend = async () => {
    if (!validate()) return
    setSending(true)
    try {
      await messageApi.send({
        recipient_id: Number(recipientId),
        subject: subject.trim(),
        body: body.trim(),
      })
      navigate('/messages')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || t('common.saveFailed')
      setErrors({ form: msg })
    } finally {
      setSending(false)
    }
  }

  const selectRecipient = (user: { id: number; username: string; full_name: string | null }) => {
    setRecipientId(String(user.id))
    setRecipientSearch(`${user.username} (${user.full_name || ''})`)
    setSearchResults([])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link to="/messages" className="text-blue-600 hover:underline text-sm mb-4 inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          {t('messages.backToMessages')}
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{t('messages.compose')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {errors.form && (
              <p className="text-sm text-destructive bg-red-50 border border-red-200 rounded p-2">{errors.form}</p>
            )}

            {/* Recipient */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('messages.recipient')} <span className="text-destructive">*</span>
              </label>
              {recipientId ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                    {recipientSearch}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => { setRecipientId(''); setRecipientSearch('') }}>
                    ×
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder={t('messages.searchUser')}
                  />
                  {errors.recipient && <p className="text-xs text-destructive mt-1">{errors.recipient}</p>}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {searchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-b-0"
                          onClick={() => selectRecipient(u)}
                        >
                          <span className="font-medium">{u.username}</span>
                          <span className="text-gray-500 ml-2">{u.full_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('messages.subject')} <span className="text-destructive">*</span>
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                placeholder={t('messages.subject')}
              />
              {errors.subject && <p className="text-xs text-destructive mt-1">{errors.subject}</p>}
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('messages.body')} <span className="text-destructive">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('messages.body')}
              />
              {errors.body && <p className="text-xs text-destructive mt-1">{errors.body}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate('/messages')}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                <Send className="w-4 h-4 mr-1" />
                {sending ? t('common.saving') : t('messages.send')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
