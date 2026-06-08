import { useEffect } from 'react'
import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import PermissionGuard from './components/PermissionGuard'
import ThemeSwitcher from './components/ThemeSwitcher'
import NotificationBell from './components/NotificationBell'
import { ToastContainer } from './components/ui/toast'
import { useThemeStore } from './stores/theme'
import { useAuthStore } from './stores/auth'
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
import MyAttendance from './pages/attendance/MyAttendance'
import TeamAttendance from './pages/attendance/TeamAttendance'
import SubordinateDetail from './pages/attendance/SubordinateDetail'
import AttendanceConfigPage from './pages/attendance/AttendanceConfig'
import Employees from './pages/admin/Employees'
import EmployeeDetail from './pages/admin/EmployeeDetail'
import Assets from './pages/admin/Assets'
import AssetCreate from './pages/admin/AssetCreate'
import AssetDetail from './pages/admin/AssetDetail'
import AssetCategories from './pages/admin/AssetCategories'
import Consumables from './pages/admin/Consumables'
import ConsumableDetail from './pages/admin/ConsumableDetail'
import NotificationsPage from './pages/notifications/NotificationsPage'
import ContactsPage from './pages/contacts/ContactsPage'
import MyExpenses from './pages/expenses/MyExpenses'
import ExpenseCreate from './pages/expenses/ExpenseCreate'
import ExpenseDetail from './pages/expenses/ExpenseDetail'
import MyOvertimes from './pages/overtimes/MyOvertimes'
import OvertimeCreate from './pages/overtimes/OvertimeCreate'
import OvertimeDetail from './pages/overtimes/OvertimeDetail'
import AuditLogs from './pages/admin/AuditLogs'
import MessagesPage from './pages/messages/MessagesPage'
import MessageDetail from './pages/messages/MessageDetail'
import MessageCompose from './pages/messages/MessageCompose'

function App() {
  const { mode, color, gradient, imageUrl, darkMode } = useThemeStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const isDefaultBg = mode === 'color' && color === '#f9fafb'

  const bgStyle: React.CSSProperties =
    isDefaultBg
      ? {}
      : mode === 'color'
        ? { backgroundColor: color }
        : mode === 'gradient'
          ? { backgroundImage: gradient }
          : imageUrl
            ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
            : {}

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground" style={bgStyle}>
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
            <Route
              path="attendance-config"
              element={
                <PermissionGuard permission="attendance:update">
                  <AttendanceConfigPage />
                </PermissionGuard>
              }
            />
            <Route
              path="audit-logs"
              element={
                <PermissionGuard permission="audit:read">
                  <AuditLogs />
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

          <Route path="/attendance" element={<ProtectedRoute><MyAttendance /></ProtectedRoute>} />
          <Route path="/attendance/team" element={<ProtectedRoute><TeamAttendance /></ProtectedRoute>} />
          <Route path="/attendance/team/:userId" element={<ProtectedRoute><SubordinateDetail /></ProtectedRoute>} />

          <Route path="/expenses" element={<ProtectedRoute><MyExpenses /></ProtectedRoute>} />
          <Route path="/expenses/new" element={<ProtectedRoute><ExpenseCreate /></ProtectedRoute>} />
          <Route path="/expenses/:id" element={<ProtectedRoute><ExpenseDetail /></ProtectedRoute>} />
          <Route path="/expenses/:id/edit" element={<ProtectedRoute><ExpenseCreate /></ProtectedRoute>} />

          <Route path="/overtimes" element={<ProtectedRoute><MyOvertimes /></ProtectedRoute>} />
          <Route path="/overtimes/new" element={<ProtectedRoute><OvertimeCreate /></ProtectedRoute>} />
          <Route path="/overtimes/:id" element={<ProtectedRoute><OvertimeDetail /></ProtectedRoute>} />
          <Route path="/overtimes/:id/edit" element={<ProtectedRoute><OvertimeCreate /></ProtectedRoute>} />

          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />

          <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
          <Route path="/messages/new" element={<ProtectedRoute><MessageCompose /></ProtectedRoute>} />
          <Route path="/messages/:id" element={<ProtectedRoute><MessageDetail /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        <ThemeSwitcher />
        {isAuthenticated && <NotificationBell />}
        <ToastContainer />
      </div>
    </ErrorBoundary>
  )
}

export default App
