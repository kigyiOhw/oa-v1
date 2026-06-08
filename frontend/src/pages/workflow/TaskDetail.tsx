import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/toast'
import { ArrowLeft } from 'lucide-react'
import { workflowApi, TaskItem, HistoryItem } from '../../api/workflow'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import WorkflowFlowchart from '@/components/WorkflowFlowchart'
import ConfirmDialog from '@/components/ui/confirm-dialog'

export default function TaskDetail() {
  const { t } = useTranslation()
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<TaskItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)

  const fetchTask = async () => {
    try {
      const res = await workflowApi.getTask(Number(id))
      setTask(res.data)
    } catch {
      toast.error('Task not found')
      navigate('/workflow/tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTask()
  }, [id])

  const handleAction = (action: 'approve' | 'reject') => {
    const confirmMsg = action === 'approve' ? t('workflow.confirmApprove') : t('workflow.confirmReject')
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message: confirmMsg,
      onConfirm: async () => {
        setProcessing(true)
        setErrorMsg('')
        try {
          if (action === 'approve') {
            await workflowApi.approveTask(Number(id), comment || null)
          } else {
            await workflowApi.rejectTask(Number(id), comment || null)
          }
          navigate('/workflow/tasks')
        } catch (e: any) {
          setErrorMsg(e.response?.data?.detail || 'Action failed')
        } finally {
          setProcessing(false)
        }
      },
    })
  }

  const nodeLabel = (nodeId: string) => {
    const def = task?.instance?.workflow_def?.definition
    if (!def) return nodeId
    const nodes = (def as any).nodes || []
    const node = nodes.find((n: any) => n.id === nodeId)
    return node?.label || nodeId
  }

  if (loading) return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
  if (!task) return null

  const instance = task.instance

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex gap-4 mb-4">
        <Link to="/" className="text-blue-600 hover:underline text-sm">{t('common.backToHome')}</Link>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/workflow/tasks')}>
          <ArrowLeft size={14} className="inline" /> {t('workflow.backToMyTasks')}
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <h1 className="text-xl font-bold mb-2">{instance?.title || `Instance #${task.instance_id}`}</h1>
        <p className="text-sm text-gray-500">
          {t('workflow.step')}: <span className="font-medium">{nodeLabel(task.node_id)}</span>
          {' '}&middot;{' '}
          {t('workflow.workflow')}: {instance?.workflow_def?.name || 'Unknown'}
        </p>
      </div>

      {/* Flowchart */}
      {instance && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">{t('workflow.flowchart')}</h2>
          <WorkflowFlowchart
            definition={instance.workflow_def?.definition}
            tasks={instance.tasks}
            history={instance.history}
            currentNodeId={instance.current_node_id}
            status={instance.status}
          />
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {task.status === 'pending' && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">{t('workflow.process')}</h2>
          <Textarea
            className="mb-3"
            rows={3}
            placeholder={t('workflow.comment')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="success" disabled={processing} onClick={() => handleAction('approve')}>
              {processing ? t('common.processing') : t('workflow.approve')}
            </Button>
            <Button variant="destructive" disabled={processing} onClick={() => handleAction('reject')}>
              {processing ? t('common.processing') : t('workflow.reject')}
            </Button>
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
        {confirmState && (
          <ConfirmDialog
            open={confirmState.open}
            title={confirmState.title}
            message={confirmState.message}
            onConfirm={() => { confirmState.onConfirm(); setConfirmState(null) }}
            onCancel={() => setConfirmState(null)}
          />
        )}
    </div>
  )
}
