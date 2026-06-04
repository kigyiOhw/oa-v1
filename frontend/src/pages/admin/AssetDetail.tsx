import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { assetApi, type AssetDetail as AssetDetailType, assetStatusLabel, assetStatusColor } from '../../api/assets'
import { userApi, type UserItem } from '../../api/users'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

export default function AssetDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [asset, setAsset] = useState<AssetDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [assignOpen, setAssignOpen] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [users, setUsers] = useState<UserItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchAsset = useCallback(async () => {
    if (!id) return
    try {
      const res = await assetApi.getById(Number(id))
      setAsset(res.data)
    } catch { setError('Failed to load') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchAsset() }, [fetchAsset])

  const openAssign = async () => {
    try {
      const r = await userApi.list({ page_size: 200 })
      setUsers(r.data.items)
    } catch { /* ok */ }
    setAssignOpen(true)
  }

  const handleAssign = async () => {
    if (!asset || !userId) return
    setSaving(true)
    try {
      const res = await assetApi.assign(asset.id, userId)
      setAsset(res.data)
      setAssignOpen(false)
    } catch (err: any) {
      setError(err.response?.data?.detail || t('common.saveFailed'))
    } finally { setSaving(false) }
  }

  const handleReturn = async () => {
    if (!asset) return
    setSaving(true)
    try {
      const res = await assetApi.return(asset.id)
      setAsset(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || t('common.saveFailed'))
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-6 text-center text-gray-500">{t('common.loading')}</div>
  if (!asset) return <div className="p-6 text-center text-red-500">{error}</div>

  const user = asset.current_user as Record<string, unknown> | null
  const assignments = asset.assignments || []

  return (
    <div>
      <Button variant="link" size="sm" className="h-auto p-0 mb-4" onClick={() => navigate('/admin/assets')}>
        <ArrowLeft size={14} className="inline" /> {t('asset.title')}
      </Button>
      <h1 className="text-2xl font-bold mb-6">{asset.name} — {t('asset.editAsset')}</h1>

      {error && <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}

      <div className="rounded-lg bg-white p-6 shadow space-y-6 max-w-2xl">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('asset.editAsset')}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">{t('asset.assetCode')}</span>
              <p className="font-medium font-mono">{asset.asset_code}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('asset.assetName')}</span>
              <p className="font-medium">{asset.name}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('asset.category')}</span>
              <p className="font-medium">{asset.category?.name || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('asset.status')}</span>
              <p className={`font-medium ${assetStatusColor(asset.status)}`}>{assetStatusLabel(asset.status)}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('asset.department')}</span>
              <p className="font-medium">{asset.department && (asset.department as any).name ? (asset.department as any).name : '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('asset.currentUser')}</span>
              <p className="font-medium">{user ? (String(user.full_name || user.username || '')) : '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('asset.purchaseDate')}</span>
              <p className="font-medium">{asset.purchase_date || '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('asset.purchasePrice')}</span>
              <p className="font-medium">{asset.purchase_price != null ? `¥${asset.purchase_price}` : '-'}</p>
            </div>
            <div>
              <span className="text-gray-500">{t('asset.supplier')}</span>
              <p className="font-medium">{asset.supplier || '-'}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">{t('asset.specification')}</span>
              <p className="font-medium font-mono text-xs">{asset.specification ? JSON.stringify(asset.specification, null, 2) : '-'}</p>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">{t('asset.description')}</span>
              <p className="font-medium">{asset.description || '-'}</p>
            </div>
          </div>
        </section>

        <div className="flex gap-2 pt-2 border-t">
          <Button onClick={() => navigate(`/admin/assets/${asset.id}/edit`)}>
            {t('common.edit')}
          </Button>
          {!asset.current_user_id && (
            <Button variant="success" onClick={openAssign}>
              {t('asset.assign')}
            </Button>
          )}
          {asset.current_user_id && (
            <Button variant="warning" onClick={handleReturn} disabled={saving}>
              {t('asset.return')}
            </Button>
          )}
        </div>

        {/* Assignment history */}
        <section className="border-t pt-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('asset.assignmentHistory')}</h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-400">{t('common.noData')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.actions')}</TableHead>
                  <TableHead>{t('asset.currentUser')}</TableHead>
                  <TableHead>{t('leave.dates')}</TableHead>
                  <TableHead>{t('asset.description')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((r) => {
                  const u = r.user as Record<string, unknown> | null
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${r.action === 'assign' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {r.action === 'assign' ? t('asset.assign') : t('asset.return')}
                        </span>
                      </TableCell>
                      <TableCell>{u ? String(u.full_name || u.username || '') : '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.action_date}</TableCell>
                      <TableCell className="text-muted-foreground">{r.notes || '-'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      {/* Assign dialog */}
      {assignOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-lg font-bold mb-4">{t('asset.assignUser')}</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('asset.selectUser')}</label>
              <Select
                value={userId ?? ''}
                onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">-- {t('asset.selectUser')} --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.username} ({u.username})</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleAssign} disabled={saving || !userId} className="flex-1">
                {saving ? t('common.saving') : t('common.save')}
              </Button>
              <Button variant="outline" onClick={() => setAssignOpen(false)} className="flex-1">
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
