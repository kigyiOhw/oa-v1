import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { consumableApi, type ConsumableDetail as ConsumableDetailType } from '../../api/consumables'

export default function ConsumableDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = window.location.pathname.endsWith('/edit')

  const [item, setItem] = useState<ConsumableDetailType | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit form
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [unit, setUnit] = useState('')
  const [safetyStock, setSafetyStock] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  // Stock dialog
  const [stockOpen, setStockOpen] = useState<'in' | 'out' | null>(null)
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')

  // Create mode
  const isCreate = !id

  const fetchItem = useCallback(async () => {
    if (!id) { setLoading(false); return }
    try {
      const res = await consumableApi.getById(Number(id))
      setItem(res.data)
      if (isEdit) {
        setName(res.data.name)
        setCategoryId(res.data.category_id)
        setUnit(res.data.unit)
        setSafetyStock(String(res.data.safety_stock))
        setDescription(res.data.description || '')
      }
    } catch { /* ok */ }
    finally { setLoading(false) }
  }, [id, isEdit])

  useEffect(() => { fetchItem() }, [fetchItem])

  const handleSave = async () => {
    if (!name) return
    setSaving(true)
    const data: Record<string, unknown> = {
      name,
      category_id: categoryId,
      unit,
      safety_stock: safetyStock ? Number(safetyStock) : 0,
      description: description || null,
    }
    try {
      if (isCreate) {
        await consumableApi.create(data)
      } else if (id) {
        await consumableApi.update(Number(id), data)
      }
      navigate('/admin/consumables')
    } catch { /* handled by axios */ }
    finally { setSaving(false) }
  }

  const handleStock = async () => {
    if (!item || !quantity) return
    setSaving(true)
    try {
      const res = stockOpen === 'in'
        ? await consumableApi.stockIn(item.id, Number(quantity), notes || undefined)
        : await consumableApi.stockOut(item.id, Number(quantity), notes || undefined)
      setItem(res.data)
      setStockOpen(null)
      setQuantity('')
      setNotes('')
    } catch { /* handled by axios */ }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 text-center text-gray-500">{t('common.loading')}</div>
  if (!item && !isCreate) return <div className="p-6 text-center text-red-500">Not found</div>

  // Edit/Create form
  if (isEdit || isCreate) {
    return (
      <div>
        <button onClick={() => navigate('/admin/consumables')} className="text-sm text-blue-600 hover:underline mb-4 inline-block">
          &larr; {t('consumable.title')}
        </button>
        <h1 className="text-2xl font-bold mb-6">{isCreate ? t('consumable.createConsumable') : t('consumable.editConsumable')}</h1>

        <div className="rounded-lg bg-white p-6 shadow max-w-2xl space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.consumableName')} *</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.category')}</label>
              <select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="">--</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.unit')}</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="个/箱/包..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.safetyStock')}</label>
              <input type="number" step="0.1" value={safetyStock} onChange={(e) => setSafetyStock(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.description')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button onClick={() => navigate('/admin/consumables')}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Detail view
  if (!item) return null
  const isLow = item.current_stock <= item.safety_stock

  return (
    <div>
      <button onClick={() => navigate('/admin/consumables')} className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        &larr; {t('consumable.title')}
      </button>
      <h1 className="text-2xl font-bold mb-6">{item.name}</h1>

      <div className="rounded-lg bg-white p-6 shadow space-y-6 max-w-2xl">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('consumable.editConsumable')}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">{t('consumable.consumableName')}</span>
              <p className="font-medium">{item.name}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('consumable.category')}</span>
              <p className="font-medium">{item.category && (item.category as any).name ? (item.category as any).name : '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('consumable.unit')}</span>
              <p className="font-medium">{item.unit}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('consumable.currentStock')}</span>
              <p className={`font-medium text-lg ${isLow ? 'text-red-600' : ''}`}>
                {item.current_stock} {isLow && <span className="text-xs ml-1">({t('consumable.lowStock')})</span>}
              </p>
            </div>
            <div>
              <span className="text-gray-500">{t('consumable.safetyStock')}</span>
              <p className="font-medium">{item.safety_stock}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('consumable.description')}</span>
              <p className="font-medium">{item.description || '-'}</p>
            </div>
          </div>
        </section>

        <div className="flex gap-2 pt-2 border-t">
          <button onClick={() => navigate(`/admin/consumables/${item.id}/edit`)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {t('common.edit')}
          </button>
          <button onClick={() => setStockOpen('in')}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            {t('consumable.stockIn')}
          </button>
          <button onClick={() => setStockOpen('out')}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
            {t('consumable.stockOut')}
          </button>
        </div>

        {/* Stock history */}
        <section className="border-t pt-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('consumable.stockHistory')}</h2>
          {!item.records || item.records.length === 0 ? (
            <p className="text-sm text-gray-400">{t('common.noData')}</p>
          ) : (
            <table className="w-full text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">{t('common.actions')}</th>
                  <th className="px-3 py-2 text-left">{t('consumable.quantity')}</th>
                  <th className="px-3 py-2 text-left">{t('consumable.description')}</th>
                  <th className="px-3 py-2 text-left">{t('leave.dates')}</th>
                </tr>
              </thead>
              <tbody>
                {item.records.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${r.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.type === 'in' ? t('consumable.stockIn') : t('consumable.stockOut')}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{r.quantity} {item.unit}</td>
                    <td className="px-3 py-2 text-gray-500">{r.notes || '-'}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{r.record_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* Stock dialog */}
      {stockOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-lg font-bold mb-4">
              {stockOpen === 'in' ? t('consumable.stockIn') : t('consumable.stockOut')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.quantity')} ({item.unit})</label>
                <input type="number" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.notes')}</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleStock} disabled={saving || !quantity}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <button onClick={() => setStockOpen(null)}
                className="flex-1 rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
