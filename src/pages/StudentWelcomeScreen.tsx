import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import StudentNavigation from '../components/organisms/StudentNavigation'
import { useStudentDashboard } from '../hooks/useStudentDashboard'
import { useStartExam } from '../hooks/useStartExam'

export default function StudentWelcomeScreen() {
  const { t } = useTranslation()
  const { dashboard, loading, error, refetch } = useStudentDashboard()
  const { start, starting, error: startError } = useStartExam()
  const navigate = useNavigate()

  async function beginExam() {
    const attempt = await start()
    if (attempt) navigate(`/student/exam/${attempt.attempt_id}`)
  }

  return (
    <main className="cba-auth cba-student">
      <StudentNavigation />
      <div className="cba-student__content">
        <div className="cba-student__page-heading">
          <p className="cba-student__eyebrow">{t('authPresentation.organizationName')}</p>
          <h1 className="cba-student__title">{t('studentDashboard.title')}</h1>
          <p className="cba-student__subtitle">{t('studentDashboard.subtitle')}</p>
        </div>
        <section className="cba-student__card">
          {loading && <div aria-busy="true" className="cba-student__skeleton" />}
          {error && <div role="alert" className="cba-student__alert"><p>{t('studentDashboard.errors.loadFailed')}</p><button type="button" onClick={refetch} className="cba-student__retry">{t('common.retry')}</button></div>}
          {!loading && !error && !dashboard && <div className="cba-student__empty">{t('studentDashboard.empty')}</div>}
          {!loading && !error && dashboard && <div>
            <div className="cba-student__status"><p className="cba-student__student-name">{dashboard.student_full_name}</p><p className="cba-student__status-copy">{t(`studentDashboard.states.${dashboard.exam_state}`)}</p></div>
            <dl className="cba-student__metrics">
              <div className="cba-student__metric"><dt>{t('studentDashboard.attempts')}</dt><dd>{dashboard.attempt_count}</dd></div>
              <div className="cba-student__metric"><dt>{t('studentDashboard.assignedLevel')}</dt><dd>{dashboard.assigned_level_code && dashboard.assigned_level_name !== null && dashboard.assigned_level_version !== null ? `${dashboard.assigned_level_code} - ${dashboard.assigned_level_name} (v${dashboard.assigned_level_version})` : t('studentDashboard.noResult')}</dd></div>
              <div className="cba-student__metric"><dt>{t('studentDashboard.latestResult')}</dt><dd>{dashboard.latest_result_score ?? t('studentDashboard.noResult')}</dd></div>
            </dl>
            {startError && <div role="alert" className="cba-student__alert">{t('studentDashboard.errors.startFailed')} <button type="button" onClick={() => void beginExam()} className="cba-student__retry">{t('common.retry')}</button></div>}
            <button type="button" onClick={() => void beginExam()} disabled={starting || dashboard.exam_state === 'completed'} className="cba-student__primary-action">
              {starting ? t('studentDashboard.starting') : dashboard.exam_state === 'in_progress' ? t('studentDashboard.resumeExam') : t('studentDashboard.startExam')}
            </button>
            <Link to="/student/history" className="cba-student__text-link">{t('studentDashboard.history')}</Link>
            {dashboard.exam_state === 'completed' && <p className="cba-student__notice">{t('studentDashboard.completedExplanation')}</p>}
          </div>}
        </section>
      </div>
    </main>
  )
}
