import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { auditApi, AuditLogItem } from '../../api/audit'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const ACTIONS = ['', 'create', 'update', 'delete']
const RESOURCE_TYPES = [
  '', 'User', 'Role', 'Permission', 'Department',
  'WorkflowDef', 'Announcement', 'Setting',
  'Asset', 'AssetAssignment', 'AssetCategory',
  'Consumable', 'EmployeeProfile',
  'LeaveRequest', 'ExpenseRequest', 'OvertimeRequest',
  'WorkflowInstance', 'WorkflowTask',
]

const actionBadgeVariant = (a: string): 'success' | 'destructive' | 'default' => {
  const map: Record<string, 'success' | 'destructive' | 'default'> = {
    create: 'success',
    update: 'default',
    delete: 'destructive',
  }
  return map[a] || 'default'
}

export default function AuditLogs() {
  const { t } = useTranslation()
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const pageSize = 20

  const fetchData = async () => {
    const params: Record<string, unknown> = { page, page_size: pageSize }
    if (action) params.action = action
    if (resourceType) params.resource_type = resourceType
    if (startDate) params.start_date = new Date(startDate).toISOString()
    if (endDate) params.end_date = new Date(endDate).toISOString()
    const res = await auditApi.list(params)
    setItems(res.data.items)
    setTotal(res.data.total)
  }

  useEffect(() => {
    fetchData()
  }, [page])

  const handleFilter = () => {
    setPage(1)
    fetchData()
  }

  const handleReset = () => {
    setAction('')
    setResourceType('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t('auditLogs.title')}</h1>

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('auditLogs.action')}</label>
          <Select
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a || t('common.all')}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('auditLogs.resourceType')}</label>
          <Select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
          >
            {RESOURCE_TYPES.map((r) => (
              <option key={r} value={r}>{r || t('common.all')}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('auditLogs.startDate')}</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('auditLogs.endDate')}</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button onClick={handleFilter}>
          {t('common.search')}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          {t('common.reset')}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('auditLogs.time')}</TableHead>
              <TableHead>{t('auditLogs.operator')}</TableHead>
              <TableHead>{t('auditLogs.action')}</TableHead>
              <TableHead>{t('auditLogs.resourceType')}</TableHead>
              <TableHead>{t('auditLogs.resourceId')}</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>{t('auditLogs.details')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400 py-6">{t('common.noData')}</TableCell>
              </TableRow>
            )}
            {items.map((item) => (
              <>
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-gray-500 text-xs">
                    {new Date(item.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{item.user_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={actionBadgeVariant(item.action)}>{item.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{item.resource_type}</TableCell>
                  <TableCell className="text-xs">{item.resource_id ?? '-'}</TableCell>
                  <TableCell className="text-xs text-gray-400">{item.ip_address}</TableCell>
                  <TableCell>
                    {item.details ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      >
                        {expandedId === item.id ? t('common.close') : t('common.view')}
                      </Button>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </TableCell>
                </TableRow>
                {expandedId === item.id && item.details && (
                  <TableRow key={`${item.id}-details`}>
                    <TableCell colSpan={7} className="bg-gray-50">
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(item.details, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            {t('common.total')} {total} {t('auditLogs.records')}
          </span>
          <div className="space-x-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t('common.prev')}
            </Button>
            <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
