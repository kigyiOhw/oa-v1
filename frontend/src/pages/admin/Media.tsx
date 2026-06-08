import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/toast'
import { mediaApi, MediaFile } from '../../api/media'
import { Button } from '@/components/ui/button'

export default function Media() {
  const { t } = useTranslation()
  const toast = useToast()
  const [files, setFiles] = useState<MediaFile[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchFiles = async (p: number) => {
    const res = await mediaApi.list(p, 20)
    setFiles(res.data.items)
    setTotal(res.data.total)
  }

  useEffect(() => { fetchFiles(page) }, [page])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await mediaApi.upload(file)
      fetchFiles(page)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('media.uploadFailed'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('media.deleteConfirm'))) return
    try {
      await mediaApi.delete(id)
      fetchFiles(page)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Delete failed')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('media.title')}</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleUpload}
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? t('common.uploading') : t('media.uploadFile')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {files.map((f) => (
          <div key={f.id} className="bg-white rounded-lg shadow-sm border overflow-hidden group">
            {f.file_type === 'image' ? (
              <img src={f.file_path} alt={f.title} className="w-full aspect-video object-cover" />
            ) : (
              <div className="w-full aspect-video bg-gray-900 flex items-center justify-center">
                <span className="text-white text-3xl">▶</span>
              </div>
            )}
            <div className="p-2 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-600 truncate" title={f.title}>{f.title}</p>
                <p className="text-xs text-gray-400">
                  {f.file_type} · {(f.file_size / 1024).toFixed(0)}KB
                </p>
              </div>
              <Button variant="link" size="sm" className="h-auto p-0 text-red-500 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(f.id)}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        ))}
        {files.length === 0 && (
          <p className="text-gray-400 text-sm col-span-full text-center py-8">{t('media.noFiles')}</p>
        )}
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: Math.ceil(total / 20) }, (_, i) => (
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
    </div>
  )
}
