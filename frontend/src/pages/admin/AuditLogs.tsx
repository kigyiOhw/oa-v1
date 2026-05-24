import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { auditApi, AuditLogItem } from '../../api/audit'

const ACTIONS = ['', 'create', 'update', 'delete']
const RESOURCE_TYPES = [
  '', 'User', 'Role', 'Permission', 'Department',
  'WorkflowDef', 'Announcement', 'Setting',
  'Asset', 'AssetAssignment', 'AssetCategory',
  'Consumable', 'EmployeeProfile',
  'LeaveRequest', 'ExpenseRequest', 'OvertimeRequest',
  'WorkflowInstance', 'WorkflowTask',
]

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

  const actionBadge = (a: string) => {
    const colors: Record<string, string> = {
      create: 'bg-green-100 text-green-700',
      update: 'bg-blue-100 text-blue-700',
      delete: 'bg-red-100 text-red-700',
    }
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[a] || 'bg-gray-100'}`}>
        {a}
      </span>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t('auditLogs.title')}</h1>

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('auditLogs.action')}</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a || t('common.all')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('auditLogs.resourceType')}</label>
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          >
            {RESOURCE_TYPES.map((r) => (
              <option key={r} value={r}>{r || t('common.all')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('auditLogs.startDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('auditLogs.endDate')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={handleFilter}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          {t('common.search')}
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
        >
          {t('common.reset')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">{t('auditLogs.time')}</th>
              <th className="px-3 py-2 text-left">{t('auditLogs.operator')}</th>
              <th className="px-3 py-2 text-left">{t('auditLogs.action')}</th>
              <th className="px-3 py-2 text-left">{t('auditLogs.resourceType')}</th>
              <th className="px-3 py-2 text-left">{t('auditLogs.resourceId')}</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2 text-left">{t('auditLogs.details')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">{t('common.noData')}</td>
              </tr>
            )}
            {items.map((item) => (
              <>
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-xs">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{item.user_name || '-'}</td>
                  <td className="px-3 py-2">{actionBadge(item.action)}</td>
                  <td className="px-3 py-2 text-xs">{item.resource_type}</td>
                  <td className="px-3 py-2 text-xs">{item.resource_id ?? '-'}</td>
                  <td className="px-3 py-2 text-xs text-gray-400">{item.ip_address}</td>
                  <td className="px-3 py-2">
                    {item.details ? (
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        {expandedId === item.id ? t('common.close') : t('common.view')}
                      </button>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                </tr>
                {expandedId === item.id && item.details && (
                  <tr key={`${item.id}-details`}>
                    <td colSpan={7} className="px-3 py-2 bg-gray-50">
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(item.details, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            {t('common.total')} {total} {t('auditLogs.records')}
          </span>
          <div className="space-x-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 border rounded text-sm disabled:opacity-30"
            >
              {t('common.prev')}
            </button>
            <span className="px-3 py-1 text-sm">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 border rounded text-sm disabled:opacity-30"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
