import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { expenseApi, ExpenseItem, expenseTypeLabel, expenseStatusColor } from '../../api/expense'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ui/confirm-dialog'

export default function MyExpenses() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const pageSize = 20
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)

  const fetchExpenses = async () => {
    try {
      const params: { page: number; page_size: number; status?: string } = { page, page_size: pageSize }
      if (statusFilter) params.status = statusFilter
      const res = await expenseApi.list(params)
      setExpenses(res.data.items)
      setTotal(res.data.total)
    } catch { /* handled by axios interceptor */ }
  }

  useEffect(() => {
    fetchExpenses()
  }, [page, statusFilter])

  const confirmAction = (message: string, action: () => Promise<void>) => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message,
      onConfirm: async () => {
        try { await action(); fetchExpenses() } catch { /* handled by axios interceptor */ }
      },
    })
  }

  const handleDelete = (id: number) => confirmAction(t('expense.deleteDraftConfirm'), async () => { await expenseApi.delete(id) })
  const handleSubmit = (id: number) => confirmAction(t('expense.submitConfirm'), async () => { await expenseApi.submit(id) })
  const handleCancel = (id: number) => confirmAction(t('expense.cancelConfirm'), async () => { await expenseApi.cancel(id) })

  const totalPages = Math.ceil(total / pageSize)

  const statusFilters = [
    { value: '', label: t('expense.all') },
    { value: 'draft', label: t('expense.statusLabels.draft') },
    { value: 'submitted', label: t('expense.statusLabels.submitted') },
    { value: 'approved', label: t('expense.statusLabels.approved') },
    { value: 'rejected', label: t('expense.statusLabels.rejected') },
    { value: 'cancelled', label: t('expense.statusLabels.cancelled') },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('expense.myExpenses')}</h1>
        <Button onClick={() => navigate('/expenses/new')}>
          + {t('expense.newExpense')}
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
            <TableHead>{t('expense.type')}</TableHead>
            <TableHead>{t('expense.amount')}</TableHead>
            <TableHead>{t('expense.description')}</TableHead>
            <TableHead>{t('expense.status')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{expenseTypeLabel(e.expense_type)}</TableCell>
              <TableCell>¥{e.amount}</TableCell>
              <TableCell className="text-gray-600 max-w-xs truncate">{e.description}</TableCell>
              <TableCell className={`font-medium ${expenseStatusColor(e.status)}`}>
                {e.status}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {e.status === 'draft' && (
                    <>
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/expenses/${e.id}/edit`)}>
                        {t('common.edit')}
                      </Button>
                      <Button variant="link" size="sm" className="h-auto p-0 text-green-600" onClick={() => handleSubmit(e.id)}>
                        {t('common.submit')}
                      </Button>
                      <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleDelete(e.id)}>
                        {t('common.delete')}
                      </Button>
                    </>
                  )}
                  {(e.status === 'submitted') && (
                    <>
                      <Link to={`/expenses/${e.id}`} className="text-blue-600 hover:underline text-xs">
                        {t('common.view')}
                      </Link>
                      <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleCancel(e.id)}>
                        {t('expense.cancelRequest')}
                      </Button>
                    </>
                  )}
                  {(e.status === 'approved' || e.status === 'rejected' || e.status === 'cancelled') && (
                    <Link to={`/expenses/${e.id}`} className="text-blue-600 hover:underline text-xs">
                      {t('common.view')}
                    </Link>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {expenses.length === 0 && (
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
