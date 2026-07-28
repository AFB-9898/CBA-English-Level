import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAdminStudentDetail } from '../hooks/useAdminStudentDetail'

export default function AdminStudentDetailScreen() {
  const { t, i18n } = useTranslation()
  const { studentId } = useParams()
  const { student, attempts, loading, saving, loadError, saveError, saveProfile, refetch } = useAdminStudentDetail(studentId)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (student) {
      setFullName(student.full_name)
      setPhone(student.phone ?? '')
    }
  }, [student])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    if (await saveProfile(fullName, phone)) setSaved(true)
  }

  return <div className="space-y-6">
    <Link to="/admin/students" className="text-sm text-blue-700 hover:underline">{t('students.actions.back')}</Link>
    {loadError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{t(`students.errors.${loadError}`)}</div>}
    {saveError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{t('students.errors.updateFailed')}</div>}
    {loading ? <div aria-busy="true" className="h-56 animate-pulse rounded-xl bg-gray-100" /> : !student ? <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500"><p>{t('students.notFound')}</p><button type="button" onClick={refetch} className="mt-3 text-blue-700 hover:underline">{t('common.retry')}</button></div> : <>
      <div><h1 className="text-xl font-semibold text-gray-900">{t('students.detailTitle')}</h1><p className="text-sm text-gray-500">{t('students.detailSubtitle')}</p></div>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">{t('common.fullName')}<input value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={saving} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" /></label>
        <label className="block text-sm font-medium text-gray-700">{t('common.phone')}<input value={phone} onChange={(event) => setPhone(event.target.value)} disabled={saving} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" inputMode="tel" /></label>
        <dl className="grid gap-4 border-t border-gray-200 pt-4 text-sm sm:grid-cols-2"><div><dt className="text-gray-500">{t('common.ci')}</dt><dd>{student.ci}</dd></div><div><dt className="text-gray-500">{t('common.email')}</dt><dd>{student.email}</dd></div></dl>
        <p className="text-sm text-gray-500">{t('students.identityReadOnly')}</p>
        {saved && <p role="status" className="text-sm text-green-700">{t('students.saved')}</p>}
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? t('students.actions.saving') : t('students.actions.save')}</button>
      </form>
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-200 px-5 py-4"><h2 className="font-semibold text-gray-900">{t('students.attempts.title')}</h2><p className="text-sm text-gray-500">{t('students.attempts.subtitle')}</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-4 py-3 font-medium">{t('students.attempts.status')}</th><th className="px-4 py-3 font-medium">{t('students.attempts.completedAt')}</th><th className="px-4 py-3 font-medium">{t('students.attempts.score')}</th><th className="px-4 py-3 font-medium">{t('students.attempts.level')}</th></tr></thead><tbody>{attempts.map((attempt) => <tr key={attempt.attempt_id} className="border-b border-gray-100 last:border-0"><td className="px-4 py-3">{t(`reports.status.${attempt.status === 'in_progress' ? 'inProgress' : attempt.status}`)}</td><td className="px-4 py-3">{attempt.completed_at ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(attempt.completed_at)) : t('students.attempts.notCompleted')}</td><td className="px-4 py-3">{attempt.score ?? '—'}</td><td className="px-4 py-3">{attempt.cefr_level_code ? `${attempt.cefr_level_code} - ${attempt.cefr_level_name} (v${attempt.cefr_level_version})` : '—'}</td></tr>)}</tbody></table>{!attempts.length && <p className="p-6 text-center text-sm text-gray-500">{t('students.attempts.empty')}</p>}</div></section>
    </>}
  </div>
}
