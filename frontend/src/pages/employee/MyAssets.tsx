import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { assetApi, type AssetItem, assetStatusLabel } from '../../api/assets'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const assetBadgeVariant = (status: string): 'success' | 'warning' | 'destructive' | 'secondary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    in_use: 'success',
    idle: 'secondary',
    scrapped: 'destructive',
    repairing: 'warning',
  }
  return map[status] || 'default'
}

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('asset.assetCode')}</TableHead>
              <TableHead>{t('asset.assetName')}</TableHead>
              <TableHead>{t('asset.category')}</TableHead>
              <TableHead>{t('asset.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.asset_code}</TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell className="text-gray-600">{a.category?.name || '-'}</TableCell>
                <TableCell>
                  <Badge variant={assetBadgeVariant(a.status)}>{assetStatusLabel(a.status)}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
