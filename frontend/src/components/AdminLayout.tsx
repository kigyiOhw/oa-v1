import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

const navItems = [
  { to: '/admin/users', label: 'Users', permission: 'user:read' },
  { to: '/admin/roles', label: 'Roles', permission: 'role:read' },
  { to: '/admin/departments', label: 'Departments', permission: 'dept:read' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const hasPermission = useAuthStore((s) => s.hasPermission)

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-50 border-r p-4">
        <div className="text-lg font-bold mb-4">Admin</div>
        <nav className="space-y-1">
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
