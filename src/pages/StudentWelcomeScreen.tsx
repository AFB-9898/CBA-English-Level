import { useTranslation } from 'react-i18next'
import { useAuth } from '../components/auth/AuthContext'
import LanguageSwitcher from '../components/atoms/LanguageSwitcher'

export default function StudentWelcomeScreen() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <section className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('studentWelcome.title')}</h1>
            <p className="mt-2 text-gray-600">{t('studentWelcome.subtitle')}</p>
          </div>
          <LanguageSwitcher />
        </div>
        <div className="mt-6 rounded-md bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">{t('studentWelcome.accessStatus')}</p>
          <p className="mt-1">{user?.email}</p>
          <p className="mt-3">{t('studentWelcome.accessMessage')}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-6 w-full rounded-md bg-gray-800 px-4 py-2 text-white transition-colors hover:bg-gray-900"
        >
          {t('common.logout')}
        </button>
      </section>
    </main>
  )
}
