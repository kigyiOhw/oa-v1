import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { employeeApi, employmentStatusColor, employmentStatusLabel, type EmployeeProfile } from '../../api/employees'
import { deptApi, type DepartmentItem } from '../../api/departments'

export default function Employees() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState<number | undefined>()
  const [statusFilter, setStatusFilter] = useState('')
  const [departments, setDepartments] = useState<DepartmentItem[]>([])

  const fetchEmployees = useCallback(async () => {
    const res = await employeeApi.list({
      page,
      page_size: 20,
      search: search || undefined,
      department_id: departmentId,
      employment_status: statusFilter || undefined,
    })
    setEmployees(res.data.items)
    setTotal(res.data.total)
  }, [page, search, departmentId, statusFilter])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  useEffect(() => {
    deptApi.list().then((r) => setDepartments(r.data))
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm(t('employee.deleteConfirm'))) return
    await employeeApi.delete(id)
    fetchEmployees()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t('employee.employeeList')}</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder={t('users.searchPlaceholder')}
          className="border rounded px-3 py-1.5 text-sm w-56"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={departmentId ?? ''}
          onChange={(e) => { setDepartmentId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}
        >
          <option value="">{t('employee.department')}: {t('common.all')}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          className="border rounded px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">{t('employee.employmentStatus')}: {t('common.all')}</option>
          <option value="active">{t('employee.statusLabels.active')}</option>
          <option value="resigned">{t('employee.statusLabels.resigned')}</option>
        </select>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">{t('users.username')}</th>
            <th className="px-3 py-2 text-left">{t('users.fullName')}</th>
            <th className="px-3 py-2 text-left">{t('employee.department')}</th>
            <th className="px-3 py-2 text-left">{t('employee.employmentStatus')}</th>
            <th className="px-3 py-2 text-left">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">{e.username}</td>
              <td className="px-3 py-2">{e.full_name || '—'}</td>
              <td className="px-3 py-2">{e.department_name || '—'}</td>
              <td className="px-3 py-2">
                <span className={employmentStatusColor(e.employment_status)}>
                  {employmentStatusLabel(e.employment_status)}
                </span>
              </td>
              <td className="px-3 py-2 space-x-2">
                <button
                  className="text-blue-600 hover:underline text-xs"
                  onClick={() => navigate(`/admin/employees/${e.id}`)}
                >
                  {t('common.view')}
                </button>
                <button
                  className="text-red-500 hover:underline text-xs"
                  onClick={() => handleDelete(e.id)}
                >
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
        <span>{t('common.total')}: {total}</span>
        <button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="px-2 py-0.5 border rounded disabled:opacity-30"
        >
          {t('common.prev')}
        </button>
        <span>{t('common.page')} {page}</span>
        <button
          disabled={page * 20 >= total}
          onClick={() => setPage(page + 1)}
          className="px-2 py-0.5 border rounded disabled:opacity-30"
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  )
}
