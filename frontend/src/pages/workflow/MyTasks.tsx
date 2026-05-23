import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { workflowApi, TaskItem } from '../../api/workflow'

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
      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">Instance</th>
            <th className="px-3 py-2 text-left">{t('workflow.workflow')}</th>
            <th className="px-3 py-2 text-left">{t('workflow.step')}</th>
            <th className="px-3 py-2 text-left">{t('workflow.created')}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">
                <Link to={`/workflow/tasks/${t.id}`} className="text-blue-600 hover:underline font-medium">
                  {t.instance?.title || `#${t.instance_id}`}
                </Link>
              </td>
              <td className="px-3 py-2 text-gray-600">{t.instance?.workflow_def?.name || '-'}</td>
              <td className="px-3 py-2">{nodeLabel(t)}</td>
              <td className="px-3 py-2 text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                {t('workflow.noTasks')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t('common.prev')}
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
          <button
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  )
}
