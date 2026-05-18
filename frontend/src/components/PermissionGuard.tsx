import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

interface Props {
  permission: string
  children: React.ReactNode
}

export default function PermissionGuard({ permission, children }: Props) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  if (!hasPermission(permission)) return <Navigate to="/" replace />
  return <>{children}</>
}
