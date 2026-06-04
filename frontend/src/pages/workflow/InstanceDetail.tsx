import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { workflowApi, InstanceItem, HistoryItem } from '../../api/workflow'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

export default function InstanceDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [instance, setInstance] = useState<InstanceItem | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchInstance = async () => {
    try {
      const res = await workflowApi.getInstance(Number(id))
      setInstance(res.data)
    } catch {
      alert('Instance not found')
      navigate('/workflow/my')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInstance()
  }, [id])

  const handleCancel = async () => {
    if (!confirm(t('workflow.cancelConfirm'))) return
    await workflowApi.cancelInstance(Number(id))
    fetchInstance()
  }

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: t('workflow.statusLabels.pending'),
      approved: t('workflow.statusLabels.approved'),
      rejected: t('workflow.statusLabels.rejected'),
      cancelled: t('workflow.statusLabels.cancelled'),
    }
    return map[s] || s
  }

  const nodeLabel = (nodeId: string) => {
    if (!instance?.workflow_def?.definition) return nodeId
    const nodes = (instance.workflow_def.definition as any).nodes || []
    const node = nodes.find((n: any) => n.id === nodeId)
    return node?.label || nodeId
  }

  if (loading) return <div className="p-8 text-gray-500">{t('common.loading')}</div>
  if (!instance) return null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex gap-4 mb-4">
        <Link to="/" className="text-blue-600 hover:underline text-sm">{t('common.backToHome')}</Link>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/workflow/my')}>
          <ArrowLeft size={14} className="inline" /> {t('workflow.backToMyInstances')}
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold mb-2">{instance.title}</h1>
            <p className="text-sm text-gray-500">
              {t('workflow.workflow')}: {instance.workflow_def?.name || 'Unknown'} &middot; v{instance.workflow_def?.version}
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              instance.status === 'pending' ? 'bg-blue-100 text-blue-700' :
              instance.status === 'approved' ? 'bg-green-100 text-green-700' :
              instance.status === 'rejected' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {statusLabel(instance.status)}
            </span>
          </div>
        </div>
        {instance.status === 'pending' && (
          <Button variant="outline" size="sm" className="mt-4 border-red-300 text-red-600" onClick={handleCancel}>
            {t('workflow.cancelInstance')}
          </Button>
        )}
      </div>

      {instance.tasks && instance.tasks.length > 0 && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3">{t('workflow.currentTasks')}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('workflow.node')}</TableHead>
                <TableHead>{t('workflow.assignee')}</TableHead>
                <TableHead>{t('workflow.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instance.tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{nodeLabel(t.node_id)}</TableCell>
                  <TableCell className="text-gray-500">User #{t.assignee_id}</TableCell>
                  <TableCell>{statusLabel(t.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {instance.history && instance.history.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-3">{t('workflow.approvalHistory')}</h2>
          <Timeline history={instance.history} nodeLabel={nodeLabel} />
        </div>
      )}
    </div>
  )
}

function Timeline({ history, nodeLabel }: { history: HistoryItem[]; nodeLabel: (id: string) => string }) {
  const actionLabel = (a: string) => {
    const map: Record<string, string> = { submit: 'Submitted', approve: 'Approved', reject: 'Rejected', cancel: 'Cancelled' }
    return map[a] || a
  }

  const actionColor = (a: string) => {
    const map: Record<string, string> = { submit: 'text-blue-500', approve: 'text-green-500', reject: 'text-red-500', cancel: 'text-gray-400' }
    return map[a] || ''
  }

  return (
    <div className="space-y-3">
      {[...history].reverse().map((h) => (
        <div key={h.id} className="flex gap-3 text-sm">
          <div className="w-24 text-right text-gray-400 shrink-0">
            {new Date(h.created_at).toLocaleString()}
          </div>
          <div className={`font-medium ${actionColor(h.action)}`}>
            {actionLabel(h.action)}
          </div>
          <div className="text-gray-600">
            {nodeLabel(h.node_id)}
          </div>
          {h.comment && <div className="text-gray-400 italic">— "{h.comment}"</div>}
        </div>
      ))}
    </div>
  )
}
