import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { leaveApi, LeaveItem, leaveTypeLabel, leaveStatusColor } from '../../api/leave'
import { workflowApi, HistoryItem } from '../../api/workflow'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'

export default function LeaveDetail() {
  const { t } = useTranslation()
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [leave, setLeave] = useState<LeaveItem | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)

  const fetchLeave = async () => {
    try {
      const res = await leaveApi.getById(Number(id))
      setLeave(res.data)
      if (res.data.workflow_instance_id) {
        const instRes = await workflowApi.getInstance(res.data.workflow_instance_id)
        setHistory(instRes.data.history || [])
      }
    } catch {
      toast.error(t('leave.notFound'))
      navigate('/leaves')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeave()
  }, [id])

  const handleCancel = () => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message: t('leave.cancelConfirm'),
      onConfirm: async () => {
        try {
          await leaveApi.cancel(Number(id))
          fetchLeave()
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
  if (!leave) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Breadcrumb items={[
        { label: t('common.backToHome').replace('← ', ''), href: '/' },
        { label: t('leave.myLeaves'), href: '/leaves' },
        { label: `${leaveTypeLabel(leave.leave_type)} ${t('leave.leaveDetail')}` },
      ]} />

      <div className="bg-white rounded-lg border p-6 mb-6">
        <h1 className="text-xl font-bold mb-4">
          {leaveTypeLabel(leave.leave_type)} {t('leave.leaveDetail')}
        </h1>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">{t('leave.status')}: </span>
            <span className={`font-medium ${leaveStatusColor(leave.status)}`}>{leave.status}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('leave.duration')}: </span>
            <span className="font-medium">{leave.duration_days} day(s)</span>
          </div>
          <div>
            <span className="text-gray-500">{t('leave.startDate')}: </span>
            <span className="font-medium">{leave.start_date}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('leave.endDate')}: </span>
            <span className="font-medium">{leave.end_date}</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">{t('leave.reason')}: </span>
            <span className="font-medium">{leave.reason}</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">{t('leave.created')}: </span>
            <span className="font-medium">{new Date(leave.created_at).toLocaleString()}</span>
          </div>
        </div>

        {leave.status === 'submitted' && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              {t('leave.cancelRequest')}
            </Button>
          </div>
        )}
      </div>

      {leave.workflow_instance_id && (
        <div className="bg-white rounded-lg border p-4 mb-6 text-sm">
          <Link
            to={`/workflow/instances/${leave.workflow_instance_id}`}
            className="text-blue-600 hover:underline"
          >
            {t('leave.viewWorkflowInstance')} #{leave.workflow_instance_id}
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
