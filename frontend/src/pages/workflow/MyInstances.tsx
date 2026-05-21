import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { workflowApi, InstanceItem } from '../../api/workflow'

export default function MyInstances() {
  const [instances, setInstances] = useState<InstanceItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchInstances = async () => {
    const res = await workflowApi.listInstances({ page, page_size: pageSize })
    setInstances(res.data.items)
    setTotal(res.data.total)
  }

  useEffect(() => {
    fetchInstances()
  }, [page])

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
    }
    return map[s] || s
  }

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: 'text-blue-600',
      approved: 'text-green-600',
      rejected: 'text-red-600',
      cancelled: 'text-gray-400',
    }
    return map[s] || ''
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Instances</h1>
      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">Title</th>
            <th className="px-3 py-2 text-left">Workflow</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {instances.map((i) => (
            <tr key={i.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">
                <Link to={`/workflow/instances/${i.id}`} className="text-blue-600 hover:underline font-medium">
                  {i.title}
                </Link>
              </td>
              <td className="px-3 py-2 text-gray-600">{i.workflow_def?.name || '-'}</td>
              <td className={`px-3 py-2 font-medium ${statusColor(i.status)}`}>
                {statusLabel(i.status)}
              </td>
              <td className="px-3 py-2 text-gray-500">{new Date(i.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {instances.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                No instances yet
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
            Prev
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
