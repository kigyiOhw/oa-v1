import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { leaveApi } from '../../api/leave'

export default function LeaveCreate() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const LEAVE_TYPE_OPTIONS = [
    { value: 'annual', label: t('leave.typeLabels.annual') },
    { value: 'sick', label: t('leave.typeLabels.sick') },
    { value: 'personal', label: t('leave.typeLabels.personal') },
    { value: 'other', label: t('leave.typeLabels.other') },
  ]

  const [leaveType, setLeaveType] = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [durationDays, setDurationDays] = useState(1)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    leaveApi.getById(Number(id)).then((res) => {
      const l = res.data
      setLeaveType(l.leave_type)
      setStartDate(l.start_date)
      setEndDate(l.end_date)
      setDurationDays(l.duration_days)
      setReason(l.reason)
    }).catch(() => navigate('/leaves'))
  }, [id])

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (end >= start) {
        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        setDurationDays(diff)
      }
    }
  }, [startDate, endDate])

  const handleSaveDraft = async () => {
    if (!startDate || !endDate || !reason) {
      alert(t('common.requiredFields'))
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await leaveApi.update(Number(id), {
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          duration_days: durationDays,
          reason,
        })
      } else {
        await leaveApi.create({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          duration_days: durationDays,
          reason,
        })
      }
      navigate('/leaves')
    } catch { /* handled by axios interceptor */ }
    finally { setSaving(false) }
  }

  const handleSubmit = async () => {
    if (!startDate || !endDate || !reason) {
      alert(t('common.requiredFields'))
      return
    }
    setSaving(true)
    try {
      let leaveId = Number(id)
      if (isEdit) {
        await leaveApi.update(Number(id), {
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          duration_days: durationDays,
          reason,
        })
      } else {
        const res = await leaveApi.create({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          duration_days: durationDays,
          reason,
        })
        leaveId = res.data.id
      }
      await leaveApi.submit(leaveId)
      navigate('/leaves')
    } catch { /* handled by axios interceptor */ }
    finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? t('leave.editLeave') : t('leave.newLeave')}</h1>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t('leave.leaveType')}</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
          >
            {LEAVE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('leave.startDate')}</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('leave.endDate')}</label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('leave.duration')}</label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2 text-sm"
            value={durationDays}
            min={1}
            onChange={(e) => setDurationDays(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('leave.reason')}</label>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm"
            rows={4}
            placeholder={t('leave.reasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
            disabled={saving}
            onClick={handleSaveDraft}
          >
            {saving ? t('common.saving') : t('leave.saveDraft')}
          </button>
          <button
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? t('common.processing') : t('leave.submitApproval')}
          </button>
          <button
            className="px-4 py-2 text-sm text-gray-500 hover:underline"
            onClick={() => navigate('/leaves')}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
