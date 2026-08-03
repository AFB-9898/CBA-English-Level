import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RegisterForm from '../components/organisms/RegisterForm'
import Toast from '../components/atoms/Toast'
import LanguageSwitcher from '../components/atoms/LanguageSwitcher'
import CbaTarijaIdentity from '../components/atoms/CbaTarijaIdentity'
import '../styles/cba-auth.css'

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showToast, setShowToast] = useState(false)

  function handleSuccess() {
    setShowToast(true)
    setTimeout(() => navigate('/login'), 2500)
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
    <div className="cba-auth">
      <aside className="cba-auth__brand-panel" aria-label={t('authPresentation.panelLabel')}>
        <div className="cba-auth__brand-content">
          <div className="cba-auth__mark" aria-hidden="true">{t('authPresentation.brand')}</div>
          <p className="cba-auth__brand-kicker">{t('authPresentation.organizationName')}</p>
          <CbaTarijaIdentity onDark />
          <p className="cba-auth__brand-name">{t('authPresentation.placementExam')}</p>
          <p className="cba-auth__brand-copy">{t('authPresentation.registerBrandCopy')}</p>
        </div>
      </aside>
      <main className="cba-auth__main">
        <div className="cba-auth__container">
          <div className="cba-auth__heading">
            <div>
              <p className="cba-auth__eyebrow">{t('authPresentation.organizationName')}</p>
              <CbaTarijaIdentity compact />
              <h1 className="cba-auth__title">{t('registerPage.title')}</h1>
              <p className="cba-auth__subtitle">{t('registerPage.subtitle')}</p>
            </div>
            <LanguageSwitcher />
          </div>
          <div className="cba-auth__card">{children}</div>
        </div>
      </main>
    </div>
  )
}
