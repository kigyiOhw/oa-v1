import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft } from 'lucide-react'
import { expenseApi, ExpenseItem, expenseTypeLabel, expenseStatusColor } from '../../api/expense'
import { workflowApi, HistoryItem } from '../../api/workflow'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import ConfirmDialog from '@/components/ui/confirm-dialog'

export default function ExpenseDetail() {
  const { t } = useTranslation()
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [expense, setExpense] = useState<ExpenseItem | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)

  const fetchExpense = async () => {
    try {
      const res = await expenseApi.getById(Number(id))
      setExpense(res.data)
      if (res.data.workflow_instance_id) {
        const instRes = await workflowApi.getInstance(res.data.workflow_instance_id)
        setHistory(instRes.data.history || [])
      }
    } catch {
      toast.error(t('expense.notFound'))
      navigate('/expenses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpense()
  }, [id])

  const handleCancel = () => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message: t('expense.cancelConfirm'),
      onConfirm: async () => {
        try {
          await expenseApi.cancel(Number(id))
          fetchExpense()
        } catch { /* handled by axios interceptor */ }
      },
    })
  }

  if (loading) return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  )
  if (!expense) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex gap-4 mb-4">
        <Link to="/" className="text-blue-600 hover:underline text-sm">{t('common.backToHome')}</Link>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/expenses')}>
          <ArrowLeft size={14} className="inline" /> {t('expense.backToMyExpenses')}
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <h1 className="text-xl font-bold mb-4">
          {expenseTypeLabel(expense.expense_type)} {t('expense.expenseDetail')}
        </h1>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">{t('expense.status')}: </span>
            <span className={`font-medium ${expenseStatusColor(expense.status)}`}>{expense.status}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('expense.amount')}: </span>
            <span className="font-medium">¥{expense.amount}</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">{t('expense.description')}: </span>
            <span className="font-medium">{expense.description}</span>
          </div>
          {expense.attachment_urls && expense.attachment_urls.length > 0 && (
            <div className="col-span-2">
              <span className="text-gray-500">{t('expense.attachments')}: </span>
              <div className="mt-1 space-y-1">
                {expense.attachment_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block text-xs break-all">
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="col-span-2">
            <span className="text-gray-500">{t('expense.created')}: </span>
            <span className="font-medium">{new Date(expense.created_at).toLocaleString()}</span>
          </div>
        </div>

        {expense.status === 'submitted' && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              {t('expense.cancelRequest')}
            </Button>
          </div>
        )}
      </div>

      {expense.workflow_instance_id && (
        <div className="bg-white rounded-lg border p-4 mb-6 text-sm">
          <Link
            to={`/workflow/instances/${expense.workflow_instance_id}`}
            className="text-blue-600 hover:underline"
          >
            {t('expense.viewWorkflowInstance')} #{expense.workflow_instance_id}
          </Link>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-3">{t('workflow.history')}</h2>
          <div className="space-y-3">
            {[...history].reverse().map((h: HistoryItem) => (
              <div key={h.id} className="flex gap-3 text-sm">
                <div className="w-32 text-right text-gray-400 shrink-0">
                  {new Date(h.created_at).toLocaleString()}
                </div>
                <div className={`font-medium ${
                  h.action === 'approve' ? 'text-green-500' :
                  h.action === 'reject' ? 'text-red-500' :
                  h.action === 'cancel' ? 'text-gray-400' :
                  'text-blue-500'
                }`}>
                  {h.action === 'approve' ? t('workflow.approve') : h.action === 'reject' ? t('workflow.reject') : h.action}
                </div>
                <div className="text-gray-600">by User #{h.operator_id}</div>
                {h.comment && <div className="text-gray-400 italic">— "{h.comment}"</div>}
              </div>
            ))}
          </div>
        </div>
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
