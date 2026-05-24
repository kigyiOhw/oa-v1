import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { overtimeApi, OvertimeItem, overtimeStatusColor } from '../../api/overtime'

export default function MyOvertimes() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [overtimes, setOvertimes] = useState<OvertimeItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const pageSize = 20

  const fetchOvertimes = async () => {
    try {
      const params: { page: number; page_size: number; status?: string } = { page, page_size: pageSize }
      if (statusFilter) params.status = statusFilter
      const res = await overtimeApi.list(params)
      setOvertimes(res.data.items)
      setTotal(res.data.total)
    } catch { /* handled by axios interceptor */ }
  }

  useEffect(() => {
    fetchOvertimes()
  }, [page, statusFilter])

  const handleDelete = async (id: number) => {
    if (!confirm(t('overtime.deleteDraftConfirm'))) return
    try {
      await overtimeApi.delete(id)
      fetchOvertimes()
    } catch { /* handled by axios interceptor */ }
  }

  const handleSubmit = async (id: number) => {
    if (!confirm(t('overtime.submitConfirm'))) return
    try {
      await overtimeApi.submit(id)
      fetchOvertimes()
    } catch { /* handled by axios interceptor */ }
  }

  const handleCancel = async (id: number) => {
    if (!confirm(t('overtime.cancelConfirm'))) return
    try {
      await overtimeApi.cancel(id)
      fetchOvertimes()
    } catch { /* handled by axios interceptor */ }
  }

  const totalPages = Math.ceil(total / pageSize)

  const statusFilters = [
    { value: '', label: t('overtime.all') },
    { value: 'draft', label: t('overtime.statusLabels.draft') },
    { value: 'submitted', label: t('overtime.statusLabels.submitted') },
    { value: 'approved', label: t('overtime.statusLabels.approved') },
    { value: 'rejected', label: t('overtime.statusLabels.rejected') },
    { value: 'cancelled', label: t('overtime.statusLabels.cancelled') },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('overtime.myOvertimes')}</h1>
        <Link
          to="/overtimes/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + {t('overtime.newOvertime')}
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
            <th className="px-3 py-2 text-left">{t('overtime.timeRange')}</th>
            <th className="px-3 py-2 text-left">{t('overtime.hours')}</th>
            <th className="px-3 py-2 text-left">{t('overtime.reason')}</th>
            <th className="px-3 py-2 text-left">{t('overtime.status')}</th>
            <th className="px-3 py-2 text-left">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {overtimes.map((o) => (
            <tr key={o.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-600">
                {new Date(o.start_time).toLocaleString()} ~ {new Date(o.end_time).toLocaleString()}
              </td>
              <td className="px-3 py-2">{o.duration_hours}h</td>
              <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{o.reason}</td>
              <td className={`px-3 py-2 font-medium ${overtimeStatusColor(o.status)}`}>
                {o.status}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  {o.status === 'draft' && (
                    <>
                      <button
                        className="text-blue-600 hover:underline text-xs"
                        onClick={() => navigate(`/overtimes/${o.id}/edit`)}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        className="text-green-600 hover:underline text-xs"
                        onClick={() => handleSubmit(o.id)}
                      >
                        {t('common.submit')}
                      </button>
                      <button
                        className="text-red-500 hover:underline text-xs"
                        onClick={() => handleDelete(o.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </>
                  )}
                  {(o.status === 'submitted') && (
                    <>
                      <Link to={`/overtimes/${o.id}`} className="text-blue-600 hover:underline text-xs">
                        {t('common.view')}
                      </Link>
                      <button
                        className="text-red-500 hover:underline text-xs"
                        onClick={() => handleCancel(o.id)}
                      >
                        {t('overtime.cancelRequest')}
                      </button>
                    </>
                  )}
                  {(o.status === 'approved' || o.status === 'rejected' || o.status === 'cancelled') && (
                    <Link to={`/overtimes/${o.id}`} className="text-blue-600 hover:underline text-xs">
                      {t('common.view')}
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {overtimes.length === 0 && (
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
