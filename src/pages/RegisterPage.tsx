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
      <aside className="cba-auth__brand-panel cba-auth__brand-panel--register" aria-label={t('authPresentation.panelLabel')}>
        <span className="cba-auth__panel-shape cba-auth__panel-shape--circle" aria-hidden="true" />
        <span className="cba-auth__panel-shape cba-auth__panel-shape--diamond" aria-hidden="true" />
        <div className="cba-auth__brand-content">
          <div className="cba-auth__mark" aria-hidden="true">{t('authPresentation.brand')}</div>
          <p className="cba-auth__brand-kicker">{t('authPresentation.organizationName')}</p>
          <CbaTarijaIdentity onDark />
          <p className="cba-auth__brand-name">{t('authPresentation.placementExam')}</p>
          <p className="cba-auth__brand-copy">{t('authPresentation.registerBrandCopy')}</p>
          <p className="cba-auth__register-message">{t('authPresentation.registerPanelMessage')}</p>
          <ul className="cba-auth__register-benefits">
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5a2.5 2.5 0 0 0-2.5-2.5H4V5.5Zm2.5-.5A.5.5 0 0 0 6 5.5V14h11.5c.9 0 1.75.24 2.5.66V5H6.5Z" /></svg>
              <span>{t('authPresentation.registerBenefits.personalized')}</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.1 16.6-4.2-4.2 1.4-1.4 2.8 2.8 8.6-8.6 1.4 1.4-10 10Z" /></svg>
              <span>{t('authPresentation.registerBenefits.immediate')}</span>
            </li>
          </ul>
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
