import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { attendanceApi, TeamMemberSummary } from '../../api/attendance'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export default function TeamAttendance() {
  const { t } = useTranslation()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [members, setMembers] = useState<TeamMemberSummary[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await attendanceApi.getTeamSummary({ year, month })
      setMembers(res.data)
    } catch { /* handled by interceptor */ }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [year, month])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block"><ArrowLeft size={14} className="inline" /> {t('common.backToHome')?.replace('← ', '')}</Link>
      <h1 className="text-2xl font-bold mb-6">{t('attendance.teamAttendance')}</h1>

      <div className="flex items-center gap-3 mb-6">
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">{t('common.loading')}</div>
      ) : members.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t('attendance.noSubordinates')}</div>
      ) : (
        <div className="grid gap-4">
          {members.map((m) => (
            <Link
              key={m.user_id}
              to={`/attendance/team/${m.user_id}?year=${year}&month=${month}`}
              className="block bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-gray-900">{m.full_name || m.username}</span>
                  {m.department_name && (
                    <Badge variant="secondary" className="ml-2">{m.department_name}</Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2 text-center text-sm">
                {[
                  { key: 'normal', label: t('attendance.normalDays'), value: m.summary.normal_days, color: 'text-green-600' },
                  { key: 'late', label: t('attendance.lateDays'), value: m.summary.late_days, color: 'text-yellow-600' },
                  { key: 'early', label: t('attendance.earlyDays'), value: m.summary.early_days, color: 'text-orange-600' },
                  { key: 'absent', label: t('attendance.absentDays'), value: m.summary.absent_days, color: 'text-red-600' },
                  { key: 'leave', label: t('attendance.leaveDays'), value: m.summary.leave_days, color: 'text-blue-600' },
                  { key: 'trip', label: t('attendance.businessTripDays'), value: m.summary.business_trip_days, color: 'text-purple-600' },
                ].map((c) => (
                  <div key={c.key}>
                    <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
                    <div className="text-xs text-gray-500">{c.label}</div>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
