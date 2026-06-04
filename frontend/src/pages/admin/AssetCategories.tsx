import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { assetApi, type AssetCategory } from '../../api/assets'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export default function AssetCategories() {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchCategories = useCallback(async () => {
    try {
      const res = await assetApi.listCategories()
      setCategories(res.data)
    } catch { /* handled by axios */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  const openCreate = (pId: number | null = null) => {
    setEditId(null); setName(''); setParentId(pId); setDescription(''); setShowForm(true)
  }

  const openEdit = (c: AssetCategory) => {
    setEditId(c.id); setName(c.name); setParentId(c.parent_id); setDescription(c.description || ''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!name) return
    setSaving(true)
    try {
      if (editId) {
        await assetApi.updateCategory(editId, { name, parent_id: parentId || null, description })
      } else {
        await assetApi.createCategory({ name, parent_id: parentId || undefined, description })
      }
      setShowForm(false)
      fetchCategories()
    } catch { /* handled by axios */ }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('common.delete') + '?')) return
    await assetApi.deleteCategory(id)
    fetchCategories()
  }

  const allCategories = flatten(categories)

  if (loading) return <div className="p-6 text-center text-gray-500">{t('common.loading')}</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">{t('asset.categories')}</h1>
        <Button size="sm" onClick={() => openCreate()}>+ {t('common.create')}</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('asset.assetName')}</TableHead>
            <TableHead>{t('asset.description')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allCategories.map((c) => (
            <TableRow key={c.id}>
              <TableCell style={{ paddingLeft: `${12 + c.depth * 24}px` }}>
                {c.depth > 0 ? '└ ' : ''}{c.name}
              </TableCell>
              <TableCell className="text-muted-foreground">{c.description || '-'}</TableCell>
              <TableCell>
                <Button variant="link" size="sm" className="h-auto p-0 mr-2" onClick={() => openCreate(c.id)}>{t('common.create')}</Button>
                <Button variant="link" size="sm" className="h-auto p-0 mr-2" onClick={() => openEdit(c)}>{t('common.edit')}</Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleDelete(c.id)}>{t('common.delete')}</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">{editId ? t('common.edit') : t('common.create')}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1">{t('asset.category')}</label>
                <Select value={parentId ?? ''} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— {t('asset.categories')} —</option>
                  {allCategories.filter(c => c.id !== editId).map(c => (
                    <option key={c.id} value={c.id}>{'—'.repeat(c.depth)}{c.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-xs mb-1">{t('asset.assetName')}</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs mb-1">{t('asset.description')}</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? t('common.saving') : t('common.save')}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function flatten(tree: AssetCategory[], depth = 0): (AssetCategory & { depth: number })[] {
  const result: (AssetCategory & { depth: number })[] = []
  for (const node of tree) {
    result.push({ ...node, depth })
    if (node.children?.length) result.push(...flatten(node.children, depth + 1))
  }
  return result
}
