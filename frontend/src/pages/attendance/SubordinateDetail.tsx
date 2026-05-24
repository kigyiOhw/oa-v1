import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { attendanceApi, AttendanceRecord, TeamMemberDetail, statusLabel, statusColor } from '../../api/attendance'

export default function SubordinateDetail() {
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

  const leaveStatusColor = (status: string) => {
    const map: Record<string, string> = {
      draft: 'text-gray-500', submitted: 'text-blue-600', pending: 'text-blue-600',
      approved: 'text-green-600', rejected: 'text-red-600', cancelled: 'text-gray-400',
    }
    return map[status] || ''
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading && !detail) {
    return <div className="mx-auto max-w-4xl px-4 py-8 text-center text-gray-400">Loading...</div>
  }

  if (!detail) {
    return <div className="mx-auto max-w-4xl px-4 py-8 text-center text-gray-400">User not found</div>
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/attendance/team" className="text-blue-600 hover:underline text-sm mb-4 inline-block">← Back to Team</Link>
      <h1 className="text-2xl font-bold mb-6">{detail.full_name || detail.username} - Attendance Detail</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Profile</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><span className="text-gray-500">Username:</span> {detail.username}</div>
          <div><span className="text-gray-500">Email:</span> {detail.email}</div>
          <div><span className="text-gray-500">Department:</span> {detail.department_name || '-'}</div>
          <div><span className="text-gray-500">Phone:</span> {detail.phone || '-'}</div>
          <div><span className="text-gray-500">Join Date:</span> {detail.join_date || '-'}</div>
          <div><span className="text-gray-500">Status:</span> {detail.employment_status || '-'}</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Normal', value: detail.summary.normal_days, color: 'bg-green-100 text-green-800' },
          { label: 'Late', value: detail.summary.late_days, color: 'bg-yellow-100 text-yellow-800' },
          { label: 'Early', value: detail.summary.early_days, color: 'bg-orange-100 text-orange-800' },
          { label: 'Absent', value: detail.summary.absent_days, color: 'bg-red-100 text-red-800' },
          { label: 'Leave', value: detail.summary.leave_days, color: 'bg-blue-100 text-blue-800' },
          { label: 'Trip', value: detail.summary.business_trip_days, color: 'bg-purple-100 text-purple-800' },
        ].map((c) => (
          <div key={c.label} className={`rounded-lg px-3 py-3 text-center ${c.color}`}>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Leaves */}
      {detail.recent_leaves.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h2 className="font-semibold text-gray-700 mb-3">Recent Leave Requests</h2>
          <table className="w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Dates</th>
                <th className="px-3 py-2 text-left">Days</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {detail.recent_leaves.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2">{l.leave_type}</td>
                  <td className="px-3 py-2 text-gray-600">{l.start_date} ~ {l.end_date}</td>
                  <td className="px-3 py-2">{l.duration_days}</td>
                  <td className={`px-3 py-2 font-medium ${leaveStatusColor(l.status)}`}>{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Month Selector */}
      <div className="flex items-center gap-3 mb-4">
        <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setPage(1) }}
          className="border rounded px-3 py-1 text-sm">
          {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPage(1) }}
          className="border rounded px-3 py-1 text-sm">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
          ))}
        </select>
      </div>

      {/* Records Table */}
      <table className="w-full text-sm border mb-6">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Check In</th>
            <th className="px-3 py-2 text-left">Check Out</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Source</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">{r.record_date}</td>
              <td className="px-3 py-2 text-gray-600">
                {r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : '-'}
              </td>
              <td className="px-3 py-2 text-gray-600">
                {r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString() : '-'}
              </td>
              <td className={`px-3 py-2 font-medium ${statusColor(r.status)}`}>{statusLabel(r.status)}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{r.source}</td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No records</td></tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button className="px-3 py-1 border rounded text-sm disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {totalPages}</span>
          <button className="px-3 py-1 border rounded text-sm disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
