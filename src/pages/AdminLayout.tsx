import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/auth/AuthContext'

export default function AdminLayout() {
  const { logout, user, adminName } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-lg font-semibold text-gray-800">
              CBA — Admin Panel
            </h1>

            <div className="flex items-center gap-4">
              {user && (
                <span className="text-sm text-gray-500 hidden sm:inline">
                  {adminName || user.email}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-red-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
