import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { workflowApi, TaskItem } from '../../api/workflow'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

export default function MyTasks() {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchTasks = async () => {
    const res = await workflowApi.listTasks({ page, page_size: pageSize })
    setTasks(res.data.items)
    setTotal(res.data.total)
  }

  useEffect(() => {
    fetchTasks()
  }, [page])

  const nodeLabel = (task: TaskItem) => {
    const def = task.instance?.workflow_def?.definition
    if (!def) return task.node_id
    const nodes = (def as any).nodes || []
    const node = nodes.find((n: any) => n.id === task.node_id)
    return node?.label || task.node_id
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
      <h1 className="text-2xl font-bold mb-6">{t('workflow.myTasks')}</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Instance</TableHead>
            <TableHead>{t('workflow.workflow')}</TableHead>
            <TableHead>{t('workflow.step')}</TableHead>
            <TableHead>{t('workflow.created')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <Link to={`/workflow/tasks/${t.id}`} className="text-blue-600 hover:underline font-medium">
                  {t.instance?.title || `#${t.instance_id}`}
                </Link>
              </TableCell>
              <TableCell className="text-gray-600">{t.instance?.workflow_def?.name || '-'}</TableCell>
              <TableCell>{nodeLabel(t)}</TableCell>
              <TableCell className="text-gray-500">{new Date(t.created_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {tasks.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                {t('workflow.noTasks')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('common.prev')}
          </Button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  )
}
