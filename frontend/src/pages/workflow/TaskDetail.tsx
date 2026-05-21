import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { workflowApi, TaskItem, HistoryItem } from '../../api/workflow'

export default function TaskDetail() {
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
    if (!confirm(`Confirm ${action}?`)) return
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

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!task) return null

  const instance = task.instance

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <button
        className="text-blue-600 hover:underline text-sm mb-4 inline-block"
        onClick={() => navigate('/workflow/tasks')}
      >
        &larr; Back to My Tasks
      </button>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <h1 className="text-xl font-bold mb-2">{instance?.title || `Instance #${task.instance_id}`}</h1>
        <p className="text-sm text-gray-500">
          Step: <span className="font-medium">{nodeLabel(task.node_id)}</span>
          {' '}&middot;{' '}
          Workflow: {instance?.workflow_def?.name || 'Unknown'}
        </p>
      </div>

      {task.status === 'pending' && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">Process</h2>
          <textarea
            className="block w-full border rounded px-3 py-2 text-sm mb-3"
            rows={3}
            placeholder="Add a comment (optional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
              disabled={processing}
              onClick={() => handleAction('approve')}
            >
              {processing ? 'Processing...' : 'Approve'}
            </button>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
              disabled={processing}
              onClick={() => handleAction('reject')}
            >
              {processing ? 'Processing...' : 'Reject'}
            </button>
          </div>
        </div>
      )}

      {instance?.history && instance.history.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-3">History</h2>
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
                  {h.action === 'approve' ? 'Approved' : h.action === 'reject' ? 'Rejected' : h.action}
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
