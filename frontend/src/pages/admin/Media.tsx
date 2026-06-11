import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, FileText, X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { mediaApi, MediaFile } from '../../api/media'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ui/confirm-dialog'

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${bytes}B`
}

function getDocLabel(ext: string): string {
  const map: Record<string, string> = { '.pdf': 'PDF', '.docx': 'DOCX', '.xlsx': 'XLSX' }
  return map[ext] || ext.toUpperCase().replace('.', '')
}

export default function Media() {
  const { t } = useTranslation()
  const toast = useToast()
  const [files, setFiles] = useState<MediaFile[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)
  const [playingFile, setPlayingFile] = useState<MediaFile | null>(null)
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

  const handleDelete = (id: number) => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message: t('media.deleteConfirm'),
      onConfirm: async () => {
        try {
          await mediaApi.delete(id)
          fetchFiles(page)
        } catch (e: any) {
          toast.error(e.response?.data?.detail || 'Delete failed')
        }
      },
    })
  }

  const fileExt = (f: MediaFile) => {
    const dotIdx = f.title.lastIndexOf('.')
    return dotIdx >= 0 ? f.title.slice(dotIdx).toLowerCase() : ''
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('media.title')}</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.pdf,.docx,.xlsx"
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
          <div
            key={f.id}
            className="bg-white rounded-lg shadow-sm border overflow-hidden group cursor-pointer"
            onClick={() => f.file_type === 'video' && setPlayingFile(f)}
          >
            {/* ── Thumbnail area ── */}
            {f.file_type === 'image' ? (
              <img src={f.file_path} alt={f.title} className="w-full aspect-video object-cover" />
            ) : f.file_type === 'video' ? (
              <div className="relative w-full aspect-video bg-black">
                <video
                  src={f.file_path}
                  preload="metadata"
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  disablePictureInPicture
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center transition-colors group-hover:bg-black/50">
                  <Play size={40} className="text-white drop-shadow-lg" fill="white" />
                </div>
              </div>
            ) : (
              <div className="w-full aspect-video bg-gray-100 flex flex-col items-center justify-center gap-1">
                <FileText size={36} className="text-gray-400" />
                <span className="text-xs font-mono text-gray-500">{getDocLabel(fileExt(f))}</span>
              </div>
            )}

            {/* ── Info bar ── */}
            <div className="p-2 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-600 truncate" title={f.title}>{f.title}</p>
                <p className="text-xs text-gray-400">
                  {f.file_type} · {formatSize(f.file_size)}
                </p>
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-red-500 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleDelete(f.id) }}
              >
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

      {/* ── Video playback modal ── */}
      {playingFile && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={() => setPlayingFile(null)}
        >
          <div className="relative max-w-4xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
              onClick={() => setPlayingFile(null)}
            >
              <X size={28} />
            </button>
            <div className="bg-black rounded-lg overflow-hidden">
              <video
                src={playingFile.file_path}
                controls
                className="w-full max-h-[80vh]"
                style={{ outline: 'none' }}
              />
            </div>
            <p className="text-white text-sm mt-2 truncate">{playingFile.title}</p>
          </div>
        </div>
      )}
    </div>
  )
}
