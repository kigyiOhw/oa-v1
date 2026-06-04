import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { attendanceApi, AttendanceRecord, MonthlySummary, statusLabel } from '../../api/attendance'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

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

export default function MyAttendance() {
  const { t } = useTranslation()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')
  const pageSize = 20

  const fetchData = async () => {
    setLoading(true)
    try {
      const [recRes, sumRes] = await Promise.all([
        attendanceApi.getMyRecords({ year, month, page, page_size: pageSize }),
        attendanceApi.getMySummary({ year, month }),
      ])
      setRecords(recRes.data.items)
      setTotal(recRes.data.total)
      setSummary(sumRes.data)
    } catch { /* handled by interceptor */ }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [year, month, page])

  const handleCheckIn = async () => {
    setActionLoading(true)
    setMessage('')
    try {
      const res = await attendanceApi.checkIn()
      const record = res.data.data
      setMessage(`Checked in at ${new Date(record.check_in_time).toLocaleTimeString()} (${record.status})`)
      fetchData()
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || 'Check-in failed')
    }
    setActionLoading(false)
  }

  const handleCheckOut = async () => {
    setActionLoading(true)
    setMessage('')
    try {
      const res = await attendanceApi.checkOut()
      const record = res.data.data
      setMessage(`Checked out at ${new Date(record.check_out_time).toLocaleTimeString()} (${record.status})`)
      fetchData()
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || 'Check-out failed')
    }
    setActionLoading(false)
  }

  const totalPages = Math.ceil(total / pageSize)
  const todayStr = today.toISOString().split('T')[0]

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block"><ArrowLeft size={14} className="inline" /> {t('common.backToHome')?.replace('← ', '')}</Link>
      <h1 className="text-2xl font-bold mb-6">{t('attendance.myAttendance')}</h1>

      {/* Check-in / Check-out */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="success" size="lg" onClick={handleCheckIn} disabled={actionLoading}>
            {t('attendance.checkIn')}
          </Button>
          <Button variant="warning" size="lg" onClick={handleCheckOut} disabled={actionLoading}>
            {t('attendance.checkOut')}
          </Button>
          <span className="text-sm text-gray-500">{t('attendance.today')}: {todayStr}</span>
        </div>
        {message && (
          <div className={`text-sm px-3 py-2 rounded ${message.includes('failed') || message.includes('Must') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {[
            { key: 'normal', label: t('attendance.normalDays'), value: summary.normal_days, color: 'bg-green-100 text-green-800' },
            { key: 'late', label: t('attendance.lateDays'), value: summary.late_days, color: 'bg-yellow-100 text-yellow-800' },
            { key: 'early', label: t('attendance.earlyDays'), value: summary.early_days, color: 'bg-orange-100 text-orange-800' },
            { key: 'absent', label: t('attendance.absentDays'), value: summary.absent_days, color: 'bg-red-100 text-red-800' },
            { key: 'leave', label: t('attendance.leaveDays'), value: summary.leave_days, color: 'bg-blue-100 text-blue-800' },
            { key: 'trip', label: t('attendance.businessTripDays'), value: summary.business_trip_days, color: 'bg-purple-100 text-purple-800' },
          ].map((c) => (
            <div key={c.key} className={`rounded-lg px-3 py-3 text-center ${c.color}`}>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs mt-1">{c.label}</div>
            </div>
          ))}
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
      {loading ? (
        <div className="text-center py-8 text-gray-400">{t('common.loading')}</div>
      ) : (
        <>
          <Table>
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
        </>
      )}
    </div>
  )
}
