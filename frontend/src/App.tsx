import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import PermissionGuard from './components/PermissionGuard'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'
import Users from './pages/admin/Users'
import Roles from './pages/admin/Roles'
import Departments from './pages/admin/Departments'

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <Outlet />
                </AdminLayout>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/users" replace />} />
            <Route
              path="users"
              element={
                <PermissionGuard permission="user:read">
                  <Users />
                </PermissionGuard>
              }
            />
            <Route
              path="roles"
              element={
                <PermissionGuard permission="role:read">
                  <Roles />
                </PermissionGuard>
              }
            />
            <Route
              path="departments"
              element={
                <PermissionGuard permission="dept:read">
                  <Departments />
                </PermissionGuard>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}

export default App
