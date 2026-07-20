import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../components/auth/AuthContext'

const navItems = [
  { key: 'dashboard', to: '/admin', icon: '📊' },
  { key: 'students', to: '/admin/students', icon: '👥' },
  { key: 'questions', to: '/admin/questions', icon: '❓' },
  { key: 'levels', to: '/admin/levels', icon: '📚' },
  { key: 'examConfiguration', to: '/admin/exam-configuration', icon: '⚙️' },
  { key: 'reports', to: '/admin/reports', icon: '📈' },
  { key: 'auditLog', to: '/admin/audit-log', icon: '📋' },
] as const

function sidebarLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
    isActive
      ? 'bg-blue-50 text-blue-700'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  ].join(' ')
}

export default function AdminLayout() {
  const { t } = useTranslation()
  const { logout, user, adminName } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function closeMobile() {
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 inset-x-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {/* Hamburger — visible only on mobile */}
              <button
                type="button"
                className="md:hidden p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                  </svg>
                )}
              </button>

              <h1 className="text-lg font-semibold text-gray-800">
                {t('adminPanel.title')}
              </h1>
            </div>

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
                {t('common.logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar + content */}
      <div className="flex pt-16">
        {/* Sidebar — fixed on desktop, overlay on mobile */}
        <aside
          className={`
            fixed top-16 bottom-0 left-0 w-60 bg-white border-r border-gray-200 z-40
            overflow-y-auto transition-transform duration-200
            md:translate-x-0
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
          data-testid="sidebar"
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.to === '/admin'}
                className={sidebarLinkClass}
                onClick={closeMobile}
              >
                <span aria-hidden="true">{item.icon}</span>
                {t(`dashboard.nav.${item.key}`)}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content — offset by sidebar width on desktop */}
        <main className="flex-1 md:ml-60 px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
