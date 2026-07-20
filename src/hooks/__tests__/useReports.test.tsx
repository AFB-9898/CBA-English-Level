import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReports } from '../useReports'
import type { ReportFilters } from '../../types'

const filters: ReportFilters = { completedFrom: '2026-07-01', completedTo: '2026-07-31', levelId: 'level-1', status: 'completed' }
const reportRow = { exam_id: 'exam-1', student_id: 'student-1', level_id: 'level-1', completed_at: '2026-07-10T12:00:00Z', student_full_name: 'Ada Lovelace', student_ci: 'CI-1', status: 'completed' as const, score: 90, level_code: 'B2' }

let rpc: ReturnType<typeof vi.fn>
vi.mock('../../lib/supabase', () => ({ get supabase() { return { rpc } } }))

beforeEach(() => { vi.clearAllMocks(); rpc = vi.fn().mockResolvedValue({ data: [reportRow], error: null }) })

describe('useReports', () => {
  it('loads report rows through the authorized RPC with filters and pagination', async () => {
    const { result } = renderHook(() => useReports(filters, 2, 25))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toEqual([reportRow])
    expect(rpc).toHaveBeenCalledWith('get_admin_exam_report', {
      p_completed_from: '2026-07-01', p_completed_to: '2026-07-31', p_level_id: 'level-1', p_status: 'completed', p_page: 2, p_page_size: 25,
    })
  })

  it('returns an RPC error and uses the bounded export request', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: { message: 'denied' } }).mockResolvedValueOnce({ data: [reportRow], error: null })
    const { result } = renderHook(() => useReports(filters, 1))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('denied')
    await act(async () => expect(await result.current.loadExportRows()).toEqual({ data: [reportRow], error: null }))
    expect(rpc).toHaveBeenLastCalledWith('get_admin_exam_report', expect.objectContaining({ p_page: 1, p_page_size: 5000 }))
  })

  it('loads every bounded export page before returning rows', async () => {
    const fullPage = Array.from({ length: 5000 }, (_, index) => ({ ...reportRow, exam_id: `exam-${index}` }))
    rpc.mockResolvedValueOnce({ data: [reportRow], error: null }).mockResolvedValueOnce({ data: fullPage, error: null }).mockResolvedValueOnce({ data: [reportRow], error: null })
    const { result } = renderHook(() => useReports(filters, 1))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => expect(await result.current.loadExportRows()).toEqual({ data: [...fullPage, reportRow], error: null }))
    expect(rpc).toHaveBeenLastCalledWith('get_admin_exam_report', expect.objectContaining({ p_page: 2, p_page_size: 5000 }))
  })
})
