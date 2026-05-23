import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { assetApi, type AssetCategory } from '../../api/assets'

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
        <button onClick={() => openCreate()} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          + {t('common.create')}
        </button>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">{t('asset.assetName')}</th>
            <th className="px-3 py-2 text-left">{t('asset.description')}</th>
            <th className="px-3 py-2 text-left">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {allCategories.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="px-3 py-2" style={{ paddingLeft: `${12 + c.depth * 24}px` }}>
                {c.depth > 0 ? '└ ' : ''}{c.name}
              </td>
              <td className="px-3 py-2 text-gray-500">{c.description || '-'}</td>
              <td className="px-3 py-2">
                <button onClick={() => openCreate(c.id)} className="text-blue-600 hover:underline text-xs mr-2">{t('common.create')}</button>
                <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline text-xs mr-2">{t('common.edit')}</button>
                <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:underline text-xs">{t('common.delete')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-lg font-semibold mb-4">{editId ? t('common.edit') : t('common.create')}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1">{t('asset.category')}</label>
                <select value={parentId ?? ''} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">— {t('asset.categories')} —</option>
                  {allCategories.filter(c => c.id !== editId).map(c => (
                    <option key={c.id} value={c.id}>{'—'.repeat(c.depth)}{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">{t('asset.assetName')}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs mb-1">{t('asset.description')}</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? t('common.saving') : t('common.save')}
                </button>
                <button onClick={() => setShowForm(false)} className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
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
