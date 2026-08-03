import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import CbaTarijaIdentity from '../atoms/CbaTarijaIdentity'
import LanguageSwitcher from '../atoms/LanguageSwitcher'
import '../../styles/cba-student.css'

export default function StudentNavigation() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const { pathname } = useLocation()
  const isDashboard = pathname === '/student'
  const isHistory = pathname.startsWith('/student/history')

  return <header className="cba-student__header"><div className="cba-student__header-content"><Link to="/student" className="cba-student__brand" aria-label={t('authPresentation.localIdentity.label')}><span className="cba-student__mark" aria-hidden="true">{t('authPresentation.brand')}</span><CbaTarijaIdentity compact onDark /></Link><nav className="cba-student__nav" aria-label={t('studentNavigation.label')}><Link to="/student" className={`cba-student__nav-link${isDashboard ? ' cba-student__nav-link--active' : ''}`} aria-current={isDashboard ? 'page' : undefined}>{t('studentNavigation.dashboard')}</Link><Link to="/student/history" className={`cba-student__nav-link${isHistory ? ' cba-student__nav-link--active' : ''}`} aria-current={isHistory ? 'page' : undefined}>{t('studentNavigation.history')}</Link></nav><div className="cba-student__actions"><LanguageSwitcher /><button type="button" onClick={() => void logout()} className="cba-student__logout">{t('common.logout')}</button></div></div></header>
}
