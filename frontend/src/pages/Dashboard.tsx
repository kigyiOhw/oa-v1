import { Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">OA 工作台</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.full_name || user?.username}
            </span>
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">我的待办</h2>
            <p className="text-3xl font-bold text-blue-600">0</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">我已办</h2>
            <p className="text-3xl font-bold text-green-600">0</p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-gray-900">我发起的</h2>
            <p className="text-3xl font-bold text-purple-600">0</p>
          </div>
        </div>
      </main>
    </div>
  )
}
