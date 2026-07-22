import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../components/auth/AuthContext'
import LanguageSwitcher from '../components/atoms/LanguageSwitcher'

type LoginPageProps = {
  requiredRole?: 'admin' | 'student'
}

function PageShell({ children, prefix }: { children: React.ReactNode; prefix: string }) {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">{t(`${prefix}.title`)}</h1>
            <LanguageSwitcher />
          </div>
          <p className="text-sm text-gray-500 mt-1">{t(`${prefix}.subtitle`)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">{children}</div>
      </div>
    </div>
  )
}

export default function LoginPage({ requiredRole = 'admin' }: LoginPageProps) {
  const { t } = useTranslation()
  const { login, logout, user, role, loading, principalError, retryPrincipal } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deniedRole, setDeniedRole] = useState(false)
  const prefix = requiredRole === 'admin' ? 'loginPage' : 'studentLoginPage'
  const destination = requiredRole === 'admin' ? '/admin' : '/student'

  useEffect(() => {
    if (!loading && user && role && role !== requiredRole) {
      setDeniedRole(true)
      void logout()
    }
  }, [loading, logout, requiredRole, role, user])

  if (!loading && user && role === requiredRole) {
    return <Navigate to={destination} replace />
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
    <PageShell prefix={prefix}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {deniedRole && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm" role="alert">
            {t(`${prefix}.accessDenied`)}
          </div>
        )}
        {principalError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm" role="alert">
            <p>{principalError}</p>
            <button
              type="button"
              onClick={() => void retryPrincipal()}
              disabled={loading}
              className="mt-2 text-blue-600 hover:underline disabled:opacity-50"
            >
              {t('common.retry')}
            </button>
          </div>
        )}
        <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            {t('common.email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={requiredRole === 'admin' ? 'admin@cba.edu.bo' : 'student@cba.edu.bo'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={submitting}
            autoComplete="email"
          />
        </div>

        <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            {t('common.password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={submitting}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? t('common.signingIn') : t('common.signIn')}
        </button>

        <p className="text-sm text-center text-gray-500 mt-4">
          {t(`${prefix}.dontHaveAccount`)}{' '}
          <Link to="/register" className="text-blue-600 hover:underline">
            {t(`${prefix}.registerLink`)}
          </Link>
        </p>
      </form>
    </PageShell>
  )
}
