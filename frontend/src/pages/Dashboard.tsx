import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { useAuthStore } from '../stores/auth'
import { workflowApi } from '../api/workflow'
import { announcementApi, Announcement } from '../api/announcement'
import { mediaApi, MediaFile } from '../api/media'
import { settingsApi, CompanyInfo, QuickLink } from '../api/settings'

const shortcutItems = [
  { label: '请假', icon: '📝', to: '/workflow/my', requiresAuth: true },
  { label: '报销', icon: '💰', to: '/workflow/my', requiresAuth: true },
  { label: '审批', icon: '✅', to: '/workflow/tasks', requiresAuth: true },
  { label: '通知', icon: '🔔', to: '/workflow/tasks', requiresAuth: true },
  { label: '通讯录', icon: '👥', to: '/admin/users', requiresAuth: true },
  { label: '我的待办', icon: '📋', to: '/workflow/tasks', requiresAuth: true },
]

const iconMap: Record<string, string> = {
  link: '🔗',
  book: '📖',
  users: '👥',
  file: '📄',
  calendar: '📅',
  chart: '📊',
  mail: '📧',
  settings: '⚙️',
  home: '🏠',
  star: '⭐',
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

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
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">
            {companyInfo.name || 'OA 工作台'}
          </h1>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link to="/workflow/tasks" className="text-sm text-blue-600 hover:underline">待办</Link>
                <Link to="/workflow/my" className="text-sm text-blue-600 hover:underline">我发起的</Link>
                <Link to="/admin" className="text-sm text-blue-600 hover:underline">管理</Link>
                <span className="text-sm text-gray-600">{user?.full_name || user?.username}</span>
                <button
                  onClick={() => { logout(); navigate('/') }}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  退出
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-blue-600 hover:underline">登录</Link>
                <Link to="/register" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
                  注册
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-8">
        {/* Company Banner */}
        <div className="rounded-lg bg-white shadow-sm p-6">
          {companyInfo.logo_url ? (
            <img src={companyInfo.logo_url} alt="logo" className="h-12 mb-3" />
          ) : (
            <div className="h-12 w-12 mb-3 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold">
              {(companyInfo.name || 'OA')[0]}
            </div>
          )}
          <h2 className="text-2xl font-bold text-gray-900">{companyInfo.name || 'OA 工作台'}</h2>
          <p className="mt-2 text-gray-500">
            {companyInfo.description || '企业办公自动化系统，提供审批流程、公告发布、内网导航等功能。'}
          </p>
          {companyInfo.address && <p className="mt-1 text-sm text-gray-400">{companyInfo.address}</p>}
          {companyInfo.contact && <p className="text-sm text-gray-400">{companyInfo.contact}</p>}
        </div>

        {/* Quick Shortcuts */}
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

        {/* Media Carousel */}
        <div className="rounded-lg bg-white shadow-sm overflow-hidden">
          <h3 className="px-4 pt-4 text-lg font-semibold text-gray-900">公司风采</h3>
          {mediaFiles.length > 0 ? (
            <div className="relative aspect-video bg-gray-100">
              <img
                src={mediaFiles[currentSlide]?.file_path}
                alt={mediaFiles[currentSlide]?.title}
                className="w-full h-full object-contain"
              />
              {mediaFiles.length > 1 && (
                <>
                  <button
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/50"
                    onClick={() => setCurrentSlide((prev) => (prev - 1 + mediaFiles.length) % mediaFiles.length)}
                  >
                    ‹
                  </button>
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/50"
                    onClick={() => setCurrentSlide((prev) => (prev + 1) % mediaFiles.length)}
                  >
                    ›
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {mediaFiles.map((_, i) => (
                      <button
                        key={i}
                        className={`w-2 h-2 rounded-full ${i === currentSlide ? 'bg-white' : 'bg-white/50'}`}
                        onClick={() => setCurrentSlide(i)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="aspect-video bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
              暂无图片 — 管理员可在后台"媒体管理"中上传公司活动照片
            </div>
          )}
        </div>

        {/* Announcements */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">最新公告</h3>
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
                    <p className="mt-2 text-xs text-gray-400">{new Date(ann.published_at).toLocaleDateString('zh-CN')}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-white shadow-sm p-6 text-center text-gray-400 text-sm">
              暂无公告 — 管理员可在后台"公告管理"中发布公司通知
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">内网导航</h3>
          {quickLinks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {quickLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-white p-3 shadow-sm hover:shadow-md transition-shadow text-sm"
                >
                  <span>{iconMap[link.icon] || '🔗'}</span>
                  <span className="text-gray-700">{link.name}</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-white shadow-sm p-6 text-center text-gray-400 text-sm">
              暂无链接 — 管理员可在后台"公司设置"中配置内网导航
            </div>
          )}
        </div>

        {/* Personal Stats (only when authenticated) */}
        {isAuthenticated && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">我的事项</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Link to="/workflow/tasks" className="rounded-lg bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="mb-2 text-base font-semibold text-gray-900">我的待办</h4>
                <p className="text-3xl font-bold text-blue-600">{pendingTasks ?? '-'}</p>
              </Link>
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h4 className="mb-2 text-base font-semibold text-gray-900">我已办</h4>
                <p className="text-3xl font-bold text-green-600">-</p>
              </div>
              <Link to="/workflow/my" className="rounded-lg bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="mb-2 text-base font-semibold text-gray-900">我发起的</h4>
                <p className="text-3xl font-bold text-purple-600">{totalInstances ?? '-'}</p>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
