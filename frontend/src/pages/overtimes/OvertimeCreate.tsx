import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { overtimeApi } from '../../api/overtime'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

function toLocalDatetimeString(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export default function OvertimeCreate() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    overtimeApi.getById(Number(id)).then((res) => {
      const o = res.data
      setStartTime(toLocalDatetimeString(o.start_time))
      setEndTime(toLocalDatetimeString(o.end_time))
      setDurationHours(String(o.duration_hours))
      setReason(o.reason)
    }).catch(() => navigate('/overtimes'))
  }, [id])

  useEffect(() => {
    if (startTime && endTime) {
      const start = new Date(startTime)
      const end = new Date(endTime)
      if (end > start) {
        const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        setDurationHours(diff.toFixed(1))
      }
    }
  }, [startTime, endTime])

  const handleSaveDraft = async () => {
    if (!startTime || !endTime || !reason) {
      alert(t('common.requiredFields'))
      return
    }
    setSaving(true)
    try {
      const data = {
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        duration_hours: parseFloat(durationHours),
        reason,
      }
      if (isEdit) {
        await overtimeApi.update(Number(id), data)
      } else {
        await overtimeApi.create(data)
      }
      navigate('/overtimes')
    } catch { /* handled by axios interceptor */ }
    finally { setSaving(false) }
  }

  const handleSubmit = async () => {
    if (!startTime || !endTime || !reason) {
      alert(t('common.requiredFields'))
      return
    }
    setSaving(true)
    try {
      const data = {
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        duration_hours: parseFloat(durationHours),
        reason,
      }
      let overtimeId = Number(id)
      if (isEdit) {
        await overtimeApi.update(Number(id), data)
      } else {
        const res = await overtimeApi.create(data)
        overtimeId = res.data.id
      }
      await overtimeApi.submit(overtimeId)
      navigate('/overtimes')
    } catch { /* handled by axios interceptor */ }
    finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? t('overtime.editOvertime') : t('overtime.newOvertime')}</h1>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('overtime.startTime')}</label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('overtime.endTime')}</label>
            <Input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('overtime.duration')}</label>
          <Input
            type="text"
            value={`${durationHours} hours`}
            readOnly
            className="bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('overtime.reason')}</label>
          <Textarea
            rows={4}
            placeholder={t('overtime.reasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" disabled={saving} onClick={handleSaveDraft}>
            {saving ? t('common.saving') : t('overtime.saveDraft')}
          </Button>
          <Button disabled={saving} onClick={handleSubmit}>
            {saving ? t('common.processing') : t('overtime.submitApproval')}
          </Button>
          <Button variant="link" className="h-auto p-0" onClick={() => navigate('/overtimes')}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  )
}
