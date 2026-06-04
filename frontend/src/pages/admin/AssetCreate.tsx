import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { assetApi } from '../../api/assets'
import { deptApi, type DepartmentItem } from '../../api/departments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

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
      <Button variant="link" size="sm" className="h-auto p-0 mb-4" onClick={() => navigate('/admin/assets')}>
        <ArrowLeft size={14} className="inline" /> {t('asset.title')}
      </Button>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? t('asset.editAsset') : t('asset.createAsset')}</h1>

      <div className="rounded-lg bg-white p-6 shadow max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.assetName')} *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.category')} *</label>
            <Select value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">--</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.department')}</label>
            <Select value={departmentId ?? ''} onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">--</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          {isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.status')}</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="in_use">{t('asset.statusLabels.in_use')}</option>
                <option value="idle">{t('asset.statusLabels.idle')}</option>
                <option value="scrapped">{t('asset.statusLabels.scrapped')}</option>
                <option value="repairing">{t('asset.statusLabels.repairing')}</option>
              </Select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.purchaseDate')}</label>
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.purchasePrice')}</label>
            <Input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.supplier')}</label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.specification')}</label>
          <Textarea value={specification} onChange={(e) => setSpecification(e.target.value)} rows={3} placeholder='{"color": "black", "size": "XL"}' />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.description')}</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/assets')}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
