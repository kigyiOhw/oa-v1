import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { assetApi, type AssetItem, assetStatusLabel, assetStatusColor } from '../../api/assets'
import { deptApi, type DepartmentItem } from '../../api/departments'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useToastStore } from '@/stores/toast'

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
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)

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

  const handleDelete = (id: number) => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message: t('asset.deleteConfirm'),
      onConfirm: async () => {
        try {
          await assetApi.delete(id)
          fetchAssets()
        } catch (e: any) {
          useToastStore.getState().addToast('error', e.response?.data?.detail || t('common.saveFailed'))
        }
      },
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t('asset.title')}</h1>
        <Link to="/admin/assets/new">
          <Button size="sm">+ {t('asset.createAsset')}</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          type="text"
          placeholder={t('common.search') + '...'}
          className="w-56"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <Select
          value={categoryId ?? ''}
          onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}
        >
          <option value="">{t('asset.category')}: {t('common.all')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">{t('asset.status')}: {t('common.all')}</option>
          <option value="in_use">{t('asset.statusLabels.in_use')}</option>
          <option value="idle">{t('asset.statusLabels.idle')}</option>
          <option value="scrapped">{t('asset.statusLabels.scrapped')}</option>
          <option value="repairing">{t('asset.statusLabels.repairing')}</option>
        </Select>
        <Select
          value={departmentId ?? ''}
          onChange={(e) => { setDepartmentId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}
        >
          <option value="">{t('asset.department')}: {t('common.all')}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('asset.assetCode')}</TableHead>
            <TableHead>{t('asset.assetName')}</TableHead>
            <TableHead>{t('asset.category')}</TableHead>
            <TableHead>{t('asset.status')}</TableHead>
            <TableHead>{t('asset.department')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-mono text-xs">{a.asset_code}</TableCell>
              <TableCell>{a.name}</TableCell>
              <TableCell className="text-muted-foreground">{a.category?.name || '-'}</TableCell>
              <TableCell className={`font-medium ${assetStatusColor(a.status)}`}>
                {assetStatusLabel(a.status)}
              </TableCell>
              <TableCell className="text-muted-foreground">{a.department && (a.department as any).name ? (a.department as any).name : '-'}</TableCell>
              <TableCell className="space-x-2">
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/admin/assets/${a.id}`)}>
                  {t('common.view')}
                </Button>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/admin/assets/${a.id}/edit`)}>
                  {t('common.edit')}
                </Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleDelete(a.id)}>
                  {t('common.delete')}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span>{t('common.total')}: {total}</span>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          {t('common.prev')}
        </Button>
        <span>{t('common.page')} {page}</span>
        <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>
          {t('common.next')}
        </Button>
      </div>
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
