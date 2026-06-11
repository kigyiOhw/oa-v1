import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { consumableApi, type ConsumableDetail as ConsumableDetailType } from '../../api/consumables'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumb } from '@/components/ui/breadcrumb'

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

  if (loading) return (
    <div className="p-6 space-y-4 max-w-2xl">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  )
  if (!item && !isCreate) return <div className="p-6 text-center text-red-500">Not found</div>

  // Edit/Create form
  if (isEdit || isCreate) {
    return (
      <div>
        <Breadcrumb items={[
          { label: t('admin.title'), href: '/admin' },
          { label: t('consumable.title'), href: '/admin/consumables' },
          { label: isCreate ? t('consumable.createConsumable') : t('consumable.editConsumable') },
        ]} />
        <h1 className="text-2xl font-bold mb-6">{isCreate ? t('consumable.createConsumable') : t('consumable.editConsumable')}</h1>

        <div className="rounded-lg bg-white p-6 shadow max-w-2xl space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.consumableName')} *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.category')}</label>
              <Select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">--</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.unit')}</label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t('consumable.unitPlaceholder')} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.safetyStock')}</label>
              <Input type="number" step="0.1" value={safetyStock} onChange={(e) => setSafetyStock(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.description')}</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/consumables')}>
              {t('common.cancel')}
            </Button>
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
      <Breadcrumb items={[
        { label: t('admin.title'), href: '/admin' },
        { label: t('consumable.title'), href: '/admin/consumables' },
        { label: item.name },
      ]} />
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
          <Button onClick={() => navigate(`/admin/consumables/${item.id}/edit`)}>
            {t('common.edit')}
          </Button>
          <Button variant="success" onClick={() => setStockOpen('in')}>
            {t('consumable.stockIn')}
          </Button>
          <Button variant="warning" onClick={() => setStockOpen('out')}>
            {t('consumable.stockOut')}
          </Button>
        </div>

        {/* Stock history */}
        <section className="border-t pt-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('consumable.stockHistory')}</h2>
          {!item.records || item.records.length === 0 ? (
            <p className="text-sm text-gray-400">{t('common.noData')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.actions')}</TableHead>
                  <TableHead>{t('consumable.quantity')}</TableHead>
                  <TableHead>{t('consumable.description')}</TableHead>
                  <TableHead>{t('leave.dates')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${r.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.type === 'in' ? t('consumable.stockIn') : t('consumable.stockOut')}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{r.quantity} {item.unit}</TableCell>
                    <TableCell className="text-muted-foreground">{r.notes || '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.record_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
                <Input type="number" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('consumable.notes')}</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleStock} disabled={saving || !quantity} className="flex-1">
                {saving ? t('common.saving') : t('common.save')}
              </Button>
              <Button variant="outline" onClick={() => setStockOpen(null)} className="flex-1">
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
