import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportsScreen from '../ReportsScreen'
import { useReports } from '../../hooks/useReports'

vi.mock('../../hooks/useReports', () => ({ useReports: vi.fn() }))
vi.mock('../../hooks/useLevels', () => ({ useLevels: () => ({ levels: [{ id: 'level-1', name: 'B2', code: 'B2', min_score: 61, max_score: 80, description: null }], loading: false, error: null }) }))
vi.mock('../../utils/reportExport', () => ({ downloadReportsCsv: vi.fn(), downloadReportsXlsx: vi.fn() }))
const mockUseReports = vi.mocked(useReports)
const rows = [{ exam_id: 'exam-1', student_id: 'student-1', level_id: 'level-1', completed_at: '2026-07-10T12:00:00Z', student_full_name: 'Ada Lovelace', student_ci: 'CI-1', status: 'completed' as const, score: 90, level_code: 'B2' }]
let reportsHook: ReturnType<typeof useReports>

function base(): ReturnType<typeof useReports> {
  return { rows, loading: false, error: null, hasNextPage: true, refetch: vi.fn(), loadExportRows: vi.fn().mockResolvedValue({ data: rows, error: null }) }
}

beforeEach(() => { vi.clearAllMocks(); reportsHook = base(); mockUseReports.mockReturnValue(reportsHook) })

describe('ReportsScreen', () => {
  it('renders report fields and controlled filters', () => {
    render(<ReportsScreen />)
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    const from = screen.getByLabelText('Completed from')
    fireEvent.change(from, { target: { value: '2026-07-01' } })
    expect(from).toHaveValue('2026-07-01')
    expect(screen.getByLabelText('CEFR level')).toHaveValue('')
  })

  it('resets pagination when a filter changes and exports filtered rows', async () => {
    render(<ReportsScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(mockUseReports).toHaveBeenLastCalledWith(expect.anything(), 2))
    fireEvent.change(screen.getByLabelText('Exam status'), { target: { value: 'completed' } })
    await waitFor(() => expect(mockUseReports).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'completed' }), 1))
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    await waitFor(() => expect(reportsHook.loadExportRows).toHaveBeenCalled())
  })

  it('shows report load errors and disables unavailable next pages', () => {
    mockUseReports.mockReturnValue({ ...base(), rows: [], error: 'denied', hasNextPage: false })
    render(<ReportsScreen />)
    expect(screen.getByRole('alert')).toHaveTextContent('Report data could not be loaded.')
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})
