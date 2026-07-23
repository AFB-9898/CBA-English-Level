import { useTranslation } from 'react-i18next'
import { useAuth } from '../components/auth/AuthContext'
import LanguageSwitcher from '../components/atoms/LanguageSwitcher'
import { useStudentDashboard } from '../hooks/useStudentDashboard'
import { useStartExam } from '../hooks/useStartExam'
import { useNavigate } from 'react-router-dom'

export default function StudentWelcomeScreen() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const { dashboard, loading, error, refetch } = useStudentDashboard()
  const { start, starting, error: startError } = useStartExam()
  const navigate = useNavigate()

  async function beginExam() {
    const attempt = await start()
    if (attempt) navigate(`/student/exam/${attempt.attempt_id}`)
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <section className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('studentDashboard.title')}</h1>
            <p className="mt-2 text-gray-600">{t('studentDashboard.subtitle')}</p>
          </div>
          <LanguageSwitcher />
        </div>

        {loading && <div aria-busy="true" className="mt-6 h-40 animate-pulse rounded-md bg-gray-100" />}
        {error && <div role="alert" className="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-800"><p>{t('studentDashboard.errors.loadFailed')}</p><button type="button" onClick={refetch} className="mt-3 rounded border border-red-300 px-3 py-1.5 font-medium">{t('common.retry')}</button></div>}
        {!loading && !error && !dashboard && <div className="mt-6 rounded-md bg-gray-100 p-4 text-sm text-gray-700">{t('studentDashboard.empty')}</div>}
        {!loading && !error && dashboard && <div className="mt-6 space-y-4">
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-900"><p className="font-medium">{dashboard.student_full_name}</p><p className="mt-1">{t(`studentDashboard.states.${dashboard.exam_state}`)}</p></div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">{t('studentDashboard.attempts')}</dt><dd className="font-medium text-gray-900">{dashboard.attempt_count}</dd></div>
            <div><dt className="text-gray-500">{t('studentDashboard.assignedLevel')}</dt><dd className="font-medium text-gray-900">{dashboard.assigned_level_code ? `${dashboard.assigned_level_code} - ${dashboard.assigned_level_name} (v${dashboard.assigned_level_version})` : t('studentDashboard.noResult')}</dd></div>
            <div><dt className="text-gray-500">{t('studentDashboard.latestResult')}</dt><dd className="font-medium text-gray-900">{dashboard.latest_result_score ?? t('studentDashboard.noResult')}</dd></div>
          </dl>
          {startError && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{t('studentDashboard.errors.startFailed')} <button type="button" onClick={() => void beginExam()} className="font-medium underline">{t('common.retry')}</button></div>}
          <button type="button" onClick={() => void beginExam()} disabled={starting || dashboard.exam_state === 'completed'} className="w-full rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400">
            {starting ? t('studentDashboard.starting') : dashboard.exam_state === 'in_progress' ? t('studentDashboard.resumeExam') : t('studentDashboard.startExam')}
          </button>
          {dashboard.exam_state === 'completed' && <p className="text-center text-sm text-gray-600">{t('studentDashboard.completedExplanation')}</p>}
        </div>}
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-6 w-full rounded-md bg-gray-800 px-4 py-2 text-white transition-colors hover:bg-gray-900"
        >
          {t('common.logout')}
        </button>
      </section>
    </main>
  )
}
