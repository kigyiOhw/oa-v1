import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { useAuthStore } from '../stores/auth'
import { workflowApi } from '../api/workflow'
import { announcementApi, Announcement } from '../api/announcement'
import { mediaApi, MediaFile } from '../api/media'
import { settingsApi, CompanyInfo, QuickLink } from '../api/settings'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const shortcutItems = [
    { label: t('dashboard.shortcuts.leave'), icon: '📝', to: '/leaves', requiresAuth: true },
    { label: t('dashboard.shortcuts.expense'), icon: '💰', to: '/expenses', requiresAuth: true },
    { label: t('dashboard.shortcuts.overtime'), icon: '⏰', to: '/overtimes', requiresAuth: true },
    { label: t('dashboard.shortcuts.approval'), icon: '✅', to: '/workflow/tasks', requiresAuth: true },
    { label: t('dashboard.shortcuts.notification'), icon: '🔔', to: '/notifications', requiresAuth: true },
    { label: t('dashboard.shortcuts.contacts'), icon: '👥', to: '/contacts', requiresAuth: true },
    { label: t('dashboard.shortcuts.myTasks'), icon: '📋', to: '/workflow/tasks', requiresAuth: true },
    { label: t('dashboard.shortcuts.attendance'), icon: '🕐', to: '/attendance', requiresAuth: true },
    { label: t('asset.myAssets'), icon: '💻', to: '/my-assets', requiresAuth: true },
  ]

  const iconMap: Record<string, string> = {
    link: '🔗', book: '📖', users: '👥', file: '📄',
    calendar: '📅', chart: '📊', mail: '📧', settings: '⚙️', home: '🏠', star: '⭐',
  }

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: '', logo_url: '', description: '', address: '', contact: '' })
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [pendingTasks, setPendingTasks] = useState<number | null>(null)
  const [totalInstances, setTotalInstances] = useState<number | null>(null)

  useEffect(() => {
    settingsApi.getCompanyInfo().then((res) => setCompanyInfo(res.data)).catch(() => {})
    announcementApi.listPublished(1, 5).then((res) => setAnnouncements(res.data.items)).catch(() => {})
    mediaApi.list(1, 20).then((res) => setMediaFiles(res.data.items)).catch(() => {})
    settingsApi.getQuickLinks().then((res) => setQuickLinks(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    workflowApi.listTasks({ page_size: 1 }).then((res) => setPendingTasks(res.data.total))
    workflowApi.listInstances({ page_size: 1 }).then((res) => setTotalInstances(res.data.total))
  }, [isAuthenticated])

  useEffect(() => {
    if (mediaFiles.length === 0) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % mediaFiles.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [mediaFiles.length])

  const handleShortcut = (to: string, requiresAuth: boolean) => {
    if (requiresAuth && !isAuthenticated) {
      navigate('/login')
    } else {
      navigate(to)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">
            {companyInfo.name || t('dashboard.title')}
          </h1>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <>
                <Link to="/workflow/tasks" className="text-sm text-blue-600 hover:underline">{t('dashboard.pending')}</Link>
                <Link to="/workflow/my" className="text-sm text-blue-600 hover:underline">{t('dashboard.myInstances')}</Link>
                <Link to="/admin" className="text-sm text-blue-600 hover:underline">{t('dashboard.admin')}</Link>
                <Link to="/profile" className="text-sm text-gray-600 hover:text-blue-600 hover:underline">{user?.full_name || user?.username}</Link>
                <button
                  onClick={() => { logout(); navigate('/') }}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  {t('auth.logout')}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-blue-600 hover:underline">{t('auth.login')}</Link>
                <Link to="/register" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                  {t('auth.register')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-8">
        <div className="rounded-lg bg-white shadow-sm p-6">
          {companyInfo.logo_url ? (
            <img src={companyInfo.logo_url} alt="logo" className="h-12 mb-3" />
          ) : (
            <div className="h-12 w-12 mb-3 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold">
              {(companyInfo.name || 'OA')[0]}
            </div>
          )}
          <h2 className="text-2xl font-bold text-gray-900">{companyInfo.name || t('dashboard.title')}</h2>
          <p className="mt-2 text-gray-500">{companyInfo.description || ''}</p>
          {companyInfo.address && <p className="mt-1 text-sm text-gray-400">{companyInfo.address}</p>}
          {companyInfo.contact && <p className="text-sm text-gray-400">{companyInfo.contact}</p>}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {shortcutItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleShortcut(item.to, item.requiresAuth)}
              className="flex flex-col items-center gap-1 rounded-lg bg-white p-4 shadow-sm hover:shadow-md transition-shadow text-center"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs text-gray-700">{item.label}</span>
            </button>
          ))}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.sections.latestAnnouncements')}</h3>
          {announcements.length > 0 ? (
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className="rounded-lg bg-white shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {ann.is_pinned && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">置顶</span>}
                    <h4 className="font-semibold text-gray-900">{ann.title}</h4>
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-600 line-clamp-3">
                    <ReactMarkdown>{ann.content}</ReactMarkdown>
                  </div>
                  {ann.published_at && (
                    <p className="mt-2 text-xs text-gray-400">{new Date(ann.published_at).toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US')}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-white shadow-sm p-6 text-center text-gray-400 text-sm">
              {t('dashboard.empty.noAnnouncements')}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white shadow-sm overflow-hidden">
          <h3 className="px-4 pt-4 text-lg font-semibold text-gray-900">{t('dashboard.sections.companyStyle')}</h3>
          {mediaFiles.length > 0 ? (
            <div className="relative aspect-video bg-gray-100">
              <img
                src={mediaFiles[currentSlide]?.file_path}
                alt={mediaFiles[currentSlide]?.title}
                className="w-full h-full object-contain"
              />
              {mediaFiles.length > 1 && (
                <>
                  <button className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/50"
                    onClick={() => setCurrentSlide((prev) => (prev - 1 + mediaFiles.length) % mediaFiles.length)}>‹</button>
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/50"
                    onClick={() => setCurrentSlide((prev) => (prev + 1) % mediaFiles.length)}>›</button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {mediaFiles.map((_, i) => (
                      <button key={i} className={`w-2 h-2 rounded-full ${i === currentSlide ? 'bg-white' : 'bg-white/50'}`}
                        onClick={() => setCurrentSlide(i)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="aspect-video bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
              {t('dashboard.empty.noImages')}
            </div>
          )}
        </div>

        {isAuthenticated && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.sections.myItems')}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Link to="/workflow/tasks" className="rounded-lg bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="mb-2 text-base font-semibold text-gray-900">{t('dashboard.sections.myTasks')}</h4>
                <p className="text-3xl font-bold text-blue-600">{pendingTasks ?? '-'}</p>
              </Link>
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h4 className="mb-2 text-base font-semibold text-gray-900">{t('dashboard.sections.myProcessed')}</h4>
                <p className="text-3xl font-bold text-green-600">-</p>
              </div>
              <Link to="/workflow/my" className="rounded-lg bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="mb-2 text-base font-semibold text-gray-900">{t('dashboard.sections.myInitiated')}</h4>
                <p className="text-3xl font-bold text-purple-600">{totalInstances ?? '-'}</p>
              </Link>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.sections.intranetNav')}</h3>
          {quickLinks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {quickLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-white p-3 shadow-sm hover:shadow-md transition-shadow text-sm">
                  <span>{iconMap[link.icon] || '🔗'}</span>
                  <span className="text-gray-700">{link.name}</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-white shadow-sm p-6 text-center text-gray-400 text-sm">
              {t('dashboard.empty.noLinks')}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
