import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { PrincipalRole } from '../../types/auth'

export default function ProtectedRoute({ requiredRole }: { requiredRole: PrincipalRole }) {
  const { user, role, loading } = useAuth()

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

  if (role !== requiredRole) {
    return <Navigate to={role === 'admin' ? '/admin' : '/student'} replace />
  }

  return <Outlet />
}
