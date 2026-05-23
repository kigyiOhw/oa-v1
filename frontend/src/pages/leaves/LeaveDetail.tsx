import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { leaveApi, LeaveItem, leaveTypeLabel, leaveStatusColor } from '../../api/leave'
import { workflowApi, HistoryItem } from '../../api/workflow'

export default function LeaveDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [leave, setLeave] = useState<LeaveItem | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLeave = async () => {
    try {
      const res = await leaveApi.getById(Number(id))
      setLeave(res.data)
      if (res.data.workflow_instance_id) {
        const instRes = await workflowApi.getInstance(res.data.workflow_instance_id)
        setHistory(instRes.data.history || [])
      }
    } catch {
      alert(t('leave.notFound'))
      navigate('/leaves')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeave()
  }, [id])

  const handleCancel = async () => {
    if (!confirm(t('leave.cancelConfirm'))) return
    try {
      await leaveApi.cancel(Number(id))
      fetchLeave()
    } catch { /* handled by axios interceptor */ }
  }

  if (loading) return <div className="p-8 text-gray-500">{t('common.loading')}</div>
  if (!leave) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex gap-4 mb-4">
        <Link to="/" className="text-blue-600 hover:underline text-sm">{t('common.backToHome')}</Link>
        <button
          className="text-blue-600 hover:underline text-sm"
          onClick={() => navigate('/leaves')}
        >
          &larr; {t('leave.backToMyLeaves')}
        </button>
      </div>

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
            <button
              className="px-4 py-2 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
              onClick={handleCancel}
            >
              {t('leave.cancelRequest')}
            </button>
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
    </div>
  )
}
