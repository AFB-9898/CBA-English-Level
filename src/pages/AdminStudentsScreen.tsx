import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAdminStudents } from '../hooks/useAdminStudents'

export default function AdminStudentsScreen() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const { students, loading, loadingNextPage, error, hasNextPage, loadNextPage, refetch } = useAdminStudents(deferredSearch)

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-xl font-semibold text-gray-900">{t('students.title')}</h1><p className="text-sm text-gray-500">{t('students.subtitle')}</p></div>
      <button type="button" onClick={refetch} disabled={loading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{t('students.actions.refresh')}</button>
    </div>

    <label className="block max-w-xl text-sm font-medium text-gray-700">{t('students.searchLabel')}
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('students.searchPlaceholder')} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm" />
    </label>

    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{t('students.errors.loadFailed')}</div>}
    {loading ? <div aria-busy="true" className="h-40 animate-pulse rounded-xl bg-gray-100" /> : <>
      <section className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block">
        <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-4 py-3 font-medium">{t('common.fullName')}</th><th className="px-4 py-3 font-medium">{t('common.ci')}</th><th className="px-4 py-3 font-medium">{t('common.email')}</th><th className="px-4 py-3 font-medium"><span className="sr-only">{t('students.actions.view')}</span></th></tr></thead><tbody>{students.map((student) => <tr key={student.student_id} className="border-b border-gray-100 last:border-0"><td className="px-4 py-3 font-medium text-gray-900">{student.full_name}</td><td className="px-4 py-3">{student.ci}</td><td className="px-4 py-3">{student.email}</td><td className="px-4 py-3 text-right"><Link to={`/admin/students/${student.student_id}`} className="text-blue-700 hover:underline">{t('students.actions.view')}</Link></td></tr>)}</tbody></table>
        {!students.length && <p className="p-8 text-center text-sm text-gray-500">{t('students.empty')}</p>}
      </section>
      <section className="space-y-3 md:hidden">{students.map((student) => <article key={student.student_id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p className="font-medium text-gray-900">{student.full_name}</p><p className="mt-1 text-sm text-gray-600">{student.ci}</p><p className="text-sm text-gray-600">{student.email}</p><Link to={`/admin/students/${student.student_id}`} className="mt-3 inline-block text-sm text-blue-700 hover:underline">{t('students.actions.view')}</Link></article>)}{!students.length && <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{t('students.empty')}</p>}</section>
      {hasNextPage && <div className="flex justify-center"><button type="button" onClick={loadNextPage} disabled={loadingNextPage} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{loadingNextPage ? t('students.actions.loadingMore') : t('students.actions.loadMore')}</button></div>}
    </>}
  </div>
}
