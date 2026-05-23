import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { assetApi, type AssetItem, assetStatusLabel, assetStatusColor } from '../../api/assets'
import { deptApi, type DepartmentItem } from '../../api/departments'

export default function Assets() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [statusFilter, setStatusFilter] = useState('')
  const [departmentId, setDepartmentId] = useState<number | undefined>()
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [departments, setDepartments] = useState<DepartmentItem[]>([])

  const fetchAssets = useCallback(async () => {
    const res = await assetApi.list({
      page,
      page_size: 20,
      search: search || undefined,
      category_id: categoryId,
      status: statusFilter || undefined,
      department_id: departmentId,
    })
    setAssets(res.data.items)
    setTotal(res.data.total)
  }, [page, search, categoryId, statusFilter, departmentId])

  useEffect(() => { fetchAssets() }, [fetchAssets])

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

  const handleDelete = async (id: number) => {
    if (!confirm(t('asset.deleteConfirm'))) return
    await assetApi.delete(id)
    fetchAssets()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('asset.title')}</h1>
        <Link to="/admin/assets/new" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
          + {t('asset.createAsset')}
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder={t('common.search') + '...'}
          className="border rounded px-3 py-1.5 text-sm w-56"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={categoryId ?? ''}
          onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}
        >
          <option value="">{t('asset.category')}: {t('common.all')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">{t('asset.status')}: {t('common.all')}</option>
          <option value="in_use">{t('asset.statusLabels.in_use')}</option>
          <option value="idle">{t('asset.statusLabels.idle')}</option>
          <option value="scrapped">{t('asset.statusLabels.scrapped')}</option>
          <option value="repairing">{t('asset.statusLabels.repairing')}</option>
        </select>
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={departmentId ?? ''}
          onChange={(e) => { setDepartmentId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}
        >
          <option value="">{t('asset.department')}: {t('common.all')}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">{t('asset.assetCode')}</th>
            <th className="px-3 py-2 text-left">{t('asset.assetName')}</th>
            <th className="px-3 py-2 text-left">{t('asset.category')}</th>
            <th className="px-3 py-2 text-left">{t('asset.status')}</th>
            <th className="px-3 py-2 text-left">{t('asset.department')}</th>
            <th className="px-3 py-2 text-left">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs">{a.asset_code}</td>
              <td className="px-3 py-2">{a.name}</td>
              <td className="px-3 py-2 text-gray-600">{a.category?.name || '-'}</td>
              <td className={`px-3 py-2 font-medium ${assetStatusColor(a.status)}`}>
                {assetStatusLabel(a.status)}
              </td>
              <td className="px-3 py-2 text-gray-600">{a.department && (a.department as any).name ? (a.department as any).name : '-'}</td>
              <td className="px-3 py-2 space-x-2">
                <button onClick={() => navigate(`/admin/assets/${a.id}`)} className="text-blue-600 hover:underline text-xs">
                  {t('common.view')}
                </button>
                <button onClick={() => navigate(`/admin/assets/${a.id}/edit`)} className="text-blue-600 hover:underline text-xs">
                  {t('common.edit')}
                </button>
                <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:underline text-xs">
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
