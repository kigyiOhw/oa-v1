import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { overtimeApi, OvertimeItem, overtimeStatusColor } from '../../api/overtime'
import { workflowApi, HistoryItem } from '../../api/workflow'

export default function OvertimeDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [overtime, setOvertime] = useState<OvertimeItem | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOvertime = async () => {
    try {
      const res = await overtimeApi.getById(Number(id))
      setOvertime(res.data)
      if (res.data.workflow_instance_id) {
        const instRes = await workflowApi.getInstance(res.data.workflow_instance_id)
        setHistory(instRes.data.history || [])
      }
    } catch {
      alert(t('overtime.notFound'))
      navigate('/overtimes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOvertime()
  }, [id])

  const handleCancel = async () => {
    if (!confirm(t('overtime.cancelConfirm'))) return
    try {
      await overtimeApi.cancel(Number(id))
      fetchOvertime()
    } catch { /* handled by axios interceptor */ }
  }

  if (loading) return <div className="p-8 text-gray-500">{t('common.loading')}</div>
  if (!overtime) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex gap-4 mb-4">
        <Link to="/" className="text-blue-600 hover:underline text-sm">{t('common.backToHome')}</Link>
        <button
          className="text-blue-600 hover:underline text-sm"
          onClick={() => navigate('/overtimes')}
        >
          &larr; {t('overtime.backToMyOvertimes')}
        </button>
      </div>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <h1 className="text-xl font-bold mb-4">
          {t('overtime.overtimeDetail')}
        </h1>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">{t('overtime.status')}: </span>
            <span className={`font-medium ${overtimeStatusColor(overtime.status)}`}>{overtime.status}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('overtime.duration')}: </span>
            <span className="font-medium">{overtime.duration_hours} hours</span>
          </div>
          <div>
            <span className="text-gray-500">{t('overtime.startTime')}: </span>
            <span className="font-medium">{new Date(overtime.start_time).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('overtime.endTime')}: </span>
            <span className="font-medium">{new Date(overtime.end_time).toLocaleString()}</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">{t('overtime.reason')}: </span>
            <span className="font-medium">{overtime.reason}</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500">{t('overtime.created')}: </span>
            <span className="font-medium">{new Date(overtime.created_at).toLocaleString()}</span>
          </div>
        </div>

        {overtime.status === 'submitted' && (
          <div className="mt-4 pt-4 border-t">
            <button
              className="px-4 py-2 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
              onClick={handleCancel}
            >
              {t('overtime.cancelRequest')}
            </button>
          </div>
        )}
      </div>

      {overtime.workflow_instance_id && (
        <div className="bg-white rounded-lg border p-4 mb-6 text-sm">
          <Link
            to={`/workflow/instances/${overtime.workflow_instance_id}`}
            className="text-blue-600 hover:underline"
          >
            {t('overtime.viewWorkflowInstance')} #{overtime.workflow_instance_id}
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
