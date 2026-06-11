import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { leaveApi } from '../../api/leave'
import { requestTypeApi } from '../../api/requestTypes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import FormField from '@/components/ui/form-field'

export default function LeaveCreate() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const [leaveTypeOptions, setLeaveTypeOptions] = useState<{ value: string; label: string }[]>([])
  const [leaveType, setLeaveType] = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [durationDays, setDurationDays] = useState(1)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    requestTypeApi.list('leave').then((res) => {
      const opts = res.data.map((item) => ({ value: item.code, label: item.name }))
      setLeaveTypeOptions(opts)
      if (opts.length > 0 && !isEdit) {
        setLeaveType(opts[0].value)
      }
    }).catch(() => {
      // fallback to hardcoded
      setLeaveTypeOptions([
        { value: 'annual', label: t('leave.typeLabels.annual') },
        { value: 'sick', label: t('leave.typeLabels.sick') },
        { value: 'personal', label: t('leave.typeLabels.personal') },
        { value: 'other', label: t('leave.typeLabels.other') },
      ])
    })
  }, [t, isEdit])

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

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!startDate) errs.startDate = t('validation.required')
    if (!endDate) errs.endDate = t('validation.required')
    if (startDate && endDate && new Date(endDate) < new Date(startDate))
      errs.endDate = t('validation.endDateBeforeStart')
    if (!reason.trim()) errs.reason = t('validation.required')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const getPayload = () => ({
    leave_type: leaveType,
    start_date: startDate,
    end_date: endDate,
    duration_days: durationDays,
    reason: reason.trim(),
  })

  const handleSaveDraft = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      if (isEdit) {
        await leaveApi.update(Number(id), getPayload())
      } else {
        await leaveApi.create(getPayload())
      }
      navigate('/leaves')
    } catch { /* handled by axios interceptor */ }
    finally { setSaving(false) }
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      let leaveId = Number(id)
      if (isEdit) {
        await leaveApi.update(Number(id), getPayload())
      } else {
        const res = await leaveApi.create(getPayload())
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
        <FormField label={t('leave.leaveType')}>
          <Select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
          >
            {leaveTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('leave.startDate')} error={errors.startDate} required>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setErrors((p) => { const n = {...p}; delete n.startDate; delete n.endDate; return n }) }}
            />
          </FormField>
          <FormField label={t('leave.endDate')} error={errors.endDate} required>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setErrors((p) => { const n = {...p}; delete n.endDate; return n }) }}
            />
          </FormField>
        </div>

        <FormField label={t('leave.duration')}>
          <Input
            type="number"
            value={durationDays}
            min={1}
            onChange={(e) => setDurationDays(Number(e.target.value))}
          />
        </FormField>

        <FormField label={t('leave.reason')} error={errors.reason} required>
          <Textarea
            rows={4}
            placeholder={t('leave.reasonPlaceholder')}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setErrors((p) => { const n = {...p}; delete n.reason; return n }) }}
          />
        </FormField>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" disabled={saving} onClick={handleSaveDraft}>
            {saving ? t('common.saving') : t('leave.saveDraft')}
          </Button>
          <Button disabled={saving} onClick={handleSubmit}>
            {saving ? t('common.processing') : t('leave.submitApproval')}
          </Button>
          <Button variant="link" className="h-auto p-0" onClick={() => navigate('/leaves')}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
