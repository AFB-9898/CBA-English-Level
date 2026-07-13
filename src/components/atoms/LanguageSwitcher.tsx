import { useTranslation } from 'react-i18next'

const languages = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
] as const

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  function toggle() {
    const next = i18n.language === 'es' ? 'en' : 'es'
    i18n.changeLanguage(next)
  }

  const current = i18n.language?.startsWith('es') ? 'es' : 'en'

  return (
    <button
      onClick={toggle}
      className="text-sm text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
      title={current === 'es' ? 'Switch to English' : 'Cambiar a Español'}
    >
      {languages.find((l) => l.code === current)?.label ?? 'EN'}
    </button>
  )
}
