import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import PermissionGuard from './components/PermissionGuard'
import ThemeSwitcher from './components/ThemeSwitcher'
import { useThemeStore } from './stores/theme'
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
import MyLeaves from './pages/leaves/MyLeaves'
import LeaveCreate from './pages/leaves/LeaveCreate'
import LeaveDetail from './pages/leaves/LeaveDetail'
import MyProfile from './pages/employee/MyProfile'
import MyAssets from './pages/employee/MyAssets'
import Employees from './pages/admin/Employees'
import EmployeeDetail from './pages/admin/EmployeeDetail'
import Assets from './pages/admin/Assets'
import AssetCreate from './pages/admin/AssetCreate'
import AssetDetail from './pages/admin/AssetDetail'
import AssetCategories from './pages/admin/AssetCategories'
import Consumables from './pages/admin/Consumables'
import ConsumableDetail from './pages/admin/ConsumableDetail'

function App() {
  const { mode, color, gradient, imageUrl } = useThemeStore()

  const bgStyle: React.CSSProperties =
    mode === 'color'
      ? { backgroundColor: color }
      : mode === 'gradient'
        ? { backgroundImage: gradient }
        : imageUrl
          ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
          : { backgroundColor: '#f9fafb' }

  return (
    <ErrorBoundary>
      <div className="min-h-screen" style={bgStyle}>
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
              path="employees"
              element={
                <PermissionGuard permission="employee:read">
                  <Employees />
                </PermissionGuard>
              }
            />
            <Route
              path="employees/:id"
              element={
                <PermissionGuard permission="employee:read">
                  <EmployeeDetail />
                </PermissionGuard>
              }
            />
            <Route
              path="asset-categories"
              element={
                <PermissionGuard permission="asset:read">
                  <AssetCategories />
                </PermissionGuard>
              }
            />
            <Route
              path="assets"
              element={
                <PermissionGuard permission="asset:read">
                  <Assets />
                </PermissionGuard>
              }
            />
            <Route
              path="assets/new"
              element={
                <PermissionGuard permission="asset:create">
                  <AssetCreate />
                </PermissionGuard>
              }
            />
            <Route
              path="assets/:id"
              element={
                <PermissionGuard permission="asset:read">
                  <AssetDetail />
                </PermissionGuard>
              }
            />
            <Route
              path="assets/:id/edit"
              element={
                <PermissionGuard permission="asset:update">
                  <AssetCreate />
                </PermissionGuard>
              }
            />
            <Route
              path="consumables"
              element={
                <PermissionGuard permission="consumable:read">
                  <Consumables />
                </PermissionGuard>
              }
            />
            <Route
              path="consumables/new"
              element={
                <PermissionGuard permission="consumable:create">
                  <ConsumableDetail />
                </PermissionGuard>
              }
            />
            <Route
              path="consumables/:id"
              element={
                <PermissionGuard permission="consumable:read">
                  <ConsumableDetail />
                </PermissionGuard>
              }
            />
            <Route
              path="consumables/:id/edit"
              element={
                <PermissionGuard permission="consumable:update">
                  <ConsumableDetail />
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

          <Route path="/profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />

          <Route path="/my-assets" element={<ProtectedRoute><MyAssets /></ProtectedRoute>} />
          <Route path="/leaves" element={<ProtectedRoute><MyLeaves /></ProtectedRoute>} />
          <Route path="/leaves/new" element={<ProtectedRoute><LeaveCreate /></ProtectedRoute>} />
          <Route path="/leaves/:id" element={<ProtectedRoute><LeaveDetail /></ProtectedRoute>} />
          <Route path="/leaves/:id/edit" element={<ProtectedRoute><LeaveCreate /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        <ThemeSwitcher />
      </div>
    </ErrorBoundary>
  )
}

export default App
