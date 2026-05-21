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
import WorkflowDefs from './pages/admin/WorkflowDefs'
import Announcements from './pages/admin/Announcements'
import MediaAdmin from './pages/admin/Media'
import CompanySettings from './pages/admin/CompanySettings'
import MyInstances from './pages/workflow/MyInstances'
import InstanceDetail from './pages/workflow/InstanceDetail'
import MyTasks from './pages/workflow/MyTasks'
import TaskDetail from './pages/workflow/TaskDetail'

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
            <Route
              path="workflow-defs"
              element={
                <PermissionGuard permission="workflow_def:read">
                  <WorkflowDefs />
                </PermissionGuard>
              }
            />
            <Route
              path="announcements"
              element={
                <PermissionGuard permission="announcement:read">
                  <Announcements />
                </PermissionGuard>
              }
            />
            <Route
              path="media"
              element={
                <PermissionGuard permission="media:read">
                  <MediaAdmin />
                </PermissionGuard>
              }
            />
            <Route
              path="settings"
              element={
                <PermissionGuard permission="announcement:update">
                  <CompanySettings />
                </PermissionGuard>
              }
            />
          </Route>

          <Route path="/workflow/my" element={<ProtectedRoute><MyInstances /></ProtectedRoute>} />
          <Route path="/workflow/instances/:id" element={<ProtectedRoute><InstanceDetail /></ProtectedRoute>} />
          <Route path="/workflow/tasks" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
          <Route path="/workflow/tasks/:id" element={<ProtectedRoute><TaskDetail /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}

export default App
