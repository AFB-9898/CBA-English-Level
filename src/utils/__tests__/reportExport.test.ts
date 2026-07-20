import { describe, expect, it } from 'vitest'
import { createReportsCsv, mapReportExportRows } from '../reportExport'
import type { AdminReportRow } from '../../types'

const labels = { completedAt: 'Completed date', studentFullName: 'Student', studentCi: 'Student CI', status: 'Status', score: 'Score', level: 'CEFR level' }
const row: AdminReportRow = { exam_id: 'exam-1', student_id: 'student-1', level_id: 'level-1', completed_at: '2026-07-10T12:00:00Z', student_full_name: '=SUM(1,1)\nAda', student_ci: '+591,"test"', status: 'completed', score: 90, level_code: 'B2' }

describe('report exports', () => {
  it('neutralizes formulas and escapes CSV delimiters, quotes, and line breaks', () => {
    const csv = createReportsCsv([row], labels)
    expect(csv).toContain("\"'=SUM(1,1)\nAda\"")
    expect(csv).toContain("\"'+591,\"\"test\"\"\"")
  })

  it('maps the same sanitized values for the XLSX worksheet', () => {
    expect(mapReportExportRows([row], labels)[0]).toMatchObject({ Student: "'=SUM(1,1)\nAda", 'Student CI': "'+591,\"test\"" })
  })
})
