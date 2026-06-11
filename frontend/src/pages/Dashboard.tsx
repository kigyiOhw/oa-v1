import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { useAuthStore, getAdminLevel } from '../stores/auth'
import { announcementApi, Announcement } from '../api/announcement'
import { mediaApi, MediaFile } from '../api/media'
import { settingsApi, CompanyInfo, QuickLink } from '../api/settings'
import { dashboardApi, DashboardStats } from '../api/dashboard'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import {
  FileText, DollarSign, Clock, CheckCircle, Bell, Users,
  ClipboardList, Timer, Laptop, LinkIcon, Book, File, Calendar,
  BarChart3, Mail, Settings, Home, Star, ChevronLeft, ChevronRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const CHART_COLORS = [
  'hsl(221.2 83.2% 53.3%)',   // primary (blue)
  'hsl(142.1 76.2% 36.3%)',   // success (green)
  'hsl(32.1 94.6% 43.7%)',    // warning (orange)
  'hsl(0 72.2% 50.6%)',       // danger (red)
  'hsl(262.1 83.3% 57.8%)',   // purple
]

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
  const [statsLoading, setStatsLoading] = useState(false)
  const [announcementsExpanded, setAnnouncementsExpanded] = useState(false)
  const adminLevel = getAdminLevel(user)

  useEffect(() => {
    settingsApi.getCompanyInfo().then((res) => setCompanyInfo(res.data)).catch(() => {})
    announcementApi.listPublished(1, 10).then((res) => setAnnouncements(res.data.items)).catch(() => {})
    mediaApi.list(1, 20).then((res) => setMediaFiles(res.data.items.filter(f => f.file_type !== 'document'))).catch(() => {})
    settingsApi.getQuickLinks().then((res) => setQuickLinks(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    setStatsLoading(true)
    dashboardApi.getStats()
      .then((res) => setStats(res.data.data))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [isAuthenticated])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    if (mediaFiles.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % mediaFiles.length)
    }, 4000)
  }, [mediaFiles.length, stopTimer])

  useEffect(() => {
    if (mediaFiles.length === 0) return
    startTimer()
    return () => stopTimer()
  }, [mediaFiles.length, startTimer, stopTimer])

  const handleShortcut = (to: string, requiresAuth: boolean) => {
    if (requiresAuth && !isAuthenticated) {
      navigate('/login')
    } else {
      navigate(to)
    }
  }

  const isAdmin = adminLevel === 'super_admin' || adminLevel === 'module_admin' || adminLevel === 'dept_admin'

  // Prepare chart data
  const leaveTypeData = stats?.leave?.by_type
    ? Object.entries(stats.leave.by_type).map(([type, count]) => ({ name: type, value: count }))
    : []

  const assetStatusData = stats?.asset?.by_status
    ? Object.entries(stats.asset.by_status).map(([status, count]) => ({ name: status, value: count }))
    : []

  const deptUserData = stats?.org?.users_by_department
    ? stats.org.users_by_department.map((d) => ({ name: d.dept_name, count: d.count }))
    : []

  const attendanceData = stats?.attendance
    ? [
        { name: t('dashboard.stats.workDays'), value: stats.attendance.work_days },
        { name: t('dashboard.stats.lateCount'), value: stats.attendance.late_count },
        { name: t('dashboard.stats.earlyCount'), value: stats.attendance.early_count },
        { name: t('dashboard.stats.absentCount'), value: stats.attendance.absent_count },
        { name: t('dashboard.stats.leaveDays'), value: stats.attendance.leave_count },
      ]
    : []

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white dark:bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900 dark:text-foreground">
            {companyInfo.name || t('dashboard.title')}
          </h1>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <>
                <Link to="/workflow/tasks" className="text-sm text-blue-600 hover:underline">{t('dashboard.pending')}</Link>
                <Link to="/workflow/my" className="text-sm text-blue-600 hover:underline">{t('dashboard.myInstances')}</Link>
                <Link to="/admin" className="text-sm text-blue-600 hover:underline">{t('dashboard.admin')}</Link>
                <Link to="/profile" className="text-sm text-gray-600 hover:text-blue-600 hover:underline dark:text-muted-foreground">{user?.full_name || user?.username}</Link>
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

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Company Info */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            {companyInfo.logo_url ? (
              <img src={companyInfo.logo_url} alt="logo" className="h-8" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                {(companyInfo.name || 'OA')[0]}
              </div>
            )}
            <h2 className="text-lg font-bold text-gray-900 dark:text-foreground">{companyInfo.name || t('dashboard.title')}</h2>
          </div>
        </Card>

        {/* Latest Announcements */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-3">{t('dashboard.sections.latestAnnouncements')}</h3>
          {announcements.length > 0 ? (
            <>
              <div className="space-y-3">
                {(announcementsExpanded ? announcements : announcements.slice(0, 3)).map((ann) => (
                  <Card key={ann.id} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {ann.is_pinned && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">{t('common.pinned')}</span>}
                      <h4 className="font-semibold text-gray-900 dark:text-foreground">{ann.title}</h4>
                    </div>
                    <div className="prose prose-sm max-w-none text-gray-600 dark:text-muted-foreground line-clamp-3">
                      <ReactMarkdown>{ann.content}</ReactMarkdown>
                    </div>
                    {ann.published_at && (
                      <p className="mt-2 text-xs text-gray-400">{new Date(ann.published_at).toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US')}</p>
                    )}
                  </Card>
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
                      ? t('common.showLess')
                      : t('common.showMore', { count: announcements.length - 3 })}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <EmptyState title={t('dashboard.empty.noAnnouncements')} />
          )}
        </div>

        {/* Shortcuts */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {shortcutItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleShortcut(item.to, item.requiresAuth)}
              className="flex flex-col items-center gap-1 rounded-lg bg-card text-card-foreground p-4 shadow-sm hover:shadow-md transition-shadow text-center border"
            >
              <item.Icon size={24} className="text-gray-600 dark:text-muted-foreground" />
              <span className="text-xs text-gray-700 dark:text-muted-foreground">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Workflow & Leave Stats Cards (authenticated) */}
        {isAuthenticated && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-3">{t('dashboard.sections.myItems')}</h3>
            {statsLoading ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Link to="/workflow/tasks" className="block">
                  <Card className="p-6 hover:shadow-md transition-shadow h-full">
                    <CardHeader className="p-0 mb-2">
                      <CardTitle className="text-base">{t('dashboard.sections.myTasks')}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <p className="text-3xl font-bold text-primary">{stats?.workflow.pending_tasks ?? '-'}</p>
                    </CardContent>
                  </Card>
                </Link>
                <Card className="p-6">
                  <CardHeader className="p-0 mb-2">
                    <CardTitle className="text-base">{t('dashboard.sections.myProcessed')}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-3xl font-bold text-green-600">{stats?.workflow.processed ?? '-'}</p>
                  </CardContent>
                </Card>
                <Link to="/workflow/my" className="block">
                  <Card className="p-6 hover:shadow-md transition-shadow h-full">
                    <CardHeader className="p-0 mb-2">
                      <CardTitle className="text-base">{t('dashboard.sections.myInitiated')}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <p className="text-3xl font-bold text-purple-600">{stats?.workflow.initiated ?? '-'}</p>
                    </CardContent>
                  </Card>
                </Link>
                <Link to="/leaves" className="block">
                  <Card className="p-6 hover:shadow-md transition-shadow h-full">
                    <CardHeader className="p-0 mb-2">
                      <CardTitle className="text-base">{t('dashboard.stats.leavesThisMonth')}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <p className="text-3xl font-bold text-orange-600">{stats?.leave.total_this_month ?? '-'}</p>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Leave Type Distribution Chart (authenticated) */}
        {isAuthenticated && (statsLoading || leaveTypeData.length > 0) && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-3">{t('dashboard.charts.leaveTypeDistribution')}</h3>
            {statsLoading ? (
              <Skeleton className="h-[250px] w-full rounded-xl" />
            ) : (
              <Card className="p-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={leaveTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name} (${value})`}
                    >
                      {leaveTypeData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        )}

        {/* Organization Overview (admin only) */}
        {isAuthenticated && isAdmin && (statsLoading || stats?.org) && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-3">{t('dashboard.sections.orgOverview')}</h3>
            {statsLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </div>
                <Skeleton className="h-52 rounded-xl" />
              </div>
            ) : stats?.org ? (
              <div className="space-y-4">
                {/* Stat cards — compact row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="p-4 flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Users size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('dashboard.stats.totalUsers')}</p>
                      <p className="text-xl font-bold text-primary">{stats.org.total_users}</p>
                    </div>
                  </Card>
                  <Card className="p-4 flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <Home size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('dashboard.stats.totalDepartments')}</p>
                      <p className="text-xl font-bold text-indigo-600">{stats.org.total_departments}</p>
                    </div>
                  </Card>
                </div>
                {/* Bar chart — full width */}
                {deptUserData.length > 0 ? (
                  <Card className="p-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-muted-foreground mb-3">{t('dashboard.charts.usersByDepartment')}</p>
                    <ResponsiveContainer width="100%" height={Math.max(200, deptUserData.length * 40)}>
                      <BarChart data={deptUserData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(221.2 83.2% 53.3%)" radius={[0, 4, 4, 0]} maxBarSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                ) : (
                  <Card className="p-6 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                  </Card>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Asset Overview (admin only) */}
        {isAuthenticated && isAdmin && (statsLoading || stats?.asset) && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-3">{t('dashboard.charts.assetStatusDistribution')}</h3>
            {statsLoading ? (
              <Skeleton className="h-[220px] w-full rounded-xl" />
            ) : stats?.asset ? (
              <Card className="p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={assetStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name} (${value})`}
                    >
                      {assetStatusData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            ) : null}
          </div>
        )}

        {/* My Attendance Overview (authenticated) */}
        {isAuthenticated && (statsLoading || stats?.attendance) && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-3">{t('dashboard.charts.attendanceOverview')}</h3>
            {statsLoading ? (
              <Skeleton className="h-[220px] w-full rounded-xl" />
            ) : stats?.attendance ? (
              <Card className="p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={attendanceData}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {attendanceData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            ) : null}
          </div>
        )}

        {/* Media Carousel */}
        <Card className="overflow-hidden">
          <h3 className="px-4 pt-4 text-lg font-semibold text-gray-900 dark:text-foreground">{t('dashboard.sections.companyStyle')}</h3>
          {mediaFiles.length > 0 ? (
            <div
              className="relative aspect-video bg-gray-100 dark:bg-muted"
              onMouseEnter={stopTimer}
              onMouseLeave={startTimer}
            >
              {mediaFiles[currentSlide]?.file_type === 'video' ? (
                <video
                  src={mediaFiles[currentSlide]?.file_path}
                  controls
                  className="w-full h-full object-contain"
                  onPlay={stopTimer}
                  onPause={startTimer}
                  onEnded={startTimer}
                />
              ) : (
                <img
                  src={mediaFiles[currentSlide]?.file_path}
                  alt={mediaFiles[currentSlide]?.title}
                  className="w-full h-full object-contain"
                />
              )}
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
            <div className="aspect-video bg-gray-50 dark:bg-muted flex items-center justify-center">
              <EmptyState title={t('dashboard.empty.noImages')} />
            </div>
          )}
        </Card>

        {/* Quick Links */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-3">{t('dashboard.sections.intranetNav')}</h3>
          {quickLinks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {quickLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-card text-card-foreground p-3 shadow-sm hover:shadow-md transition-shadow text-sm border">
                  <span className="text-gray-500 dark:text-muted-foreground">{iconMap[link.icon] || <LinkIcon size={16} />}</span>
                  <span className="text-gray-700 dark:text-muted-foreground">{link.name}</span>
                </a>
              ))}
            </div>
          ) : (
            <EmptyState title={t('dashboard.empty.noLinks')} />
          )}
        </div>
      </main>
    </div>
  )
}
