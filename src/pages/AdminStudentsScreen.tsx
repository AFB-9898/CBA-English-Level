import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAdminStudents } from '../hooks/useAdminStudents'

export default function AdminStudentsScreen() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const { students, loading, loadingNextPage, error, hasNextPage, loadNextPage, refetch } = useAdminStudents(deferredSearch)

  return <div className="cba-admin__module space-y-6">
    <div className="cba-admin__module-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="cba-admin__module-title">{t('students.title')}</h1><p className="cba-admin__module-subtitle text-sm">{t('students.subtitle')}</p></div>
      <button type="button" onClick={refetch} disabled={loading} className="cba-admin__button cba-admin__button--secondary rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{t('students.actions.refresh')}</button>
    </div>

    <label className="block max-w-xl text-sm font-medium text-gray-700">{t('students.searchLabel')}
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('students.searchPlaceholder')} className="cba-admin__field mt-1 block w-full rounded-lg border px-3 py-2 shadow-sm" />
    </label>

    {loading ? <div aria-busy="true" className="h-40 animate-pulse rounded-xl bg-gray-100" /> : <>
      {error && <div role="alert" className="cba-admin__alert cba-admin__alert--error rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{t('students.errors.loadFailed')}</p><button type="button" onClick={refetch} className="cba-admin__button cba-admin__button--danger mt-3 rounded-lg border px-3 py-1.5">{t('common.retry')}</button></div>}
      {(!error || students.length > 0) && <>
      <section className="cba-admin__table-wrap hidden overflow-x-auto md:block">
        <table className="cba-admin__table w-full text-sm"><thead><tr className="border-b text-left"><th className="px-4 py-3 font-medium">{t('common.fullName')}</th><th className="px-4 py-3 font-medium">{t('common.ci')}</th><th className="px-4 py-3 font-medium">{t('common.email')}</th><th className="px-4 py-3 font-medium"><span className="sr-only">{t('students.actions.view')}</span></th></tr></thead><tbody>{students.map((student) => <tr key={student.student_id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{student.full_name}</td><td className="px-4 py-3">{student.ci}</td><td className="px-4 py-3">{student.email}</td><td className="px-4 py-3 text-right"><Link to={`/admin/students/${student.student_id}`} className="cba-admin__action">{t('students.actions.view')}</Link></td></tr>)}</tbody></table>
        {!students.length && <p className="p-8 text-center text-sm text-gray-500">{t('students.empty')}</p>}
      </section>
      <section className="space-y-3 md:hidden">{students.map((student) => <article key={student.student_id} className="cba-admin__record p-4"><p className="font-medium text-gray-900">{student.full_name}</p><p className="mt-1 text-sm text-gray-600">{student.ci}</p><p className="text-sm text-gray-600">{student.email}</p><Link to={`/admin/students/${student.student_id}`} className="cba-admin__action mt-3 inline-block text-sm">{t('students.actions.view')}</Link></article>)}{!students.length && <p className="cba-admin__panel p-8 text-center text-sm text-gray-500">{t('students.empty')}</p>}</section>
      {hasNextPage && <div className="flex justify-center"><button type="button" onClick={loadNextPage} disabled={loadingNextPage} className="cba-admin__button cba-admin__button--secondary rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{loadingNextPage ? t('students.actions.loadingMore') : t('students.actions.loadMore')}</button></div>}
      </>}
    </>}
  </div>
}
