import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { assetApi, type AssetItem, assetStatusLabel, assetStatusColor } from '../../api/assets'

export default function MyAssets() {
  const { t } = useTranslation()
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAssets = useCallback(async () => {
    try {
      const res = await assetApi.listMy()
      setAssets(res.data)
    } catch { /* handled by axios */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  if (loading) return <div className="p-6 text-center text-gray-500">{t('common.loading')}</div>

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
      <h1 className="text-2xl font-bold mb-6">{t('asset.myAssets')}</h1>

      {assets.length === 0 ? (
        <div className="text-center text-gray-400 py-8">{t('asset.noAssets')}</div>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">{t('asset.assetCode')}</th>
              <th className="px-3 py-2 text-left">{t('asset.assetName')}</th>
              <th className="px-3 py-2 text-left">{t('asset.category')}</th>
              <th className="px-3 py-2 text-left">{t('asset.status')}</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{a.asset_code}</td>
                <td className="px-3 py-2">{a.name}</td>
                <td className="px-3 py-2 text-gray-600">{a.category?.name || '-'}</td>
                <td className={`px-3 py-2 font-medium ${assetStatusColor(a.status)}`}>
                  {assetStatusLabel(a.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
