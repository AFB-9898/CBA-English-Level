import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { AdminCapability, PrincipalRole } from '../../types/auth'

export default function ProtectedRoute({ requiredRole, capability }: { requiredRole?: PrincipalRole; capability?: AdminCapability }) {
  const { user, role, loading, hasCapability } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div role="status" className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user || !role) {
    return <Navigate to="/login" replace />
  }

  const roleDenied = requiredRole && !(requiredRole === 'admin' ? role === 'admin' || role === 'master_admin' : role === requiredRole)
  if (roleDenied || (capability && !hasCapability(capability))) {
    return <Navigate to={role === 'admin' || role === 'master_admin' ? '/admin' : '/student'} replace />
  }

  return <Outlet />
}
