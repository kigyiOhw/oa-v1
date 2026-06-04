import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { attendanceApi, AttendanceConfig } from '../../api/attendance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function AttendanceConfigPage() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<AttendanceConfig>({
    work_start_time: '09:00',
    work_end_time: '18:00',
    late_tolerance_minutes: 0,
    enable_mandatory_check_in: false,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await attendanceApi.getConfig()
      if (res.data) setConfig(res.data)
    } catch { /* handled by interceptor */ }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      await attendanceApi.updateConfig(config)
      setMessage(t('common.saveSuccess'))
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || t('common.saveFailed'))
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="mx-auto max-w-2xl px-4 py-8 text-center text-gray-400">{t('common.loading')}</div>
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/admin" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToAdmin')}</Link>
      <h1 className="text-2xl font-bold mb-6">{t('attendance.config')}</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('attendance.workStartTime')}</label>
          <Input
            type="time"
            value={config.work_start_time}
            onChange={(e) => setConfig({ ...config, work_start_time: e.target.value })}
            className="w-48"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('attendance.workEndTime')}</label>
          <Input
            type="time"
            value={config.work_end_time}
            onChange={(e) => setConfig({ ...config, work_end_time: e.target.value })}
            className="w-48"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('attendance.lateTolerance')}: {config.late_tolerance_minutes}
          </label>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={config.late_tolerance_minutes}
            onChange={(e) => setConfig({ ...config, late_tolerance_minutes: Number(e.target.value) })}
            className="w-64"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="mandatory"
            checked={config.enable_mandatory_check_in}
            onChange={(e) => setConfig({ ...config, enable_mandatory_check_in: e.target.checked })}
            className="rounded"
          />
          <label htmlFor="mandatory" className="text-sm text-gray-700">
            {t('attendance.enableMandatory')}
          </label>
        </div>

        <div className="flex items-center gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
          {message && (
            <span className={`text-sm ${message.includes('fail') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
