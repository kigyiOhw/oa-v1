import { useEffect, useState } from 'react'
import { settingsApi, CompanyInfo, QuickLink } from '../../api/settings'

export default function CompanySettings() {
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
      setInfoMsg('Saved')
    } catch (e: any) {
      setInfoMsg(e.response?.data?.detail || 'Save failed')
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
      setLinksMsg('Saved')
    } catch (e: any) {
      setLinksMsg(e.response?.data?.detail || 'Save failed')
    } finally {
      setSavingLinks(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Company Settings</h1>

      {/* Company Info */}
      <section className="bg-white rounded-lg shadow-sm p-6 border">
        <h2 className="text-lg font-semibold mb-4">Company Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            Company Name
            <input
              className="block w-full border rounded px-2 py-1 mt-0.5"
              value={info.name}
              onChange={(e) => setInfo({ ...info, name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Logo URL
            <input
              className="block w-full border rounded px-2 py-1 mt-0.5"
              value={info.logo_url}
              onChange={(e) => setInfo({ ...info, logo_url: e.target.value })}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            Description
            <textarea
              className="block w-full border rounded px-2 py-1 mt-0.5"
              rows={3}
              value={info.description}
              onChange={(e) => setInfo({ ...info, description: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Address
            <input
              className="block w-full border rounded px-2 py-1 mt-0.5"
              value={info.address}
              onChange={(e) => setInfo({ ...info, address: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Contact
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
            {savingInfo ? 'Saving...' : 'Save Company Info'}
          </button>
          {infoMsg && <span className={`text-sm ${infoMsg === 'Saved' ? 'text-green-600' : 'text-red-600'}`}>{infoMsg}</span>}
        </div>
      </section>

      {/* Quick Links */}
      <section className="bg-white rounded-lg shadow-sm p-6 border">
        <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
        {links.map((link, idx) => (
          <div key={idx} className="flex gap-2 mb-2 items-center">
            <input
              className="flex-1 border rounded px-2 py-1 text-sm"
              placeholder="Name"
              value={link.name}
              onChange={(e) => updateLink(idx, 'name', e.target.value)}
            />
            <input
              className="flex-1 border rounded px-2 py-1 text-sm"
              placeholder="URL (https://...)"
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
              Remove
            </button>
          </div>
        ))}
        <div className="mt-3 flex gap-3">
          <button className="text-blue-600 text-sm hover:underline" onClick={addLink}>+ Add Link</button>
          <button
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
            onClick={saveLinks}
            disabled={savingLinks}
          >
            {savingLinks ? 'Saving...' : 'Save Links'}
          </button>
          {linksMsg && <span className={`text-sm ${linksMsg === 'Saved' ? 'text-green-600' : 'text-red-600'}`}>{linksMsg}</span>}
        </div>
      </section>
    </div>
  )
}
