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
      <div className="text-center py-12">
        <p className="text-red-600 font-medium">{t('dashboard.error')}</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
