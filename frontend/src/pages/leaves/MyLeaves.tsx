import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { leaveApi, LeaveItem, leaveTypeLabel, leaveStatusColor } from '../../api/leave'

export default function MyLeaves() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [leaves, setLeaves] = useState<LeaveItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const pageSize = 20

  const fetchLeaves = async () => {
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize }
      if (statusFilter) params.status = statusFilter
      const res = await leaveApi.list(params as any)
      setLeaves(res.data.items)
      setTotal(res.data.total)
    } catch { /* handled by axios interceptor */ }
  }

  useEffect(() => {
    fetchLeaves()
  }, [page, statusFilter])

  const handleDelete = async (id: number) => {
    if (!confirm(t('leave.deleteDraftConfirm'))) return
    try {
      await leaveApi.delete(id)
      fetchLeaves()
    } catch { /* handled by axios interceptor */ }
  }

  const handleSubmit = async (id: number) => {
    if (!confirm(t('leave.submitConfirm'))) return
    try {
      await leaveApi.submit(id)
      fetchLeaves()
    } catch { /* handled by axios interceptor */ }
  }

  const handleCancel = async (id: number) => {
    if (!confirm(t('leave.cancelConfirm'))) return
    try {
      await leaveApi.cancel(id)
      fetchLeaves()
    } catch { /* handled by axios interceptor */ }
  }

  const totalPages = Math.ceil(total / pageSize)

  const statusFilters = [
    { value: '', label: t('leave.all') },
    { value: 'draft', label: t('leave.statusLabels.draft') },
    { value: 'submitted', label: t('leave.statusLabels.submitted') },
    { value: 'approved', label: t('leave.statusLabels.approved') },
    { value: 'rejected', label: t('leave.statusLabels.rejected') },
    { value: 'cancelled', label: t('leave.statusLabels.cancelled') },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('leave.myLeaves')}</h1>
        <Link
          to="/leaves/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + {t('leave.newLeave')}
        </Link>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {statusFilters.map((s) => (
          <button
            key={s.value}
            className={`px-3 py-1 text-sm rounded border ${
              statusFilter === s.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => { setStatusFilter(s.value); setPage(1) }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">{t('leave.type')}</th>
            <th className="px-3 py-2 text-left">{t('leave.dates')}</th>
            <th className="px-3 py-2 text-left">{t('leave.days')}</th>
            <th className="px-3 py-2 text-left">{t('leave.status')}</th>
            <th className="px-3 py-2 text-left">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {leaves.map((l) => (
            <tr key={l.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">{leaveTypeLabel(l.leave_type)}</td>
              <td className="px-3 py-2 text-gray-600">
                {l.start_date} ~ {l.end_date}
              </td>
              <td className="px-3 py-2">{l.duration_days}</td>
              <td className={`px-3 py-2 font-medium ${leaveStatusColor(l.status)}`}>
                {l.status}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  {l.status === 'draft' && (
                    <>
                      <button
                        className="text-blue-600 hover:underline text-xs"
                        onClick={() => navigate(`/leaves/${l.id}/edit`)}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        className="text-green-600 hover:underline text-xs"
                        onClick={() => handleSubmit(l.id)}
                      >
                        {t('common.submit')}
                      </button>
                      <button
                        className="text-red-500 hover:underline text-xs"
                        onClick={() => handleDelete(l.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </>
                  )}
                  {(l.status === 'submitted') && (
                    <>
                      <Link to={`/leaves/${l.id}`} className="text-blue-600 hover:underline text-xs">
                        {t('common.view')}
                      </Link>
                      <button
                        className="text-red-500 hover:underline text-xs"
                        onClick={() => handleCancel(l.id)}
                      >
                        {t('leave.cancelRequest')}
                      </button>
                    </>
                  )}
                  {(l.status === 'approved' || l.status === 'rejected' || l.status === 'cancelled') && (
                    <Link to={`/leaves/${l.id}`} className="text-blue-600 hover:underline text-xs">
                      {t('common.view')}
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {leaves.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                {t('common.noData')}
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
