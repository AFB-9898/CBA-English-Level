import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../components/auth/AuthContext'
import type { AdminCapability } from '../types/auth'
import CbaTarijaIdentity from '../components/atoms/CbaTarijaIdentity'
import LanguageSwitcher from '../components/atoms/LanguageSwitcher'
import '../styles/cba-admin.css'

type AdminNavItem = {
  key: string
  to: string
  icon: string
  capability?: AdminCapability
}

const navItems: AdminNavItem[] = [
  { key: 'dashboard', to: '/admin', icon: '📊' },
  { key: 'students', to: '/admin/students', icon: '👥' },
  { key: 'administrators', to: '/admin/administrators', icon: '🛡️', capability: 'administrator_management' },
  { key: 'questions', to: '/admin/questions', icon: '❓' },
  { key: 'levels', to: '/admin/levels', icon: '📚' },
  { key: 'examConfiguration', to: '/admin/exam-configuration', icon: '⚙️' },
  { key: 'reports', to: '/admin/reports', icon: '📈' },
  { key: 'auditLog', to: '/admin/audit-log', icon: '📋' },
]

function sidebarLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
    isActive
      ? 'cba-admin__nav-link cba-admin__nav-link--active'
      : 'cba-admin__nav-link',
  ].join(' ')
}

export default function AdminLayout() {
  const { t } = useTranslation()
  const { logout, user, adminName, hasCapability } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia?.('(min-width: 768px)').matches ?? false)
  const [logoutError, setLogoutError] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(min-width: 768px)')
    if (!mediaQuery) return

    const updateViewport = () => setIsDesktop(mediaQuery.matches)
    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)
    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [])

  async function handleLogout() {
    setLogoutError(false)
    setLoggingOut(true)

    try {
      await logout()
      navigate('/login', { replace: true })
    } catch {
      setLogoutError(true)
    } finally {
      setLoggingOut(false)
    }
  }

  function closeMobile() {
    setMobileOpen(false)
  }

  return (
    <div className="cba-admin">
      {/* Header */}
      <header className="cba-admin__header fixed top-0 inset-x-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {/* Hamburger — visible only on mobile */}
              <button
                type="button"
                className="cba-admin__menu-button md:hidden p-1.5 rounded-md"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label={mobileOpen ? t('common.closeMenu') : t('common.openMenu')}
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

              <div>
                <h1 className="cba-admin__title">
                  {t('adminPanel.title')}
                </h1>
                <CbaTarijaIdentity compact onDark />
              </div>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <span className="cba-admin__user text-sm hidden sm:inline">
                  {adminName || user.email}
                </span>
              )}
              <LanguageSwitcher />
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="cba-admin__logout text-sm transition-colors"
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
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          data-testid="mobile-menu-backdrop"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar + content */}
      <div className="flex pt-16">
        {/* Sidebar — fixed on desktop, overlay on mobile */}
        <aside
          className={`
            cba-admin__sidebar fixed top-16 bottom-0 left-0 w-60 z-40
            overflow-y-auto transition-transform duration-200
            md:translate-x-0
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
          data-testid="sidebar"
          inert={!isDesktop && !mobileOpen ? true : undefined}
        >
          <nav className="cba-admin__navigation space-y-1" aria-label={t('adminPanel.title')}>
            {navItems.filter((item) => !item.capability || hasCapability(item.capability)).map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.to === '/admin'}
                className={sidebarLinkClass}
                onClick={closeMobile}
              >
                <span className="cba-admin__nav-icon" aria-hidden="true">{item.icon}</span>
                {t(`dashboard.nav.${item.key}`)}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content — offset by sidebar width on desktop */}
        <main className="cba-admin__content flex-1 md:ml-60 mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {logoutError && (
            <div role="alert" className="cba-admin__alert cba-admin__alert--error mb-6 flex items-center justify-between gap-4 rounded-lg p-4 text-sm">
              <span>{t('common.logoutFailed')}</span>
              <button type="button" onClick={handleLogout} disabled={loggingOut} className="cba-admin__action cba-admin__action--danger shrink-0">
                {t('common.retry')}
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
