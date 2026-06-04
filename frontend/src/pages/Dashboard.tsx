import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { useAuthStore, getAdminLevel } from '../stores/auth'
import { announcementApi, Announcement } from '../api/announcement'
import { mediaApi, MediaFile } from '../api/media'
import { settingsApi, CompanyInfo, QuickLink } from '../api/settings'
import { dashboardApi, DashboardStats } from '../api/dashboard'
import LanguageSwitcher from '../components/LanguageSwitcher'
import {
  FileText, DollarSign, Clock, CheckCircle, Bell, Users,
  ClipboardList, Timer, Laptop, LinkIcon, Book, File, Calendar,
  BarChart3, Mail, Settings, Home, Star, ChevronLeft, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const shortcutItems = [
    { label: t('dashboard.shortcuts.leave'), Icon: FileText, to: '/leaves', requiresAuth: true },
    { label: t('dashboard.shortcuts.expense'), Icon: DollarSign, to: '/expenses', requiresAuth: true },
    { label: t('dashboard.shortcuts.overtime'), Icon: Clock, to: '/overtimes', requiresAuth: true },
    { label: t('dashboard.shortcuts.approval'), Icon: CheckCircle, to: '/workflow/tasks', requiresAuth: true },
    { label: t('dashboard.shortcuts.notification'), Icon: Bell, to: '/notifications', requiresAuth: true },
    { label: t('dashboard.shortcuts.contacts'), Icon: Users, to: '/contacts', requiresAuth: true },
    { label: t('dashboard.shortcuts.myTasks'), Icon: ClipboardList, to: '/workflow/tasks', requiresAuth: true },
    { label: t('dashboard.shortcuts.attendance'), Icon: Timer, to: '/attendance', requiresAuth: true },
    { label: t('asset.myAssets'), Icon: Laptop, to: '/my-assets', requiresAuth: true },
  ]

  const iconMap: Record<string, React.ReactNode> = {
    link: <LinkIcon size={16} />, book: <Book size={16} />, users: <Users size={16} />, file: <File size={16} />,
    calendar: <Calendar size={16} />, chart: <BarChart3 size={16} />, mail: <Mail size={16} />,
    settings: <Settings size={16} />, home: <Home size={16} />, star: <Star size={16} />,
  }

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: '', logo_url: '', description: '', address: '', contact: '' })
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [announcementsExpanded, setAnnouncementsExpanded] = useState(false)
  const adminLevel = getAdminLevel(user)

  useEffect(() => {
    settingsApi.getCompanyInfo().then((res) => setCompanyInfo(res.data)).catch(() => {})
    announcementApi.listPublished(1, 10).then((res) => setAnnouncements(res.data.items)).catch(() => {})
    mediaApi.list(1, 20).then((res) => setMediaFiles(res.data.items)).catch(() => {})
    settingsApi.getQuickLinks().then((res) => setQuickLinks(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    dashboardApi.getStats().then((res) => setStats(res.data.data)).catch(() => {})
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

  const isAdmin = adminLevel === 'super_admin' || adminLevel === 'module_admin' || adminLevel === 'dept_admin'

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
                <Button variant="secondary" size="sm" onClick={() => { logout(); navigate('/') }}>
                  {t('auth.logout')}
                </Button>
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
        {/* Company Info */}
        <div className="rounded-lg bg-white shadow-sm p-4">
          <div className="flex items-center gap-3">
            {companyInfo.logo_url ? (
              <img src={companyInfo.logo_url} alt="logo" className="h-8" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                {(companyInfo.name || 'OA')[0]}
              </div>
            )}
            <h2 className="text-lg font-bold text-gray-900">{companyInfo.name || t('dashboard.title')}</h2>
          </div>
        </div>

        {/* Latest Announcements */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.sections.latestAnnouncements')}</h3>
          {announcements.length > 0 ? (
            <>
              <div className="space-y-3">
                {(announcementsExpanded ? announcements : announcements.slice(0, 3)).map((ann) => (
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
              {announcements.length > 3 && (
                <div className="mt-3 text-center">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-blue-600"
                    onClick={() => setAnnouncementsExpanded(!announcementsExpanded)}
                  >
                    {announcementsExpanded
                      ? (i18n.language === 'zh' ? '收起' : 'Show less')
                      : (i18n.language === 'zh'
                        ? `展开更多 (+${announcements.length - 3})`
                        : `Show more (+${announcements.length - 3})`)}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg bg-white shadow-sm p-6 text-center text-gray-400 text-sm">
              {t('dashboard.empty.noAnnouncements')}
            </div>
          )}
        </div>

        {/* Shortcuts */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {shortcutItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleShortcut(item.to, item.requiresAuth)}
              className="flex flex-col items-center gap-1 rounded-lg bg-white p-4 shadow-sm hover:shadow-md transition-shadow text-center"
            >
              <item.Icon size={24} className="text-gray-600" />
              <span className="text-xs text-gray-700">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Workflow & Leave Stats Cards (authenticated) */}
        {isAuthenticated && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.sections.myItems')}</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Link to="/workflow/tasks" className="rounded-lg bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="mb-2 text-base font-semibold text-gray-900">{t('dashboard.sections.myTasks')}</h4>
                <p className="text-3xl font-bold text-blue-600">{stats?.workflow.pending_tasks ?? '-'}</p>
              </Link>
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h4 className="mb-2 text-base font-semibold text-gray-900">{t('dashboard.sections.myProcessed')}</h4>
                <p className="text-3xl font-bold text-green-600">{stats?.workflow.processed ?? '-'}</p>
              </div>
              <Link to="/workflow/my" className="rounded-lg bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="mb-2 text-base font-semibold text-gray-900">{t('dashboard.sections.myInitiated')}</h4>
                <p className="text-3xl font-bold text-purple-600">{stats?.workflow.initiated ?? '-'}</p>
              </Link>
              <Link to="/leaves" className="rounded-lg bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="mb-2 text-base font-semibold text-gray-900">{t('dashboard.stats.leavesThisMonth')}</h4>
                <p className="text-3xl font-bold text-orange-600">{stats?.leave.total_this_month ?? '-'}</p>
              </Link>
            </div>
          </div>
        )}

        {/* Leave Type Breakdown (authenticated) */}
        {isAuthenticated && stats?.leave && Object.keys(stats.leave.by_type).length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.shortcuts.leave')}</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {Object.entries(stats.leave.by_type).map(([type, count]) => (
                <div key={type} className="rounded-lg bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-gray-500 capitalize">{type}</h4>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Organization Overview (admin only) */}
        {isAuthenticated && isAdmin && stats?.org && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.sections.orgOverview')}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex gap-4">
                <div className="flex-1 rounded-lg bg-white p-6 shadow-sm text-center">
                  <p className="text-sm text-gray-500">{t('dashboard.stats.totalUsers')}</p>
                  <p className="mt-1 text-3xl font-bold text-blue-600">{stats.org.total_users}</p>
                </div>
                <div className="flex-1 rounded-lg bg-white p-6 shadow-sm text-center">
                  <p className="text-sm text-gray-500">{t('dashboard.stats.totalDepartments')}</p>
                  <p className="mt-1 text-3xl font-bold text-indigo-600">{stats.org.total_departments}</p>
                </div>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-500 mb-3">{t('admin.departments')}</p>
                {stats.org.users_by_department.length > 0 ? (
                  <div className="space-y-2">
                    {stats.org.users_by_department.map((d) => {
                      const pct = stats.org!.total_users > 0 ? (d.count / stats.org!.total_users) * 100 : 0
                      return (
                        <div key={d.dept_id}>
                          <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                            <span>{d.dept_name}</span>
                            <span>{d.count}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">-</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Asset Overview (admin only) */}
        {isAuthenticated && isAdmin && stats?.asset && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.sections.assetOverview')}</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-white p-4 shadow-sm text-center">
                <p className="text-sm text-gray-500">{t('dashboard.stats.totalAssets')}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{stats.asset.total}</p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm text-center">
                <p className="text-sm text-gray-500">{t('dashboard.stats.inUse')}</p>
                <p className="mt-1 text-2xl font-bold text-green-600">{stats.asset.by_status?.in_use ?? 0}</p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm text-center">
                <p className="text-sm text-gray-500">{t('dashboard.stats.idle')}</p>
                <p className="mt-1 text-2xl font-bold text-yellow-600">{stats.asset.by_status?.idle ?? 0}</p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm text-center">
                <p className="text-sm text-gray-500">{t('dashboard.stats.scrapped')}</p>
                <p className="mt-1 text-2xl font-bold text-red-500">{stats.asset.by_status?.scrapped ?? 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* My Attendance Overview (authenticated) */}
        {isAuthenticated && stats?.attendance && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.sections.myAttendance')}</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              <div className="rounded-lg bg-white p-4 shadow-sm text-center">
                <p className="text-sm text-gray-500">{t('dashboard.stats.workDays')}</p>
                <p className="mt-1 text-2xl font-bold text-blue-600">{stats.attendance.work_days}</p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm text-center">
                <p className="text-sm text-gray-500">{t('dashboard.stats.lateCount')}</p>
                <p className="mt-1 text-2xl font-bold text-yellow-600">{stats.attendance.late_count}</p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm text-center">
                <p className="text-sm text-gray-500">{t('dashboard.stats.earlyCount')}</p>
                <p className="mt-1 text-2xl font-bold text-orange-500">{stats.attendance.early_count}</p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm text-center">
                <p className="text-sm text-gray-500">{t('dashboard.stats.absentCount')}</p>
                <p className="mt-1 text-2xl font-bold text-red-500">{stats.attendance.absent_count}</p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm text-center">
                <p className="text-sm text-gray-500">{t('dashboard.stats.leaveDays')}</p>
                <p className="mt-1 text-2xl font-bold text-purple-600">{stats.attendance.leave_count}</p>
              </div>
            </div>
          </div>
        )}

        {/* Media Carousel */}
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
                    onClick={() => setCurrentSlide((prev) => (prev - 1 + mediaFiles.length) % mediaFiles.length)}><ChevronLeft size={16} /></button>
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/50"
                    onClick={() => setCurrentSlide((prev) => (prev + 1) % mediaFiles.length)}><ChevronRight size={16} /></button>
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

        {/* Quick Links */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('dashboard.sections.intranetNav')}</h3>
          {quickLinks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {quickLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-white p-3 shadow-sm hover:shadow-md transition-shadow text-sm">
                  <span className="text-gray-500">{iconMap[link.icon] || <LinkIcon size={16} />}</span>
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
