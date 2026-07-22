import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RegisterForm from '../components/organisms/RegisterForm'
import Toast from '../components/atoms/Toast'
import LanguageSwitcher from '../components/atoms/LanguageSwitcher'

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showToast, setShowToast] = useState(false)

  function handleSuccess() {
    setShowToast(true)
    setTimeout(() => navigate('/student/login'), 2500)
  }

  return (
    <PageShell>
      {showToast && (
        <Toast message={t('registerPage.successMessage')} onClose={() => setShowToast(false)} />
      )}

      <RegisterForm onSuccess={handleSuccess} />
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">{t('registerPage.title')}</h1>
            <LanguageSwitcher />
          </div>
          <p className="text-sm text-gray-500 mt-1">{t('registerPage.subtitle')}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">{children}</div>
      </div>
    </div>
  )
}
