import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import StudentNavigation from '../components/organisms/StudentNavigation'
import { useStudentExamHistory, useStudentExamHistoryDetail } from '../hooks/useStudentExamHistory'

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(date))
}

function levelLabel(item: { cefr_level_code: string | null; cefr_level_name: string | null }) {
  const code = item.cefr_level_code?.trim()
  const name = item.cefr_level_name?.trim()
  return code ? (name ? `${code} - ${name}` : code) : '—'
}

function detailLevelLabel(item: { cefr_level_code: string | null; cefr_level_name: string | null }) {
  const code = item.cefr_level_code?.trim()
  const name = item.cefr_level_name?.trim()
  return code ? (name ? `${code} - ${name}` : code) : '—'
}

function StudentPage({ children }: { children: React.ReactNode }) {
  return <main className="cba-auth cba-student"><StudentNavigation />{children}</main>
}

export default function StudentExamHistoryScreen() {
  const { attemptId } = useParams()
  return attemptId === undefined ? <StudentExamHistoryList /> : <StudentExamHistoryDetail />
}

function StudentExamHistoryDetail() {
  const { t } = useTranslation()
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const detail = useStudentExamHistoryDetail(attemptId)

  if (detail.loading) return <StudentPage><main className="cba-student__content" aria-busy="true"><div className="cba-student__skeleton cba-student-history__skeleton" /></main></StudentPage>
  if (detail.error || !detail.detail) return <StudentPage><main className="cba-student__content"><section className="cba-student__card cba-student-history__message"><p role="alert" className="cba-student__alert">{detail.error ? t('studentHistory.loadDetailFailed') : t('studentHistory.notFound')}</p>{detail.error && <button type="button" onClick={detail.refetch} className="cba-student__primary-action">{t('common.retry')}</button>}<button type="button" onClick={() => navigate('/student/history')} className="cba-student__primary-action">{t('studentHistory.backToHistory')}</button></section></main></StudentPage>

  return <StudentPage><main className="cba-student__content cba-student-history"><section className="cba-student-history__detail"><Link to="/student/history" className="cba-student__text-link cba-student-history__back">{t('studentHistory.backToHistory')}</Link><header className="cba-student__page-heading cba-student-history__heading"><h1 className="cba-student__title">{t('studentHistory.detailTitle')}</h1></header><article className="cba-student__card cba-student-history__result"><p className="cba-student-history__result-label">{t('studentHistory.score')}</p><div className="cba-student-history__score"><span>{detail.detail.score}</span><small>%</small></div><p className="cba-student-history__level">{detailLevelLabel(detail.detail)}</p></article><dl className="cba-student-history__detail-grid"><div><dt>{t('studentHistory.date')}</dt><dd>{formatDate(detail.detail.completed_at)}</dd></div><div><dt>{t('studentHistory.status')}</dt><dd><span className="cba-student-history__status">{t(`studentHistory.statuses.${detail.detail.historical_status}`)}</span></dd></div></dl></section></main></StudentPage>
}

function StudentExamHistoryList() {
  const { t } = useTranslation()
  const list = useStudentExamHistory()

  if (list.loading) return <StudentPage><main className="cba-student__content" aria-busy="true"><div className="cba-student__skeleton cba-student-history__skeleton cba-student-history__skeleton--list" /></main></StudentPage>
  if (list.error) return <StudentPage><main className="cba-student__content"><section className="cba-student__card cba-student-history__message"><p role="alert" className="cba-student__alert">{t('studentHistory.loadFailed')}</p><button type="button" onClick={list.refetch} className="cba-student__primary-action">{t('common.retry')}</button></section></main></StudentPage>

  return <StudentPage><main className="cba-student__content cba-student-history"><Link to="/student" className="cba-student__text-link cba-student-history__back">{t('studentHistory.backToDashboard')}</Link><header className="cba-student__page-heading cba-student-history__heading"><h1 className="cba-student__title">{t('studentHistory.title')}</h1><p className="cba-student__subtitle">{t('studentHistory.subtitle')}</p></header>{list.history.length === 0 ? <p className="cba-student__empty cba-student-history__empty">{t('studentHistory.empty')}</p> : <section className="cba-student-history__list" aria-label={t('studentHistory.title')}>{list.history.map((item) => <article key={item.attempt_id} className="cba-student__card cba-student-history__attempt"><div className="cba-student-history__attempt-summary"><p className="cba-student-history__date">{formatDate(item.completed_at)}</p><p className="cba-student-history__level">{levelLabel(item)}</p></div><div className="cba-student-history__attempt-result"><p className="cba-student-history__score-inline">{item.score}%</p><span className="cba-student-history__status">{t(`studentHistory.statuses.${item.historical_status}`)}</span></div><Link to={`/student/history/${item.attempt_id}`} className="cba-student-history__details-link">{t('studentHistory.viewDetails')}</Link></article>)}</section>}</main></StudentPage>
}
