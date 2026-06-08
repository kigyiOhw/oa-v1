import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/toast'
import { announcementApi, Announcement } from '../../api/announcement'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import ConfirmDialog from '@/components/ui/confirm-dialog'

export default function Announcements() {
  const { t } = useTranslation()
  const toast = useToast()
  const [anns, setAnns] = useState<Announcement[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)

  const fetchAnns = async (p: number) => {
    const res = await announcementApi.listPublished(p, 10)
    setAnns(res.data.items)
    setTotal(res.data.total)
  }

  useEffect(() => { fetchAnns(page) }, [page])

  const handleDelete = (id: number) => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message: t('announcements.deleteConfirm'),
      onConfirm: async () => {
        try {
          await announcementApi.delete(id)
          fetchAnns(page)
        } catch (e: any) {
          toast.error(e.response?.data?.detail || 'Delete failed')
        }
      },
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('announcements.title')}</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          {t('announcements.createAnnouncement')}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>{t('announcements.title')}</TableHead>
            <TableHead>{t('announcements.status')}</TableHead>
            <TableHead>{t('workflow.created')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {anns.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{a.id}</TableCell>
              <TableCell className="font-medium">
                {a.is_pinned && <span className="text-xs bg-red-100 text-red-600 px-1 rounded mr-1">{t('announcements.pinned')}</span>}
                {a.title}
              </TableCell>
              <TableCell>
                <span className={a.is_published ? 'text-green-600' : 'text-gray-400'}>
                  {a.is_published ? t('announcements.published') : t('announcements.draft')}
                </span>
              </TableCell>
              <TableCell className="text-gray-400">{new Date(a.created_at).toLocaleDateString()}</TableCell>
              <TableCell className="space-x-2">
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setEditing(a)}>{t('common.edit')}</Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleDelete(a.id)}>{t('common.delete')}</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: Math.ceil(total / 10) }, (_, i) => (
          <Button
            key={i}
            variant={page === i + 1 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPage(i + 1)}
          >
            {i + 1}
          </Button>
        ))}
      </div>

      {showCreate && (
        <AnnFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); fetchAnns(page) }} />
      )}
      {editing && (
        <AnnFormModal ann={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchAnns(page) }} />
      )}
      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          variant="destructive"
          onConfirm={() => { confirmState.onConfirm(); setConfirmState(null) }}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  )
}

function AnnFormModal({
  ann, onClose, onSaved,
}: {
  ann?: Announcement; onClose: () => void; onSaved: () => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(ann?.title || '')
  const [content, setContent] = useState(ann?.content || '')
  const [isPinned, setIsPinned] = useState(ann?.is_pinned ?? false)
  const [isPublished, setIsPublished] = useState(ann?.is_published ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)

  const handleSave = async () => {
    setError('')
    if (!title.trim() || !content.trim()) { setError(t('announcements.titleContentRequired')); return }
    setSaving(true)
    try {
      if (ann) {
        await announcementApi.update(ann.id, { title: title.trim(), content: content.trim(), is_pinned: isPinned, is_published: isPublished })
      } else {
        await announcementApi.create({ title: title.trim(), content: content.trim(), is_pinned: isPinned })
      }
      setSaving(false)
      onSaved()
    } catch (e: any) {
      setSaving(false)
      setError(e.response?.data?.detail || t('common.saveFailed'))
    }
  }

  const formTitle = ann ? t('announcements.editAnnouncement') : t('announcements.createAnnouncement')

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[700px] max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">{formTitle}</h2>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</div>}
        <label className="block mb-2 text-sm">
          {t('announcements.title')}
          <Input className="mt-0.5" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="flex gap-2 mb-2">
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} /> {t('announcements.pinned')}
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} /> {t('announcements.published')}
          </label>
          <Button variant="link" size="sm" className="h-auto p-0 ml-auto" onClick={() => setPreview(!preview)}>
            {preview ? t('common.edit') : t('announcements.preview')}
          </Button>
        </div>
        {preview ? (
          <div className="border rounded p-3 mb-4 min-h-[200px] prose prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <label className="block mb-4 text-sm">
            {t('announcements.content')}
            <Textarea className="mt-0.5 font-mono text-xs" rows={14} value={content} onChange={(e) => setContent(e.target.value)} />
          </label>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSave} disabled={saving || !title.trim() || !content.trim()}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
        </div>
      </div>
    </div>
  )
}
