import { useTranslation } from 'react-i18next'

const languages = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
] as const

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const current = i18n.language?.startsWith('es') ? 'es' : 'en'

  function toggle() {
    const next = current === 'es' ? 'en' : 'es'
    i18n.changeLanguage(next)
  }

  return (
    <button
      onClick={toggle}
      className="cba-language-switcher text-sm text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
      title={current === 'es' ? t('authPresentation.switchToEnglish') : t('authPresentation.switchToSpanish')}
    >
      {languages.find((l) => l.code === current)?.label ?? 'EN'}
    </button>
  )
}
