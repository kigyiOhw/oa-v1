import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Users, Shield, Building2, GitBranch, Megaphone,
  Image, FolderTree, Laptop, Box, Clock, FileText, Settings,
  ChevronLeft, ChevronRight, Tag,
} from 'lucide-react'
import { useAuthStore } from '../stores/auth'

const COLLAPSED_KEY = 'admin_sidebar_collapsed'

const navIconMap: Record<string, React.ReactNode> = {
  '/admin/users': <Users size={18} />,
  '/admin/roles': <Shield size={18} />,
  '/admin/departments': <Building2 size={18} />,
  '/admin/workflow-defs': <GitBranch size={18} />,
  '/admin/announcements': <Megaphone size={18} />,
  '/admin/media': <Image size={18} />,
  '/admin/employees': <Users size={18} />,
  '/admin/asset-categories': <FolderTree size={18} />,
  '/admin/assets': <Laptop size={18} />,
  '/admin/consumables': <Box size={18} />,
  '/admin/attendance-config': <Clock size={18} />,
  '/admin/audit-logs': <FileText size={18} />,
  '/admin/settings': <Settings size={18} />,
  '/admin/request-types': <Tag size={18} />,
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const location = useLocation()
  const hasPermission = useAuthStore((s) => s.hasPermission)

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(COLLAPSED_KEY, String(next)) } catch { /* noop */ }
      return next
    })
  }

  const navItems = [
    { to: '/admin/users', label: t('admin.users'), permission: 'user:read' },
    { to: '/admin/roles', label: t('admin.roles'), permission: 'role:read' },
    { to: '/admin/departments', label: t('admin.departments'), permission: 'dept:read' },
    { to: '/admin/workflow-defs', label: t('admin.workflowDefs'), permission: 'workflow_def:read' },
    { to: '/admin/announcements', label: t('admin.announcements'), permission: 'announcement:read' },
    { to: '/admin/media', label: t('admin.media'), permission: 'media:read' },
    { to: '/admin/employees', label: t('admin.employees'), permission: 'employee:read' },
    { to: '/admin/asset-categories', label: t('asset.categories'), permission: 'asset:read' },
    { to: '/admin/assets', label: t('asset.title'), permission: 'asset:read' },
    { to: '/admin/consumables', label: t('consumable.title'), permission: 'consumable:read' },
    { to: '/admin/attendance-config', label: t('attendance.config'), permission: 'attendance:update' },
    { to: '/admin/audit-logs', label: t('admin.auditLogs'), permission: 'audit:read' },
    { to: '/admin/settings', label: t('admin.settings'), permission: 'announcement:update' },
    { to: '/admin/request-types', label: t('admin.requestTypes'), permission: 'announcement:update' },
  ]

  return (
    <div className="min-h-screen flex">
      <aside
        className={`flex flex-col bg-slate-900 border-r border-slate-700 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-slate-700">
          {!collapsed && (
            <span className="text-sm font-bold text-white truncate">{t('admin.title')}</span>
          )}
          <button
            onClick={toggleCollapse}
            className="ml-auto text-slate-400 hover:text-white transition-colors shrink-0"
            title={collapsed ? t('common.expand') : t('common.collapse')}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Back to Home */}
        <Link
          to="/"
          className={`flex items-center gap-2 mx-2 mt-2 px-3 py-2 rounded text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <ArrowLeft size={16} />
          {!collapsed && (
            <span>{t('common.backToHome')?.replace('← ', '') || t('notFound.goHome')}</span>
          )}
        </Link>

        {/* Nav items */}
        <nav className="flex-1 mx-2 mt-2 space-y-0.5 overflow-auto">
          {navItems
            .filter((item) => hasPermission(item.permission))
            .map((item) => {
              const isActive = location.pathname.startsWith(item.to)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                    collapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="shrink-0">{navIconMap[item.to]}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto bg-background">{children}</main>
    </div>
  )
}
