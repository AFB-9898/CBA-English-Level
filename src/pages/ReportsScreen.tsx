import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLevels } from '../hooks/useLevels'
import { useReports } from '../hooks/useReports'
import { downloadReportsCsv, downloadReportsXlsx, type ReportExportLabels } from '../utils/reportExport'
import type { ReportFilters } from '../types'

const initialFilters: ReportFilters = { completedFrom: '', completedTo: '', levelId: '', status: '' }

export default function ReportsScreen() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const { levels } = useLevels({ includeHistorical: true })
  const { rows, loading, error, hasNextPage, loadExportRows } = useReports(filters, page)

  const labels: ReportExportLabels = {
    completedAt: t('reports.columns.completedAt'),
    studentFullName: t('reports.columns.student'),
    studentCi: t('reports.columns.ci'),
    status: t('reports.columns.status'),
    score: t('reports.columns.score'),
    level: t('reports.columns.level'),
  }

  function updateFilter(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }

  async function exportRows(format: 'csv' | 'xlsx') {
    setExporting(true)
    setExportError(null)
    const result = await loadExportRows()
    setExporting(false)
    if (result.error) { setExportError(result.error); return }
    if (format === 'csv') downloadReportsCsv(result.data, labels)
    else downloadReportsXlsx(result.data, labels)
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-xl font-semibold text-gray-900">{t('reports.title')}</h1><p className="text-sm text-gray-500">{t('reports.subtitle')}</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => exportRows('csv')} disabled={exporting} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">{t('reports.actions.csv')}</button><button type="button" onClick={() => exportRows('xlsx')} disabled={exporting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{t('reports.actions.xlsx')}</button></div>
    </div>
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm text-gray-700">{t('reports.filters.completedFrom')}<input type="date" name="completedFrom" value={filters.completedFrom} onChange={updateFilter} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" /></label>
      <label className="text-sm text-gray-700">{t('reports.filters.completedTo')}<input type="date" name="completedTo" value={filters.completedTo} onChange={updateFilter} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" /></label>
      <label className="text-sm text-gray-700">{t('reports.filters.level')}<select name="levelId" value={filters.levelId} onChange={updateFilter} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"><option value="">{t('reports.filters.allLevels')}</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.code ?? level.name}</option>)}</select></label>
      <label className="text-sm text-gray-700">{t('reports.filters.status')}<select name="status" value={filters.status} onChange={updateFilter} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"><option value="">{t('reports.filters.allStatuses')}</option><option value="pending">{t('reports.status.pending')}</option><option value="in_progress">{t('reports.status.inProgress')}</option><option value="completed">{t('reports.status.completed')}</option></select></label>
    </div></section>
    {(error || exportError) && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong>{t('reports.errors.title')}</strong><p>{error ? t('reports.errors.loadFailed') : t('reports.errors.exportFailed')}</p><p>{error ?? exportError}</p></div>}
    {loading ? <div aria-busy="true" className="h-40 animate-pulse rounded-xl bg-gray-100" /> : <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm"><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500">{Object.values(labels).map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.exam_id} className="border-b border-gray-100 last:border-0"><td className="px-4 py-3">{row.completed_at ? new Date(row.completed_at).toLocaleDateString() : '—'}</td><td className="px-4 py-3">{row.student_full_name}</td><td className="px-4 py-3">{row.student_ci}</td><td className="px-4 py-3">{t(`reports.status.${row.status === 'in_progress' ? 'inProgress' : row.status}`)}</td><td className="px-4 py-3">{row.score ?? '—'}</td><td className="px-4 py-3">{row.level_code ?? '—'}</td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-sm text-gray-500">{t('reports.empty')}</p>}</section>}
    <nav aria-label={t('reports.pagination.label')} className="flex items-center justify-between"><button type="button" onClick={() => setPage((current) => current - 1)} disabled={page === 1 || loading} className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50">{t('reports.pagination.previous')}</button><span className="text-sm text-gray-500">{t('reports.pagination.page', { page })}</span><button type="button" onClick={() => setPage((current) => current + 1)} disabled={!hasNextPage || loading} className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50">{t('reports.pagination.next')}</button></nav>
  </div>
}
