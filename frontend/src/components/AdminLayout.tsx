import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/auth'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const location = useLocation()
  const hasPermission = useAuthStore((s) => s.hasPermission)

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
  ]

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-50 border-r p-4">
        <div className="text-lg font-bold mb-4">{t('admin.title')}</div>
        <nav className="space-y-1">
          <Link
            to="/"
            className="block px-3 py-2 rounded text-sm text-gray-500 hover:bg-gray-200 mb-2"
          >
            ← {t('common.backToHome')?.replace('← ', '') || t('notFound.goHome')}
          </Link>
          {navItems
            .filter((item) => hasPermission(item.permission))
            .map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`block px-3 py-2 rounded text-sm ${
                  location.pathname.startsWith(item.to)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                {item.label}
              </Link>
            ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
