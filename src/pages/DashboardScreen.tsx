import { useTranslation } from 'react-i18next'
import { useDashboardStats } from '../hooks/useDashboardStats'
import StatCard from '../components/molecules/StatCard'
import LevelBar from '../components/molecules/LevelBar'
import RecentExamsTable from '../components/molecules/RecentExamsTable'

export default function DashboardScreen() {
  const { t } = useTranslation()
  const { stats, distribution, recentExams, loading, error } = useDashboardStats()

  if (error) {
    return (
      <div className="cba-dashboard__error rounded-lg p-5" role="alert">
        <p className="font-bold">{t('dashboard.error')}</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="cba-dashboard space-y-6">
      <header className="cba-dashboard__hero">
        <div>
          <p className="cba-dashboard__eyebrow">CBA Tarija</p>
          <h2 className="cba-dashboard__title">{t('dashboard.nav.dashboard')}</h2>
        </div>
        <div className="cba-dashboard__rule" aria-hidden="true" />
      </header>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('dashboard.stats.totalStudents')}
          value={stats.totalStudents}
          icon="👥"
          loading={loading}
        />
        <StatCard
          label={t('dashboard.stats.totalExams')}
          value={stats.totalExams}
          icon="📝"
          loading={loading}
        />
        <StatCard
          label={t('dashboard.stats.examsToday')}
          value={stats.examsToday}
          icon="📅"
          loading={loading}
        />
        <StatCard
          label={t('dashboard.stats.avgScore')}
          value={stats.avgScore}
          icon="🎯"
          loading={loading}
        />
      </div>

      {/* Level Distribution */}
      <LevelBar levels={distribution} loading={loading} />

      {/* Recent Exams Table */}
      <RecentExamsTable exams={recentExams} loading={loading} />
    </div>
  )
}
