import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { settingsApi, CompanyInfo, QuickLink } from '../../api/settings'

export default function CompanySettings() {
  const { t } = useTranslation()
  const [info, setInfo] = useState<CompanyInfo>({ name: '', logo_url: '', description: '', address: '', contact: '' })
  const [links, setLinks] = useState<QuickLink[]>([])
  const [savingInfo, setSavingInfo] = useState(false)
  const [savingLinks, setSavingLinks] = useState(false)
  const [infoMsg, setInfoMsg] = useState('')
  const [linksMsg, setLinksMsg] = useState('')

  useEffect(() => {
    settingsApi.getCompanyInfo().then((res) => setInfo(res.data)).catch(() => {})
    settingsApi.getQuickLinks().then((res) => setLinks(res.data)).catch(() => {})
  }, [])

  const saveInfo = async () => {
    setSavingInfo(true)
    setInfoMsg('')
    try {
      await settingsApi.updateCompanyInfo(info)
      setInfoMsg(t('common.saveSuccess'))
    } catch (e: any) {
      setInfoMsg(e.response?.data?.detail || t('common.saveFailed'))
    } finally {
      setSavingInfo(false)
    }
  }

  const addLink = () => {
    setLinks([...links, { name: '', url: '', icon: 'link' }])
  }

  const removeLink = (idx: number) => {
    setLinks(links.filter((_, i) => i !== idx))
  }

  const updateLink = (idx: number, field: keyof QuickLink, value: string) => {
    setLinks(links.map((l, i) => (i === idx ? { ...l, [field]: value } : l)))
  }

  const saveLinks = async () => {
    setSavingLinks(true)
    setLinksMsg('')
    try {
      const res = await settingsApi.updateQuickLinks(links)
      setLinks(res.data)
      setLinksMsg(t('common.saveSuccess'))
    } catch (e: any) {
      setLinksMsg(e.response?.data?.detail || t('common.saveFailed'))
    } finally {
      setSavingLinks(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <section className="bg-white rounded-lg shadow-sm p-6 border">
        <h2 className="text-lg font-semibold mb-4">{t('settings.companyInfo')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            {t('settings.companyName')}
            <input
              className="block w-full border rounded px-2 py-1 mt-0.5"
              value={info.name}
              onChange={(e) => setInfo({ ...info, name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            {t('settings.logoUrl')}
            <input
              className="block w-full border rounded px-2 py-1 mt-0.5"
              value={info.logo_url}
              onChange={(e) => setInfo({ ...info, logo_url: e.target.value })}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            {t('settings.description')}
            <textarea
              className="block w-full border rounded px-2 py-1 mt-0.5"
              rows={3}
              value={info.description}
              onChange={(e) => setInfo({ ...info, description: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            {t('settings.address')}
            <input
              className="block w-full border rounded px-2 py-1 mt-0.5"
              value={info.address}
              onChange={(e) => setInfo({ ...info, address: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            {t('settings.contact')}
            <input
              className="block w-full border rounded px-2 py-1 mt-0.5"
              value={info.contact}
              onChange={(e) => setInfo({ ...info, contact: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
            onClick={saveInfo}
            disabled={savingInfo}
          >
            {savingInfo ? t('common.saving') : t('settings.saveCompanyInfo')}
          </button>
          {infoMsg && <span className={`text-sm ${infoMsg === t('common.saveSuccess') ? 'text-green-600' : 'text-red-600'}`}>{infoMsg}</span>}
        </div>
      </section>

      <section className="bg-white rounded-lg shadow-sm p-6 border">
        <h2 className="text-lg font-semibold mb-4">{t('settings.quickLinks')}</h2>
        {links.map((link, idx) => (
          <div key={idx} className="flex gap-2 mb-2 items-center">
            <input
              className="flex-1 border rounded px-2 py-1 text-sm"
              placeholder={t('settings.namePlaceholder')}
              value={link.name}
              onChange={(e) => updateLink(idx, 'name', e.target.value)}
            />
            <input
              className="flex-1 border rounded px-2 py-1 text-sm"
              placeholder={t('settings.urlPlaceholder')}
              value={link.url}
              onChange={(e) => updateLink(idx, 'url', e.target.value)}
            />
            <select
              className="border rounded px-2 py-1 text-sm w-24"
              value={link.icon}
              onChange={(e) => updateLink(idx, 'icon', e.target.value)}
            >
              {['link', 'book', 'users', 'file', 'calendar', 'chart', 'mail', 'settings', 'home', 'star'].map((icon) => (
                <option key={icon} value={icon}>{icon}</option>
              ))}
            </select>
            <button
              className="text-red-500 text-xs hover:underline"
              onClick={() => removeLink(idx)}
            >
              {t('common.remove')}
            </button>
          </div>
        ))}
        <div className="mt-3 flex gap-3">
          <button className="text-blue-600 text-sm hover:underline" onClick={addLink}>{t('settings.addLink')}</button>
          <button
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
            onClick={saveLinks}
            disabled={savingLinks}
          >
            {savingLinks ? t('common.saving') : t('settings.saveLinks')}
          </button>
          {linksMsg && <span className={`text-sm ${linksMsg === t('common.saveSuccess') ? 'text-green-600' : 'text-red-600'}`}>{linksMsg}</span>}
        </div>
      </section>
    </div>
  )
}
