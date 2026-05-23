import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { workflowApi, TaskItem, HistoryItem } from '../../api/workflow'

export default function TaskDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<TaskItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchTask = async () => {
    try {
      const res = await workflowApi.getTask(Number(id))
      setTask(res.data)
    } catch {
      alert('Task not found')
      navigate('/workflow/tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTask()
  }, [id])

  const handleAction = async (action: 'approve' | 'reject') => {
    const confirmMsg = action === 'approve' ? t('workflow.confirmApprove') : t('workflow.confirmReject')
    if (!confirm(confirmMsg)) return
    setProcessing(true)
    try {
      if (action === 'approve') {
        await workflowApi.approveTask(Number(id), comment || null)
      } else {
        await workflowApi.rejectTask(Number(id), comment || null)
      }
      navigate('/workflow/tasks')
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Action failed')
    } finally {
      setProcessing(false)
    }
  }

  const nodeLabel = (nodeId: string) => {
    const def = task?.instance?.workflow_def?.definition
    if (!def) return nodeId
    const nodes = (def as any).nodes || []
    const node = nodes.find((n: any) => n.id === nodeId)
    return node?.label || nodeId
  }

  if (loading) return <div className="p-8 text-gray-500">{t('common.loading')}</div>
  if (!task) return null

  const instance = task.instance

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex gap-4 mb-4">
        <Link to="/" className="text-blue-600 hover:underline text-sm">{t('common.backToHome')}</Link>
        <button
          className="text-blue-600 hover:underline text-sm"
          onClick={() => navigate('/workflow/tasks')}
        >
          &larr; {t('workflow.backToMyTasks')}
        </button>
      </div>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <h1 className="text-xl font-bold mb-2">{instance?.title || `Instance #${task.instance_id}`}</h1>
        <p className="text-sm text-gray-500">
          {t('workflow.step')}: <span className="font-medium">{nodeLabel(task.node_id)}</span>
          {' '}&middot;{' '}
          {t('workflow.workflow')}: {instance?.workflow_def?.name || 'Unknown'}
        </p>
      </div>

      {task.status === 'pending' && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">{t('workflow.process')}</h2>
          <textarea
            className="block w-full border rounded px-3 py-2 text-sm mb-3"
            rows={3}
            placeholder={t('workflow.comment')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
              disabled={processing}
              onClick={() => handleAction('approve')}
            >
              {processing ? t('common.processing') : t('workflow.approve')}
            </button>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
              disabled={processing}
              onClick={() => handleAction('reject')}
            >
              {processing ? t('common.processing') : t('workflow.reject')}
            </button>
          </div>
        </div>
      )}

      {instance?.history && instance.history.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-3">{t('workflow.history')}</h2>
          <div className="space-y-3">
            {[...instance.history].reverse().map((h: HistoryItem) => (
              <div key={h.id} className="flex gap-3 text-sm">
                <div className="w-24 text-right text-gray-400 shrink-0">
                  {new Date(h.created_at).toLocaleString()}
                </div>
                <div className={`font-medium ${
                  h.action === 'approve' ? 'text-green-500' :
                  h.action === 'reject' ? 'text-red-500' :
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
