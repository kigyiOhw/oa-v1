import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { attendanceApi, AttendanceRecord, TeamMemberDetail, statusLabel } from '../../api/attendance'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const statusBadgeVariant = (status: string): 'success' | 'warning' | 'destructive' | 'secondary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    normal: 'success',
    late: 'warning',
    early: 'warning',
    absent: 'destructive',
    leave: 'secondary',
    business_trip: 'secondary',
  }
  return map[status] || 'default'
}

const leaveBadgeVariant = (status: string): 'success' | 'warning' | 'destructive' | 'secondary' | 'default' => {
  const map: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    approved: 'success',
    rejected: 'destructive',
    pending: 'warning',
    submitted: 'secondary',
    draft: 'secondary',
    cancelled: 'secondary',
  }
  return map[status] || 'default'
}

export default function SubordinateDetail() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const [searchParams] = useSearchParams()
  const today = new Date()
  const [year, setYear] = useState(Number(searchParams.get('year')) || today.getFullYear())
  const [month, setMonth] = useState(Number(searchParams.get('month')) || today.getMonth() + 1)
  const [detail, setDetail] = useState<TeamMemberDetail | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const pageSize = 20

  const fetchData = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [detailRes, recRes] = await Promise.all([
        attendanceApi.getTeamMemberDetail(Number(userId), { year, month }),
        attendanceApi.getTeamMemberRecords(Number(userId), { year, month, page, page_size: pageSize }),
      ])
      setDetail(detailRes.data)
      setRecords(recRes.data.items)
      setTotal(recRes.data.total)
    } catch { /* handled by interceptor */ }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [userId, year, month, page])

  const totalPages = Math.ceil(total / pageSize)

  if (loading && !detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (!detail) {
    return <div className="mx-auto max-w-4xl px-4 py-8 text-center text-gray-400">{t('attendance.userNotFound')}</div>
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/attendance/team" className="text-blue-600 hover:underline text-sm mb-4 inline-block"><ArrowLeft size={14} className="inline" /> {t('attendance.backToTeam')?.replace('← ', '')}</Link>
      <h1 className="text-2xl font-bold mb-6">{detail.full_name || detail.username} - {t('attendance.myAttendance')}</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">{t('attendance.profile')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><span className="text-gray-500">{t('users.username')}:</span> {detail.username}</div>
          <div><span className="text-gray-500">{t('users.email')}:</span> {detail.email}</div>
          <div><span className="text-gray-500">{t('employee.department')}:</span> {detail.department_name || '-'}</div>
          <div><span className="text-gray-500">{t('employee.phone')}:</span> {detail.phone || '-'}</div>
          <div><span className="text-gray-500">{t('employee.joinDate')}:</span> {detail.join_date || '-'}</div>
          <div><span className="text-gray-500">{t('employee.employmentStatus')}:</span> {detail.employment_status || '-'}</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {[
          { key: 'normal', label: t('attendance.normalDays'), value: detail.summary.normal_days, color: 'bg-green-100 text-green-800' },
          { key: 'late', label: t('attendance.lateDays'), value: detail.summary.late_days, color: 'bg-yellow-100 text-yellow-800' },
          { key: 'early', label: t('attendance.earlyDays'), value: detail.summary.early_days, color: 'bg-orange-100 text-orange-800' },
          { key: 'absent', label: t('attendance.absentDays'), value: detail.summary.absent_days, color: 'bg-red-100 text-red-800' },
          { key: 'leave', label: t('attendance.leaveDays'), value: detail.summary.leave_days, color: 'bg-blue-100 text-blue-800' },
          { key: 'trip', label: t('attendance.businessTripDays'), value: detail.summary.business_trip_days, color: 'bg-purple-100 text-purple-800' },
        ].map((c) => (
          <div key={c.key} className={`rounded-lg px-3 py-3 text-center ${c.color}`}>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Leaves */}
      {detail.recent_leaves.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h2 className="font-semibold text-gray-700 mb-3">{t('attendance.recentLeaves')}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('leave.type')}</TableHead>
                <TableHead>{t('leave.dates')}</TableHead>
                <TableHead>{t('leave.days')}</TableHead>
                <TableHead>{t('leave.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.recent_leaves.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.leave_type}</TableCell>
                  <TableCell className="text-gray-600">{l.start_date} ~ {l.end_date}</TableCell>
                  <TableCell>{l.duration_days}</TableCell>
                  <TableCell>
                    <Badge variant={leaveBadgeVariant(l.status)}>{l.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Month Selector */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={year} onChange={(e) => { setYear(Number(e.target.value)); setPage(1) }}>
          {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        <Select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPage(1) }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
          ))}
        </Select>
      </div>

      {/* Records Table */}
      <Table className="mb-6">
        <TableHeader>
          <TableRow>
            <TableHead>{t('attendance.date')}</TableHead>
            <TableHead>{t('attendance.checkIn')}</TableHead>
            <TableHead>{t('attendance.checkOut')}</TableHead>
            <TableHead>{t('leave.status')}</TableHead>
            <TableHead>{t('attendance.source')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.record_date}</TableCell>
              <TableCell className="text-gray-600">
                {r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : '-'}
              </TableCell>
              <TableCell className="text-gray-600">
                {r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString() : '-'}
              </TableCell>
              <TableCell>
                <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
              </TableCell>
              <TableCell className="text-gray-500 text-xs">{r.source}</TableCell>
            </TableRow>
          ))}
          {records.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-400 py-8">{t('common.noData')}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('common.prev')}</Button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t('common.next')}</Button>
        </div>
      )}
    </div>
  )
}
