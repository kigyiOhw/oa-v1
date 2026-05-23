import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { assetApi, type AssetDetail as AssetDetailType, assetStatusLabel, assetStatusColor } from '../../api/assets'
import { userApi, type UserItem } from '../../api/users'

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
      <button onClick={() => navigate('/admin/assets')} className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        &larr; {t('asset.title')}
      </button>
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
          <button onClick={() => navigate(`/admin/assets/${asset.id}/edit`)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {t('common.edit')}
          </button>
          {!asset.current_user_id && (
            <button onClick={openAssign}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
              {t('asset.assign')}
            </button>
          )}
          {asset.current_user_id && (
            <button onClick={handleReturn} disabled={saving}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
              {t('asset.return')}
            </button>
          )}
        </div>

        {/* Assignment history */}
        <section className="border-t pt-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('asset.assignmentHistory')}</h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-400">{t('common.noData')}</p>
          ) : (
            <table className="w-full text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">{t('common.actions')}</th>
                  <th className="px-3 py-2 text-left">{t('asset.currentUser')}</th>
                  <th className="px-3 py-2 text-left">{t('leave.dates')}</th>
                  <th className="px-3 py-2 text-left">{t('asset.description')}</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((r) => {
                  const u = r.user as Record<string, unknown> | null
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${r.action === 'assign' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {r.action === 'assign' ? t('asset.assign') : t('asset.return')}
                        </span>
                      </td>
                      <td className="px-3 py-2">{u ? String(u.full_name || u.username || '') : '-'}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{r.action_date}</td>
                      <td className="px-3 py-2 text-gray-500">{r.notes || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
              <select
                value={userId ?? ''}
                onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- {t('asset.selectUser')} --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.username} ({u.username})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAssign} disabled={saving || !userId}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <button onClick={() => setAssignOpen(false)}
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
