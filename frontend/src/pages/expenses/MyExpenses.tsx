import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { expenseApi, ExpenseItem, expenseTypeLabel, expenseStatusColor } from '../../api/expense'

export default function MyExpenses() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const pageSize = 20

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

  const handleDelete = async (id: number) => {
    if (!confirm(t('expense.deleteDraftConfirm'))) return
    try {
      await expenseApi.delete(id)
      fetchExpenses()
    } catch { /* handled by axios interceptor */ }
  }

  const handleSubmit = async (id: number) => {
    if (!confirm(t('expense.submitConfirm'))) return
    try {
      await expenseApi.submit(id)
      fetchExpenses()
    } catch { /* handled by axios interceptor */ }
  }

  const handleCancel = async (id: number) => {
    if (!confirm(t('expense.cancelConfirm'))) return
    try {
      await expenseApi.cancel(id)
      fetchExpenses()
    } catch { /* handled by axios interceptor */ }
  }

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
        <Link
          to="/expenses/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + {t('expense.newExpense')}
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
            <th className="px-3 py-2 text-left">{t('expense.type')}</th>
            <th className="px-3 py-2 text-left">{t('expense.amount')}</th>
            <th className="px-3 py-2 text-left">{t('expense.description')}</th>
            <th className="px-3 py-2 text-left">{t('expense.status')}</th>
            <th className="px-3 py-2 text-left">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">{expenseTypeLabel(e.expense_type)}</td>
              <td className="px-3 py-2">¥{e.amount}</td>
              <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{e.description}</td>
              <td className={`px-3 py-2 font-medium ${expenseStatusColor(e.status)}`}>
                {e.status}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  {e.status === 'draft' && (
                    <>
                      <button
                        className="text-blue-600 hover:underline text-xs"
                        onClick={() => navigate(`/expenses/${e.id}/edit`)}
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        className="text-green-600 hover:underline text-xs"
                        onClick={() => handleSubmit(e.id)}
                      >
                        {t('common.submit')}
                      </button>
                      <button
                        className="text-red-500 hover:underline text-xs"
                        onClick={() => handleDelete(e.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </>
                  )}
                  {(e.status === 'submitted') && (
                    <>
                      <Link to={`/expenses/${e.id}`} className="text-blue-600 hover:underline text-xs">
                        {t('common.view')}
                      </Link>
                      <button
                        className="text-red-500 hover:underline text-xs"
                        onClick={() => handleCancel(e.id)}
                      >
                        {t('expense.cancelRequest')}
                      </button>
                    </>
                  )}
                  {(e.status === 'approved' || e.status === 'rejected' || e.status === 'cancelled') && (
                    <Link to={`/expenses/${e.id}`} className="text-blue-600 hover:underline text-xs">
                      {t('common.view')}
                    </Link>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {expenses.length === 0 && (
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
