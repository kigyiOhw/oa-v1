import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { leaveApi, LeaveItem, leaveTypeLabel, leaveStatusColor } from '../../api/leave'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import ConfirmDialog from '@/components/ui/confirm-dialog'

export default function MyLeaves() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [leaves, setLeaves] = useState<LeaveItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const pageSize = 20
  const [loading, setLoading] = useState(true)
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)

  const fetchLeaves = async () => {
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize }
      if (statusFilter) params.status = statusFilter
      const res = await leaveApi.list(params as any)
      setLeaves(res.data.items)
      setTotal(res.data.total)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchLeaves()
  }, [page, statusFilter])

  const confirmAction = (message: string, action: () => Promise<void>) => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message,
      onConfirm: async () => {
        try { await action(); fetchLeaves() } catch { /* handled by axios interceptor */ }
      },
    })
  }

  const handleDelete = (id: number) => confirmAction(t('leave.deleteDraftConfirm'), async () => { await leaveApi.delete(id) })
  const handleSubmit = (id: number) => confirmAction(t('leave.submitConfirm'), async () => { await leaveApi.submit(id) })
  const handleCancel = (id: number) => confirmAction(t('leave.cancelConfirm'), async () => { await leaveApi.cancel(id) })

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
        <Button onClick={() => navigate('/leaves/new')}>
          + {t('leave.newLeave')}
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
            <TableHead>{t('leave.type')}</TableHead>
            <TableHead>{t('leave.dates')}</TableHead>
            <TableHead>{t('leave.days')}</TableHead>
            <TableHead>{t('leave.status')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              </TableRow>
            ))
          ) : leaves.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState title={t('leave.myLeaves')} action={{ label: t('leave.newLeave'), onClick: () => navigate('/leaves/new') }} />
              </TableCell>
            </TableRow>
          ) : (
            leaves.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{leaveTypeLabel(l.leave_type)}</TableCell>
              <TableCell className="text-gray-600">
                {l.start_date} ~ {l.end_date}
              </TableCell>
              <TableCell>{l.duration_days}</TableCell>
              <TableCell className={`font-medium ${leaveStatusColor(l.status)}`}>
                {l.status}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {l.status === 'draft' && (
                    <>
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/leaves/${l.id}/edit`)}>
                        {t('common.edit')}
                      </Button>
                      <Button variant="link" size="sm" className="h-auto p-0 text-green-600" onClick={() => handleSubmit(l.id)}>
                        {t('common.submit')}
                      </Button>
                      <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleDelete(l.id)}>
                        {t('common.delete')}
                      </Button>
                    </>
                  )}
                  {(l.status === 'submitted') && (
                    <>
                      <Link to={`/leaves/${l.id}`} className="text-blue-600 hover:underline text-xs">
                        {t('common.view')}
                      </Link>
                      <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleCancel(l.id)}>
                        {t('leave.cancelRequest')}
                      </Button>
                    </>
                  )}
                  {(l.status === 'approved' || l.status === 'rejected' || l.status === 'cancelled') && (
                    <Link to={`/leaves/${l.id}`} className="text-blue-600 hover:underline text-xs">
                      {t('common.view')}
                    </Link>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )))}
          {leaves.length === 0 && !loading && (
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
        {confirmState && (
          <ConfirmDialog
            open={confirmState.open}
            title={confirmState.title}
            message={confirmState.message}
            variant="destructive"
            onConfirm={() => { confirmState.onConfirm(); setConfirmState(null) }}
            onCancel={() => setConfirmState(null)}
          />
        )}
    </div>
  )
}
