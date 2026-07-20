import * as XLSX from 'xlsx'
import type { AdminReportRow } from '../types'

export interface ReportExportLabels {
  completedAt: string
  studentFullName: string
  studentCi: string
  status: string
  score: string
  level: string
}

export type ReportExportRow = Record<string, string | number>

export function neutralizeSpreadsheetValue(value: string | number | null): string | number {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`
  return value ?? ''
}

export function mapReportExportRows(rows: AdminReportRow[], labels: ReportExportLabels): ReportExportRow[] {
  return rows.map((row) => ({
    [labels.completedAt]: neutralizeSpreadsheetValue(row.completed_at ?? ''),
    [labels.studentFullName]: neutralizeSpreadsheetValue(row.student_full_name),
    [labels.studentCi]: neutralizeSpreadsheetValue(row.student_ci),
    [labels.status]: neutralizeSpreadsheetValue(row.status),
    [labels.score]: neutralizeSpreadsheetValue(row.score),
    [labels.level]: neutralizeSpreadsheetValue(row.level_code),
  }))
}

export function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function createReportsCsv(rows: AdminReportRow[], labels: ReportExportLabels): string {
  const exportRows = mapReportExportRows(rows, labels)
  const headings = Object.keys(exportRows[0] ?? {
    [labels.completedAt]: '', [labels.studentFullName]: '', [labels.studentCi]: '', [labels.status]: '', [labels.score]: '', [labels.level]: '',
  })
  return [headings, ...exportRows.map((row) => headings.map((heading) => row[heading]))]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n')
}

function downloadBlob(content: BlobPart, mimeType: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadReportsCsv(rows: AdminReportRow[], labels: ReportExportLabels) {
  downloadBlob(createReportsCsv(rows, labels), 'text/csv;charset=utf-8', 'placement-exam-report.csv')
}

export function downloadReportsXlsx(rows: AdminReportRow[], labels: ReportExportLabels) {
  const worksheet = XLSX.utils.json_to_sheet(mapReportExportRows(rows, labels))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reports')
  XLSX.writeFileXLSX(workbook, 'placement-exam-report.xlsx')
}
