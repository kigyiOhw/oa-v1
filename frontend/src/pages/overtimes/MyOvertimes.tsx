import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { overtimeApi, OvertimeItem, overtimeStatusColor } from '../../api/overtime'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

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
        <Button onClick={() => navigate('/overtimes/new')}>
          + {t('overtime.newOvertime')}
        </Button>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {statusFilters.map((s) => (
          <Button
            key={s.value}
            variant={statusFilter === s.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setStatusFilter(s.value); setPage(1) }}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('overtime.timeRange')}</TableHead>
            <TableHead>{t('overtime.hours')}</TableHead>
            <TableHead>{t('overtime.reason')}</TableHead>
            <TableHead>{t('overtime.status')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {overtimes.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="text-gray-600">
                {new Date(o.start_time).toLocaleString()} ~ {new Date(o.end_time).toLocaleString()}
              </TableCell>
              <TableCell>{o.duration_hours}h</TableCell>
              <TableCell className="text-gray-600 max-w-xs truncate">{o.reason}</TableCell>
              <TableCell className={`font-medium ${overtimeStatusColor(o.status)}`}>
                {o.status}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {o.status === 'draft' && (
                    <>
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/overtimes/${o.id}/edit`)}>
                        {t('common.edit')}
                      </Button>
                      <Button variant="link" size="sm" className="h-auto p-0 text-green-600" onClick={() => handleSubmit(o.id)}>
                        {t('common.submit')}
                      </Button>
                      <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleDelete(o.id)}>
                        {t('common.delete')}
                      </Button>
                    </>
                  )}
                  {(o.status === 'submitted') && (
                    <>
                      <Link to={`/overtimes/${o.id}`} className="text-blue-600 hover:underline text-xs">
                        {t('common.view')}
                      </Link>
                      <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleCancel(o.id)}>
                        {t('overtime.cancelRequest')}
                      </Button>
                    </>
                  )}
                  {(o.status === 'approved' || o.status === 'rejected' || o.status === 'cancelled') && (
                    <Link to={`/overtimes/${o.id}`} className="text-blue-600 hover:underline text-xs">
                      {t('common.view')}
                    </Link>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {overtimes.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                {t('common.noData')}
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
