import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { assetApi } from '../../api/assets'
import { deptApi, type DepartmentItem } from '../../api/departments'

export default function AssetCreate() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [departmentId, setDepartmentId] = useState<number | null>(null)
  const [status, setStatus] = useState('idle')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [supplier, setSupplier] = useState('')
  const [specification, setSpecification] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [departments, setDepartments] = useState<DepartmentItem[]>([])

  useEffect(() => {
    assetApi.listCategories().then((r) => {
      const flat: { id: number; name: string }[] = []
      const walk = (nodes: any[], depth: number) => {
        for (const n of nodes) {
          flat.push({ id: n.id, name: '—'.repeat(depth) + n.name })
          if (n.children?.length) walk(n.children, depth + 1)
        }
      }
      walk(r.data, 0)
      setCategories(flat)
    })
    deptApi.list().then((r) => setDepartments(r.data))
  }, [])

  useEffect(() => {
    if (!id) return
    assetApi.getById(Number(id)).then((res) => {
      const a = res.data
      setName(a.name)
      setCategoryId(a.category_id)
      setDepartmentId(a.department_id)
      setStatus(a.status)
      setPurchaseDate(a.purchase_date || '')
      setPurchasePrice(a.purchase_price != null ? String(a.purchase_price) : '')
      setSupplier(a.supplier || '')
      setSpecification(a.specification ? JSON.stringify(a.specification) : '')
      setDescription(a.description || '')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    if (!name || !categoryId) return
    setSaving(true)
    const data: Record<string, unknown> = {
      name,
      category_id: categoryId,
      department_id: departmentId || null,
      status,
      purchase_date: purchaseDate || null,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      supplier: supplier || null,
      specification: specification ? JSON.parse(specification) : null,
      description: description || null,
    }
    try {
      if (isEdit) {
        await assetApi.update(Number(id), data)
      } else {
        await assetApi.create(data)
      }
      navigate('/admin/assets')
    } catch { /* handled by axios */ }
    finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 text-center text-gray-500">{t('common.loading')}</div>

  return (
    <div>
      <button onClick={() => navigate('/admin/assets')} className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        &larr; {t('asset.title')}
      </button>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? t('asset.editAsset') : t('asset.createAsset')}</h1>

      <div className="rounded-lg bg-white p-6 shadow max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.assetName')} *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.category')} *</label>
            <select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              <option value="">--</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.department')}</label>
            <select value={departmentId ?? ''} onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
              <option value="">--</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          {isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.status')}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="in_use">{t('asset.statusLabels.in_use')}</option>
                <option value="idle">{t('asset.statusLabels.idle')}</option>
                <option value="scrapped">{t('asset.statusLabels.scrapped')}</option>
                <option value="repairing">{t('asset.statusLabels.repairing')}</option>
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.purchaseDate')}</label>
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.purchasePrice')}</label>
            <input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.supplier')}</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.specification')}</label>
          <textarea value={specification} onChange={(e) => setSpecification(e.target.value)} rows={3} placeholder='{"color": "black", "size": "XL"}'
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.description')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button onClick={() => navigate('/admin/assets')}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
