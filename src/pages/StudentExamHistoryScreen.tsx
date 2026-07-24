import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStudentExamHistory, useStudentExamHistoryDetail } from '../hooks/useStudentExamHistory'

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(date))
}

function levelLabel(item: { cefr_level_code: string | null; cefr_level_name: string | null; cefr_level_version: number | null }) {
  return item.cefr_level_code
    ? `${item.cefr_level_code} - ${item.cefr_level_name} (v${item.cefr_level_version})`
    : '—'
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

  if (detail.loading) return <main className="min-h-screen bg-gray-50 p-6" aria-busy="true"><div className="mx-auto h-56 max-w-lg animate-pulse rounded-lg bg-gray-200" /></main>
  if (detail.error || !detail.detail) return <main className="min-h-screen bg-gray-50 p-6"><section className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow"><p role="alert" className="text-red-800">{detail.error ?? t('studentHistory.notFound')}</p><button type="button" onClick={() => navigate('/student/history')} className="mt-4 rounded bg-blue-700 px-4 py-2 text-white">{t('studentHistory.backToHistory')}</button></section></main>

  return <main className="min-h-screen bg-gray-50 px-4 py-12"><section className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow-md"><Link to="/student/history" className="text-sm font-medium text-blue-700 hover:underline">{t('studentHistory.backToHistory')}</Link><h1 className="mt-4 text-2xl font-bold text-gray-800">{t('studentHistory.detailTitle')}</h1><dl className="mt-6 space-y-4"><div><dt className="text-sm text-gray-500">{t('studentHistory.date')}</dt><dd className="font-medium text-gray-900">{formatDate(detail.detail.completed_at)}</dd></div><div><dt className="text-sm text-gray-500">{t('studentHistory.score')}</dt><dd className="font-medium text-gray-900">{detail.detail.score}%</dd></div><div><dt className="text-sm text-gray-500">{t('studentHistory.cefrLevel')}</dt><dd className="font-medium text-gray-900">{levelLabel(detail.detail)}</dd></div><div><dt className="text-sm text-gray-500">{t('studentHistory.status')}</dt><dd className="font-medium text-gray-900">{t(`studentHistory.statuses.${detail.detail.historical_status}`)}</dd></div></dl></section></main>
}

function StudentExamHistoryList() {
  const { t } = useTranslation()
  const list = useStudentExamHistory()

  if (list.loading) return <main className="min-h-screen bg-gray-50 p-6" aria-busy="true"><div className="mx-auto h-64 max-w-3xl animate-pulse rounded-lg bg-gray-200" /></main>
  if (list.error) return <main className="min-h-screen bg-gray-50 p-6"><section className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow"><p role="alert" className="text-red-800">{t('studentHistory.loadFailed')}</p><button type="button" onClick={list.refetch} className="mt-4 rounded bg-blue-700 px-4 py-2 text-white">{t('common.retry')}</button></section></main>

  return <main className="min-h-screen bg-gray-50 px-4 py-12"><section className="mx-auto max-w-3xl rounded-lg bg-white p-6 shadow-md"><Link to="/student" className="text-sm font-medium text-blue-700 hover:underline">{t('studentHistory.backToDashboard')}</Link><h1 className="mt-4 text-2xl font-bold text-gray-800">{t('studentHistory.title')}</h1><p className="mt-2 text-gray-600">{t('studentHistory.subtitle')}</p>{list.history.length === 0 ? <p className="mt-6 rounded-md bg-gray-100 p-4 text-sm text-gray-700">{t('studentHistory.empty')}</p> : <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-gray-200 text-gray-500"><th className="pb-3 font-medium">{t('studentHistory.date')}</th><th className="pb-3 font-medium">{t('studentHistory.score')}</th><th className="pb-3 font-medium">{t('studentHistory.cefrLevel')}</th><th className="pb-3 font-medium">{t('studentHistory.status')}</th><th className="pb-3"><span className="sr-only">{t('studentHistory.viewDetails')}</span></th></tr></thead><tbody>{list.history.map((item) => <tr key={item.attempt_id} className="border-b border-gray-100 last:border-0"><td className="py-3 text-gray-900">{formatDate(item.completed_at)}</td><td className="py-3 text-gray-900">{item.score}%</td><td className="py-3 text-gray-900">{levelLabel(item)}</td><td className="py-3 text-gray-900">{t(`studentHistory.statuses.${item.historical_status}`)}</td><td className="py-3 text-right"><Link to={`/student/history/${item.attempt_id}`} className="font-medium text-blue-700 hover:underline">{t('studentHistory.viewDetails')}</Link></td></tr>)}</tbody></table></div>}</section></main>
}
