import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdminAuditLog } from '../hooks/useAdminAuditLog'
import type { AdminAuditFilters } from '../types'

const initialFilters: AdminAuditFilters = { createdFrom: '', createdTo: '', adminId: '', entity: '', action: '' }

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function AdminAuditLogScreen() {
  const { t, i18n } = useTranslation()
  const [filters, setFilters] = useState(initialFilters)
  const { rows, actors, loading, loadingNextPage, error, hasNextPage, loadNextPage, refetch } = useAdminAuditLog(filters)

  function updateFilter(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-xl font-semibold text-gray-900">{t('audit.title')}</h1><p className="text-sm text-gray-500">{t('audit.subtitle')}</p></div>
      <button type="button" onClick={refetch} disabled={loading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{t('audit.actions.refresh')}</button>
    </div>

    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm text-gray-700">{t('audit.filters.from')}<input type="date" name="createdFrom" value={filters.createdFrom} onChange={updateFilter} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" /></label>
        <label className="text-sm text-gray-700">{t('audit.filters.to')}<input type="date" name="createdTo" value={filters.createdTo} onChange={updateFilter} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" /></label>
        <label className="text-sm text-gray-700">{t('audit.filters.administrator')}<select name="adminId" value={filters.adminId} onChange={updateFilter} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"><option value="">{t('audit.filters.allAdministrators')}</option>{actors.map((actor) => <option key={actor.admin_id} value={actor.admin_id}>{actor.display_name}</option>)}</select></label>
        <label className="text-sm text-gray-700">{t('audit.filters.entity')}<select name="entity" value={filters.entity} onChange={updateFilter} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"><option value="">{t('audit.filters.allEntities')}</option><option value="level">{t('audit.entities.level')}</option><option value="exam_config">{t('audit.entities.examConfig')}</option><option value="question">{t('audit.entities.question')}</option><option value="question_option">{t('audit.entities.questionOption')}</option></select></label>
        <label className="text-sm text-gray-700">{t('audit.filters.action')}<select name="action" value={filters.action} onChange={updateFilter} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"><option value="">{t('audit.filters.allActions')}</option>{['create', 'edit', 'delete', 'deactivate', 'new_version', 'update', 'answer_change'].map((action) => <option key={action} value={action}>{t(`audit.actions.${action}`)}</option>)}</select></label>
      </div>
    </section>

    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong>{t('audit.errors.title')}</strong><p>{t('audit.errors.loadFailed')}</p></div>}
    {loading ? <div aria-busy="true" className="h-40 animate-pulse rounded-xl bg-gray-100" /> : <>
      <section className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm md:block"><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-4 py-3 font-medium">{t('audit.columns.time')}</th><th className="px-4 py-3 font-medium">{t('audit.columns.administrator')}</th><th className="px-4 py-3 font-medium">{t('audit.columns.entity')}</th><th className="px-4 py-3 font-medium">{t('audit.columns.action')}</th><th className="px-4 py-3 font-medium">{t('audit.columns.summary')}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.audit_id} className="border-b border-gray-100 last:border-0"><td className="px-4 py-3">{formatDate(row.created_at, i18n.language)}</td><td className="px-4 py-3">{row.actor_display_name ?? t('audit.systemActor')}</td><td className="px-4 py-3">{t(`audit.entities.${row.entity === 'exam_config' ? 'examConfig' : row.entity === 'question_option' ? 'questionOption' : row.entity}`)}</td><td className="px-4 py-3">{t(`audit.actions.${row.action}`)}</td><td className="px-4 py-3">{row.summary}</td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-gray-500">{t('audit.empty')}</p>}</section>
      <section className="space-y-3 md:hidden">{rows.map((row) => <article key={row.audit_id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-sm font-medium text-gray-900">{row.summary}</p><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-gray-500">{t('audit.columns.time')}</dt><dd>{formatDate(row.created_at, i18n.language)}</dd></div><div><dt className="text-gray-500">{t('audit.columns.administrator')}</dt><dd>{row.actor_display_name ?? t('audit.systemActor')}</dd></div><div><dt className="text-gray-500">{t('audit.columns.entity')}</dt><dd>{t(`audit.entities.${row.entity === 'exam_config' ? 'examConfig' : row.entity === 'question_option' ? 'questionOption' : row.entity}`)}</dd></div><div><dt className="text-gray-500">{t('audit.columns.action')}</dt><dd>{t(`audit.actions.${row.action}`)}</dd></div></dl></article>)}{!rows.length && <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{t('audit.empty')}</p>}</section>
      {hasNextPage && <div className="flex justify-center"><button type="button" onClick={loadNextPage} disabled={loadingNextPage} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{loadingNextPage ? t('audit.actions.loadingMore') : t('audit.actions.loadMore')}</button></div>}
    </>}
  </div>
}
