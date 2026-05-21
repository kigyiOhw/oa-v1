import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { announcementApi, Announcement } from '../../api/announcement'

export default function Announcements() {
  const [anns, setAnns] = useState<Announcement[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)

  const fetchAnns = async (p: number) => {
    const res = await announcementApi.listPublished(p, 10)
    setAnns(res.data.items)
    setTotal(res.data.total)
  }

  useEffect(() => { fetchAnns(page) }, [page])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this announcement?')) return
    try {
      await announcementApi.delete(id)
      fetchAnns(page)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Delete failed')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Announcements</h1>
        <button
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
          onClick={() => setShowCreate(true)}
        >
          Create Announcement
        </button>
      </div>
      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Title</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Created</th>
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {anns.map((a) => (
            <tr key={a.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">{a.id}</td>
              <td className="px-3 py-2 font-medium">
                {a.is_pinned && <span className="text-xs bg-red-100 text-red-600 px-1 rounded mr-1">Pinned</span>}
                {a.title}
              </td>
              <td className="px-3 py-2">
                <span className={a.is_published ? 'text-green-600' : 'text-gray-400'}>
                  {a.is_published ? 'Published' : 'Draft'}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-400">{new Date(a.created_at).toLocaleDateString()}</td>
              <td className="px-3 py-2 space-x-2">
                <button className="text-blue-600 hover:underline text-xs" onClick={() => setEditing(a)}>Edit</button>
                <button className="text-red-500 hover:underline text-xs" onClick={() => handleDelete(a.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: Math.ceil(total / 10) }, (_, i) => (
          <button
            key={i}
            className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setPage(i + 1)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {showCreate && (
        <AnnFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); fetchAnns(page) }} />
      )}
      {editing && (
        <AnnFormModal ann={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchAnns(page) }} />
      )}
    </div>
  )
}

function AnnFormModal({
  ann, onClose, onSaved,
}: {
  ann?: Announcement; onClose: () => void; onSaved: () => void
}) {
  const [title, setTitle] = useState(ann?.title || '')
  const [content, setContent] = useState(ann?.content || '')
  const [isPinned, setIsPinned] = useState(ann?.is_pinned ?? false)
  const [isPublished, setIsPublished] = useState(ann?.is_published ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)

  const handleSave = async () => {
    setError('')
    if (!title.trim() || !content.trim()) { setError('Title and content are required'); return }
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
      setError(e.response?.data?.detail || 'Save failed')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[700px] max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-bold mb-4">{ann ? 'Edit Announcement' : 'Create Announcement'}</h2>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</div>}
        <label className="block mb-2 text-sm">
          Title
          <input className="block w-full border rounded px-2 py-1 mt-0.5" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="flex gap-2 mb-2">
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} /> Pinned
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} /> Published
          </label>
          <button type="button" className="text-xs text-blue-600 underline ml-auto" onClick={() => setPreview(!preview)}>
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
        {preview ? (
          <div className="border rounded p-3 mb-4 min-h-[200px] prose prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <label className="block mb-4 text-sm">
            Content (Markdown)
            <textarea
              className="block w-full border rounded px-2 py-1 mt-0.5 font-mono text-xs"
              rows={14}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
        )}
        <div className="flex gap-2">
          <button
            className="flex-1 bg-blue-600 text-white rounded py-1.5 text-sm disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || !title.trim() || !content.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="flex-1 border rounded py-1.5 text-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
