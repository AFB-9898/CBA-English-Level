import { useTranslation } from 'react-i18next'
import type { ExamStatus, RecentExam } from '../../types'

interface RecentExamsTableProps {
  exams: RecentExam[]
  loading: boolean
}

function StatusBadge({ status }: { status: ExamStatus }) {
  const { t } = useTranslation()
  const styles: Record<ExamStatus, string> = {
    completed: 'cba-dashboard__status--completed',
    in_progress: 'cba-dashboard__status--in-progress',
    pending: 'cba-dashboard__status--pending',
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? styles.pending}`}
    >
      {t(`reports.status.${status === 'in_progress' ? 'inProgress' : status}`)}
    </span>
  )
}

export default function RecentExamsTable({ exams, loading }: RecentExamsTableProps) {
  const { t, i18n } = useTranslation()
  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, { dateStyle: 'medium' })

  if (loading) {
    return (
      <div className="cba-dashboard__panel" aria-busy="true">
        <div className="h-5 bg-gray-200 rounded w-36 mb-4 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (exams.length === 0) {
    return (
      <div className="cba-dashboard__panel">
        <h3 className="cba-dashboard__panel-title text-sm mb-3">{t('dashboard.recentExams.title')}</h3>
        <p className="cba-admin__muted-text text-sm">{t('dashboard.recentExams.empty')}</p>
      </div>
    )
  }

  return (
    <div className="cba-dashboard__panel overflow-x-auto">
      <h3 className="cba-dashboard__panel-title text-sm mb-4">{t('dashboard.recentExams.title')}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="pb-2 font-medium">{t('dashboard.recentExams.student')}</th>
            <th className="pb-2 font-medium">{t('dashboard.recentExams.score')}</th>
            <th className="pb-2 font-medium">{t('dashboard.recentExams.level')}</th>
            <th className="pb-2 font-medium">{t('dashboard.recentExams.status')}</th>
            <th className="pb-2 font-medium">{t('dashboard.recentExams.date')}</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((exam) => (
            <tr key={exam.id} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 text-gray-900">{exam.student?.full_name ?? '—'}</td>
              <td className="py-2.5 text-gray-700">{exam.score ?? '—'}</td>
              <td className="py-2.5 text-gray-700">{exam.level?.name ?? '—'}</td>
              <td className="py-2.5">
                <StatusBadge status={exam.status} />
              </td>
              <td className="py-2.5 text-gray-500">
                {exam.completed_at
                  ? dateFormatter.format(new Date(exam.completed_at))
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
