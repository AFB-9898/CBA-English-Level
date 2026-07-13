import { useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../components/auth/AuthContext'
import LanguageSwitcher from '../components/atoms/LanguageSwitcher'

export default function LoginPage() {
  const { t } = useTranslation()
  const { login, logout, user, isAdmin, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // R7: If already authenticated as admin, redirect immediately
  if (!loading && user && isAdmin) {
    return <Navigate to="/admin" replace />
  }

  // Non-admin user with a session — log them out and show an error
  if (!loading && user && !isAdmin) {
    logout()
    return (
      <PageShell>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {t('loginPage.accessDenied')}
        </div>
      </PageShell>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password.trim()) {
      setError(t('loginPage.emptyFieldsError'))
      return
    }

    setSubmitting(true)
    const result = await login(email, password)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
    }
    // On success, AuthProvider updates → ProtectedRoute redirects to /admin
  }

  return (
    <PageShell>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            {t('common.email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@cba.edu.bo"
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
          {t('loginPage.dontHaveAccount')}{' '}
          <Link to="/register" className="text-blue-600 hover:underline">
            {t('loginPage.registerLink')}
          </Link>
        </p>
      </form>
    </PageShell>
  )

  function PageShell({ children }: { children: React.ReactNode }) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">{t('loginPage.title')}</h1>
              <LanguageSwitcher />
            </div>
            <p className="text-sm text-gray-500 mt-1">{t('loginPage.subtitle')}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">{children}</div>
        </div>
      </div>
    )
  }
}
