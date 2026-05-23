import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { consumableApi, type ConsumableItem } from '../../api/consumables'

export default function Consumables() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<ConsumableItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const fetchItems = useCallback(async () => {
    const res = await consumableApi.list({
      page,
      page_size: 20,
      search: search || undefined,
    })
    setItems(res.data.items)
    setTotal(res.data.total)
  }, [page, search])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleDelete = async (id: number) => {
    if (!confirm(t('consumable.deleteConfirm'))) return
    try {
      await consumableApi.delete(id)
      fetchItems()
    } catch { /* handled by axios */ }
  }

  const isLowStock = (item: ConsumableItem) => item.current_stock <= item.safety_stock

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('consumable.title')}</h1>
        <Link to="/admin/consumables/new" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          + {t('consumable.createConsumable')}
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder={t('common.search') + '...'}
          className="border rounded px-3 py-1.5 text-sm w-56"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">{t('consumable.consumableName')}</th>
            <th className="px-3 py-2 text-left">{t('consumable.category')}</th>
            <th className="px-3 py-2 text-left">{t('consumable.unit')}</th>
            <th className="px-3 py-2 text-left">{t('consumable.currentStock')}</th>
            <th className="px-3 py-2 text-left">{t('consumable.safetyStock')}</th>
            <th className="px-3 py-2 text-left">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={`border-t hover:bg-gray-50 ${isLowStock(item) ? 'bg-red-50' : ''}`}>
              <td className="px-3 py-2">
                {item.name}
                {isLowStock(item) && (
                  <span className="ml-2 text-xs text-red-600 font-medium">{t('consumable.lowStock')}</span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-600">{item.category && (item.category as any).name ? (item.category as any).name : '-'}</td>
              <td className="px-3 py-2">{item.unit}</td>
              <td className={`px-3 py-2 font-medium ${isLowStock(item) ? 'text-red-600' : ''}`}>{item.current_stock}</td>
              <td className="px-3 py-2 text-gray-500">{item.safety_stock}</td>
              <td className="px-3 py-2 space-x-2">
                <button onClick={() => navigate(`/admin/consumables/${item.id}`)} className="text-blue-600 hover:underline text-xs">
                  {t('common.view')}
                </button>
                <button onClick={() => navigate(`/admin/consumables/${item.id}/edit`)} className="text-blue-600 hover:underline text-xs">
                  {t('common.edit')}
                </button>
                <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:underline text-xs">
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
        <span>{t('common.total')}: {total}</span>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-2 py-0.5 border rounded disabled:opacity-30">
          {t('common.prev')}
        </button>
        <span>{t('common.page')} {page}</span>
        <button disabled={page * 20 >= total} onClick={() => setPage(page + 1)} className="px-2 py-0.5 border rounded disabled:opacity-30">
          {t('common.next')}
        </button>
      </div>
    </div>
  )
}
