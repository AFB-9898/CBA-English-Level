import type { LevelDistributionItem } from '../../types'
import { useTranslation } from 'react-i18next'

interface LevelBarProps {
  levels: LevelDistributionItem[]
  loading: boolean
}

const barColors = [
  'bg-blue-600',
  'bg-cyan-600',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-600',
  'bg-indigo-600',
  'bg-teal-600',
]

export default function LevelBar({ levels, loading }: LevelBarProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="cba-dashboard__panel" aria-busy="true">
        <div className="h-5 bg-gray-200 rounded w-40 mb-4 animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse space-y-1">
              <div className="h-3 bg-gray-200 rounded w-20" />
              <div className="h-6 bg-gray-200 rounded w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (levels.length === 0) {
    return (
      <div className="cba-dashboard__panel">
        <h3 className="cba-dashboard__panel-title text-sm mb-3">{t('dashboard.distribution.title')}</h3>
        <p className="cba-admin__muted-text text-sm">{t('dashboard.distribution.empty')}</p>
      </div>
    )
  }

  return (
    <div className="cba-dashboard__panel">
      <h3 className="cba-dashboard__panel-title text-sm mb-4">{t('dashboard.distribution.title')}</h3>
      <div className="space-y-3">
        {levels.map((lvl, i) => (
          <div key={lvl.level_id}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">{lvl.name}</span>
              <span className="text-gray-500">
                {lvl.count} ({lvl.percentage}%)
              </span>
            </div>
            <div className="cba-dashboard__bar-track w-full rounded-full h-5">
              <div
                className={`cba-dashboard__bar h-5 rounded-full ${barColors[i % barColors.length]} transition-all duration-300`}
                style={{ width: `${lvl.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
