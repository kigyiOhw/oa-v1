import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { attendanceApi, AttendanceRecord, MonthlySummary, statusLabel, statusColor } from '../../api/attendance'

export default function MyAttendance() {
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
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">← Back to Home</Link>
      <h1 className="text-2xl font-bold mb-6">My Attendance</h1>

      {/* Check-in / Check-out */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
            onClick={handleCheckIn}
            disabled={actionLoading}
          >
            Check In
          </button>
          <button
            className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
            onClick={handleCheckOut}
            disabled={actionLoading}
          >
            Check Out
          </button>
          <span className="text-sm text-gray-500">Today: {todayStr}</span>
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
            { label: 'Normal', value: summary.normal_days, color: 'bg-green-100 text-green-800' },
            { label: 'Late', value: summary.late_days, color: 'bg-yellow-100 text-yellow-800' },
            { label: 'Early', value: summary.early_days, color: 'bg-orange-100 text-orange-800' },
            { label: 'Absent', value: summary.absent_days, color: 'bg-red-100 text-red-800' },
            { label: 'Leave', value: summary.leave_days, color: 'bg-blue-100 text-blue-800' },
            { label: 'Trip', value: summary.business_trip_days, color: 'bg-purple-100 text-purple-800' },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg px-3 py-3 text-center ${c.color}`}>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs mt-1">{c.label}</div>
            </div>
          ))}
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
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : (
        <>
          <table className="w-full text-sm border">
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
                  <td className={`px-3 py-2 font-medium ${statusColor(r.status)}`}>
                    {statusLabel(r.status)}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{r.source}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-400">No records</td>
                </tr>
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
        </>
      )}
    </div>
  )
}
