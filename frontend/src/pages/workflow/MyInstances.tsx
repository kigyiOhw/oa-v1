import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { workflowApi, InstanceItem } from '../../api/workflow'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

export default function MyInstances() {
  const { t } = useTranslation()
  const [instances, setInstances] = useState<InstanceItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const fetchInstances = async () => {
    const res = await workflowApi.listInstances({ page, page_size: pageSize })
    setInstances(res.data.items)
    setTotal(res.data.total)
  }

  useEffect(() => {
    fetchInstances()
  }, [page])

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: t('workflow.statusLabels.pending'),
      approved: t('workflow.statusLabels.approved'),
      rejected: t('workflow.statusLabels.rejected'),
      cancelled: t('workflow.statusLabels.cancelled'),
    }
    return map[s] || s
  }

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: 'text-blue-600',
      approved: 'text-green-600',
      rejected: 'text-red-600',
      cancelled: 'text-gray-400',
    }
    return map[s] || ''
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
      <h1 className="text-2xl font-bold mb-6">{t('workflow.myInstances')}</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('workflow.title')}</TableHead>
            <TableHead>{t('workflow.workflow')}</TableHead>
            <TableHead>{t('workflow.status')}</TableHead>
            <TableHead>{t('workflow.created')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instances.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                <Link to={`/workflow/instances/${i.id}`} className="text-blue-600 hover:underline font-medium">
                  {i.title}
                </Link>
              </TableCell>
              <TableCell className="text-gray-600">{i.workflow_def?.name || '-'}</TableCell>
              <TableCell className={`font-medium ${statusColor(i.status)}`}>
                {statusLabel(i.status)}
              </TableCell>
              <TableCell className="text-gray-500">{new Date(i.created_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {instances.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                {t('workflow.noInstances')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('common.prev')}
          </Button>
          <span className="px-3 py-1 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  )
}
