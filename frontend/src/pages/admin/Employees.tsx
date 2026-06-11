import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { employeeApi, employmentStatusColor, employmentStatusLabel, type EmployeeProfile } from '../../api/employees'
import { deptApi, type DepartmentItem } from '../../api/departments'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { useToastStore } from '@/stores/toast'

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
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; onConfirm: () => void} | null>(null)

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

  const handleDelete = (id: number) => {
    setConfirmState({
      open: true,
      title: t('common.confirm'),
      message: t('employee.deleteConfirm'),
      onConfirm: async () => {
        try {
          await employeeApi.delete(id)
          fetchEmployees()
        } catch (e: any) {
          useToastStore.getState().addToast('error', e.response?.data?.detail || t('common.saveFailed'))
        }
      },
    })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t('employee.employeeList')}</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          type="text"
          placeholder={t('users.searchPlaceholder')}
          className="w-56"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <Select
          value={departmentId ?? ''}
          onChange={(e) => { setDepartmentId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}
        >
          <option value="">{t('employee.department')}: {t('common.all')}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">{t('employee.employmentStatus')}: {t('common.all')}</option>
          <option value="active">{t('employee.statusLabels.active')}</option>
          <option value="resigned">{t('employee.statusLabels.resigned')}</option>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('users.username')}</TableHead>
            <TableHead>{t('users.fullName')}</TableHead>
            <TableHead>{t('employee.department')}</TableHead>
            <TableHead>{t('employee.employmentStatus')}</TableHead>
            <TableHead>{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.username}</TableCell>
              <TableCell>{e.full_name || '—'}</TableCell>
              <TableCell>{e.department_name || '—'}</TableCell>
              <TableCell>
                <span className={employmentStatusColor(e.employment_status)}>
                  {employmentStatusLabel(e.employment_status)}
                </span>
              </TableCell>
              <TableCell className="space-x-2">
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/admin/employees/${e.id}`)}>
                  {t('common.view')}
                </Button>
                <Button variant="link" size="sm" className="h-auto p-0 text-red-500" onClick={() => handleDelete(e.id)}>
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
