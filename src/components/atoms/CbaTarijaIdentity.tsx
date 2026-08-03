import { useTranslation } from 'react-i18next'
import '../../styles/cba-local-identity.css'

interface CbaTarijaIdentityProps {
  compact?: boolean
  onDark?: boolean
}

export default function CbaTarijaIdentity({ compact = false, onDark = false }: CbaTarijaIdentityProps) {
  const { t } = useTranslation()

  return (
    <div
      className={`cba-local-identity${compact ? ' cba-local-identity--compact' : ''}${onDark ? ' cba-local-identity--on-dark' : ''}`}
      role="img"
      aria-label={t('authPresentation.localIdentity.label')}
    >
      <span className="cba-local-identity__name">{t('authPresentation.localIdentity.name')}</span>
      <span className="cba-local-identity__flags" aria-hidden="true">
        <span className="cba-local-identity__flag cba-local-identity__flag--bolivia" />
        <span className="cba-local-identity__flag cba-local-identity__flag--tarija" />
      </span>
    </div>
  )
}
