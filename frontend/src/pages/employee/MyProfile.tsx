import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { employeeApi, type EmployeeProfile } from '../../api/employees'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'

const EDUCATION_LEVELS = ['high_school', 'associate', 'bachelor', 'master', 'doctor', 'other']

export default function MyProfile() {
  const { t } = useTranslation()
  const [profile, setProfile] = useState<EmployeeProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editContact, setEditContact] = useState(false)

  // Contact fields (always editable)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  // Onboarding fields
  const [birthday, setBirthday] = useState('')
  const [workExperience, setWorkExperience] = useState('')
  const [graduationSchool, setGraduationSchool] = useState('')
  const [educationLevel, setEducationLevel] = useState('')

  const fetchProfile = useCallback(async () => {
    try {
      const res = await employeeApi.getMyProfile()
      const p = res.data
      setProfile(p)
      setPhone(p.phone || '')
      setAddress(p.address || '')
      setBirthday(p.birthday || '')
      setWorkExperience(p.work_experience || '')
      setGraduationSchool(p.graduation_school || '')
      setEducationLevel(p.education_level || '')
    } catch {
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleSaveContact = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await employeeApi.updateMyProfile({ phone, address })
      setProfile(res.data)
      setEditContact(false)
      setSuccess(t('common.saveSuccess'))
    } catch (err: any) {
      setError(err.response?.data?.detail || t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleOnboarding = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await employeeApi.completeOnboarding({
        phone,
        address,
        birthday: birthday || undefined,
        work_experience: workExperience || undefined,
        graduation_school: graduationSchool || undefined,
        education_level: educationLevel || undefined,
      })
      setProfile(res.data)
      setSuccess(t('employee.onboardingComplete'))
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

  // ── Onboarding mode ──
  if (!profile.onboarding_complete) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('employee.onboarding')}</h1>

        {error && <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        {success && <div className="mb-4 rounded bg-green-50 px-4 py-2 text-sm text-green-600">{success}</div>}

        <div className="rounded-lg bg-white p-6 shadow space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">{t('employee.contactInfo')}</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.phone')}</label>
            <Input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.address')}</label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </div>

          <h2 className="text-lg font-semibold text-gray-800 pt-2">{t('employee.identityInfo')}</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.birthday')}</label>
            <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
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
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.workExperience')}</label>
            <Textarea value={workExperience} onChange={(e) => setWorkExperience(e.target.value)} rows={3} />
          </div>

          <Button onClick={handleOnboarding} disabled={saving} className="w-full">
            {saving ? t('common.saving') : t('employee.completeOnboarding')}
          </Button>
        </div>
      </div>
    )
  }

  // ── View/Edit mode ──
  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link to="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">{t('common.backToHome')}</Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('employee.myProfile')}</h1>

      {error && <div className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
      {success && <div className="mb-4 rounded bg-green-50 px-4 py-2 text-sm text-green-600">{success}</div>}

      <div className="rounded-lg bg-white p-6 shadow space-y-6">
        {/* Employment info — read only */}
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
            {profile.employment_status === 'resigned' && (
              <div>
                <span className="text-gray-500">{t('employee.resignationDate')}</span>
                <p className="font-medium">{profile.resignation_date || '—'}</p>
              </div>
            )}
          </div>
        </section>

        {/* Identity info — read only after onboarding */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">{t('employee.identityInfo')}</h2>
          <p className="text-xs text-gray-400 mb-3">{t('employee.identityLocked')}</p>
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

        {/* Contact info — editable */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">{t('employee.contactInfo')}</h2>
            {!editContact && (
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setEditContact(true)}>
                {t('common.edit')}
              </Button>
            )}
          </div>

          {editContact ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.phone')}</label>
                <Input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('employee.address')}</label>
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveContact} disabled={saving}>
                  {saving ? t('common.saving') : t('common.save')}
                </Button>
                <Button variant="secondary" onClick={() => { setEditContact(false); setPhone(profile.phone || ''); setAddress(profile.address || '') }}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
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
          )}
        </section>
      </div>
    </div>
  )
}
