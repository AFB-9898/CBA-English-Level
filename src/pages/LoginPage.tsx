import { useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../components/auth/AuthContext'
import LanguageSwitcher from '../components/atoms/LanguageSwitcher'
import '../styles/cba-auth.css'

function PageShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className="cba-auth">
      <aside className="cba-auth__brand-panel" aria-label={t('authPresentation.panelLabel')}>
        <div className="cba-auth__brand-content">
          <div className="cba-auth__mark" aria-hidden="true">{t('authPresentation.brand')}</div>
          <p className="cba-auth__brand-kicker">{t('authPresentation.organizationName')}</p>
          <p className="cba-auth__brand-name">{t('authPresentation.placementExam')}</p>
          <p className="cba-auth__brand-copy">{t('authPresentation.loginBrandCopy')}</p>
        </div>
      </aside>
      <main className="cba-auth__main">
        <div className="cba-auth__container">
          <div className="cba-auth__heading">
            <div>
              <p className="cba-auth__eyebrow">{t('authPresentation.organizationName')}</p>
              <h1 className="cba-auth__title">{t('loginPage.title')}</h1>
              <p className="cba-auth__subtitle">{t('loginPage.subtitle')}</p>
            </div>
            <LanguageSwitcher />
          </div>
          <div className="cba-auth__card">{children}</div>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  const { t } = useTranslation()
  const { login, user, role, loading, principalError, retryPrincipal } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  if (!loading && user && role) {
    return <Navigate to={role === 'admin' ? '/admin' : '/student'} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password.trim()) {
      setError(t('loginPage.emptyFieldsError'))
      return
    }

    setSubmitting(true)
    const result = await login(email, password).catch(() => ({ error: t('auth.signInFailed') }))
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
    }
    // AuthProvider redirects only after the database resolves the principal role.
  }

  return (
    <PageShell>
      <form onSubmit={handleSubmit} className="cba-auth__form">
        {principalError && (
          <div className="cba-auth__alert" role="alert">
            <p>{principalError}</p>
            <button
              type="button"
              onClick={() => void retryPrincipal()}
              disabled={loading}
              className="cba-auth__alert-button mt-2 disabled:opacity-50"
            >
              {t('common.retry')}
            </button>
          </div>
        )}
        <div className="cba-auth__field">
            <label htmlFor="email" className="cba-auth__label">
            {t('common.email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('authPresentation.loginEmailPlaceholder')}
            className="cba-auth__input"
            disabled={submitting}
            autoComplete="email"
          />
        </div>

        <div className="cba-auth__field">
            <label htmlFor="password" className="cba-auth__label">
            {t('common.password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('authPresentation.passwordPlaceholder')}
            className="cba-auth__input"
            disabled={submitting}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="cba-auth__alert" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || loading}
          className="cba-auth__button"
        >
          {submitting ? t('common.signingIn') : t('common.signIn')}
        </button>

        <p className="cba-auth__footer">
          {t('loginPage.dontHaveAccount')}{' '}
          <Link to="/register" className="cba-auth__link">
            {t('loginPage.registerLink')}
          </Link>
        </p>
      </form>
    </PageShell>
  )
}
