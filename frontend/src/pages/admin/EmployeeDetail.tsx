import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { employeeApi, type EmployeeProfile } from '../../api/employees'
import { userApi, type UserItem } from '../../api/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'

const EDUCATION_LEVELS = ['high_school', 'associate', 'bachelor', 'master', 'doctor', 'other']

export default function EmployeeDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Edit form state
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [birthday, setBirthday] = useState('')
  const [workExperience, setWorkExperience] = useState('')
  const [graduationSchool, setGraduationSchool] = useState('')
  const [educationLevel, setEducationLevel] = useState('')
  const [joinDate, setJoinDate] = useState('')
  const [employmentStatus, setEmploymentStatus] = useState('')

  // Resign dialog
  const [resignOpen, setResignOpen] = useState(false)
  const [successorId, setSuccessorId] = useState<number | null>(null)
  const [resignationDate, setResignationDate] = useState('')
  const [users, setUsers] = useState<UserItem[]>([])

  const fetchProfile = useCallback(async () => {
    if (!id) return
    try {
      const res = await employeeApi.getById(Number(id))
      setProfile(res.data)
    } catch {
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const populateForm = (p: EmployeeProfile) => {
    setPhone(p.phone || '')
    setAddress(p.address || '')
    setBirthday(p.birthday || '')
    setWorkExperience(p.work_experience || '')
    setGraduationSchool(p.graduation_school || '')
    setEducationLevel(p.education_level || '')
    setJoinDate(p.join_date || '')
    setEmploymentStatus(p.employment_status || 'active')
  }

  const startEditing = () => {
    if (!profile) return
    populateForm(profile)
    setEditing(true)
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await employeeApi.update(profile.id, {
        phone: phone || null,
        address: address || null,
        birthday: birthday || null,
        work_experience: workExperience || null,
        graduation_school: graduationSchool || null,
        education_level: educationLevel || null,
        join_date: joinDate || null,
        employment_status: employmentStatus,
      })
      setProfile(res.data)
      setEditing(false)
      setSuccess(t('common.saveSuccess'))
    } catch (err: any) {
      setError(err.response?.data?.detail || t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const openResign = async () => {
    try {
      const r = await userApi.list({ page_size: 100 })
      setUsers(r.data.items)
    } catch {
      // Use empty list
    }
    setResignOpen(true)
  }

  const handleResign = async () => {
    if (!profile || !successorId) return
    setSaving(true)
    setError('')
    try {
      const res = await employeeApi.resign(profile.id, {
        successor_id: successorId,
        resignation_date: resignationDate || undefined,
      })
      setProfile(res.data)
      setResignOpen(false)
      setSuccess(t('employee.resignSuccess'))
    } catch (err: any) {
      setError(err.response?.data?.detail || t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="p-6 space-y-4 max-w-2xl">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  )
  if (!profile) return <div className="p-6 text-center text-red-500">{error}</div>

  const isResigned = profile.employment_status === 'resigned'

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate('/admin/employees')}><ArrowLeft size={14} className="inline" /> {t('employee.employeeList')}</Button>
      </div>
      <h1 className="text-2xl font-bold mb-6">
        {profile.full_name || profile.username} — {t('employee.employeeDetail')}
      </h1>

      {error && <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
      {success && <div className="mb-4 rounded bg-green-50 px-4 py-2 text-sm text-green-600">{success}</div>}

      {editing ? (
        <div className="rounded-lg bg-white p-6 shadow space-y-4 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-800">{t('employee.editProfile')}</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.phone')}</label>
              <Input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.birthday')}</label>
              <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.address')}</label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.educationLevel')}</label>
              <Select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)}>
                <option value="">--</option>
                {EDUCATION_LEVELS.map((l) => (
                  <option key={l} value={l}>{t(`employee.educationLevels.${l}`)}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.graduationSchool')}</label>
              <Input type="text" value={graduationSchool} onChange={(e) => setGraduationSchool(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.workExperience')}</label>
              <Textarea value={workExperience} onChange={(e) => setWorkExperience(e.target.value)} rows={3} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.joinDate')}</label>
              <Input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.employmentStatus')}</label>
              <Select value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value)}>
                <option value="active">{t('employee.statusLabels.active')}</option>
                <option value="resigned">{t('employee.statusLabels.resigned')}</option>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
            <Button variant="outline" onClick={() => { setEditing(false); populateForm(profile) }}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-white p-6 shadow space-y-6 max-w-2xl">
          {/* Employment info */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('employee.employmentInfo')}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">{t('employee.department')}</span>
                <p className="font-medium">{profile.department_name || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">{t('employee.employmentStatus')}</span>
                <p className="font-medium">{t(`employee.statusLabels.${profile.employment_status}`)}</p>
              </div>
              <div>
                <span className="text-gray-500">{t('employee.joinDate')}</span>
                <p className="font-medium">{profile.join_date || '—'}</p>
              </div>
              {isResigned && (
                <div>
                  <span className="text-gray-500">{t('employee.resignationDate')}</span>
                  <p className="font-medium">{profile.resignation_date || '—'}</p>
                </div>
              )}
            </div>
          </section>

          {/* Identity info */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('employee.identityInfo')}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">{t('employee.birthday')}</span>
                <p className="font-medium">{profile.birthday || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">{t('employee.educationLevel')}</span>
                <p className="font-medium">{profile.education_level ? t(`employee.educationLevels.${profile.education_level}`) : '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">{t('employee.graduationSchool')}</span>
                <p className="font-medium">{profile.graduation_school || '—'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">{t('employee.workExperience')}</span>
                <p className="font-medium whitespace-pre-wrap">{profile.work_experience || '—'}</p>
              </div>
            </div>
          </section>

          {/* Contact info */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('employee.contactInfo')}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">{t('employee.phone')}</span>
                <p className="font-medium">{profile.phone || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">{t('employee.address')}</span>
                <p className="font-medium">{profile.address || '—'}</p>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button onClick={startEditing}>
              {t('common.edit')}
            </Button>
            {!isResigned && (
              <Button variant="destructive" onClick={openResign}>
                {t('employee.resign')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Resign Dialog */}
      {resignOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[480px] max-h-[80vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{t('employee.resignTitle')}</h2>
            <p className="text-sm text-gray-600 mb-4">
              {profile.full_name || profile.username} 将被设为「已离职」。请选择交接人以接收其下属、待办任务和资产。
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.successor')}</label>
                <Select
                  value={successorId ?? ''}
                  onChange={(e) => setSuccessorId(Number(e.target.value))}
                >
                  <option value="">-- 请选择 --</option>
                  {users
                    .filter((u) => u.id !== profile.user_id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.username} ({u.username})
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.resignationDateOptional')}</label>
                <Input type="date" value={resignationDate} onChange={(e) => setResignationDate(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button variant="destructive" onClick={handleResign} disabled={saving || !successorId} className="flex-1">
                {saving ? t('common.processing') : t('employee.resignConfirm')}
              </Button>
              <Button variant="outline" onClick={() => setResignOpen(false)} className="flex-1">
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
