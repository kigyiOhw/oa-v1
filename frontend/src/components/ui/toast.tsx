import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useToastStore, type ToastType } from '@/stores/toast'
import { cn } from '@/lib/utils'

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} className="text-green-500" />,
  error: <XCircle size={18} className="text-red-500" />,
  info: <Info size={18} className="text-blue-500" />,
}

const bgMap: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800',
  error: 'border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800',
  info: 'border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg animate-in slide-in-from-right-8 fade-in duration-300',
            bgMap[toast.type],
          )}
        >
          {iconMap[toast.type]}
          <span className="text-sm text-gray-800 dark:text-gray-100 flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

/** Convenience hook — returns toast helpers. */
export function useToast() {
  const { addToast } = useToastStore()
  return {
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    info: (msg: string) => addToast('info', msg),
  }
}
