import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStudentExamHistory, useStudentExamHistoryDetail } from '../useStudentExamHistory'

const history = [{ attempt_id: '00000000-0000-0000-0000-000000000124', completed_at: '2026-07-22T12:00:00Z', score: 88, cefr_level_code: 'B2', cefr_level_name: 'Vantage', cefr_level_version: 1, historical_status: 'finalized' as const }]
let rpc: ReturnType<typeof vi.fn>
vi.mock('../../lib/supabase', () => ({ get supabase() { return { rpc } } }))

beforeEach(() => { vi.clearAllMocks(); rpc = vi.fn().mockResolvedValue({ data: history, error: null }) })

describe('student exam history hooks', () => {
  it('loads only the safe history projection through the list RPC', async () => {
    const { result } = renderHook(() => useStudentExamHistory())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.history).toEqual(history)
    expect(rpc).toHaveBeenCalledWith('get_student_exam_history')
  })

  it('loads a detail using the stable attempt identifier', async () => {
    const { result } = renderHook(() => useStudentExamHistoryDetail(history[0].attempt_id))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.detail).toEqual(history[0])
    expect(rpc).toHaveBeenCalledWith('get_student_exam_history_detail', { p_attempt_id: history[0].attempt_id })
  })

  it('reports failures and retries list reads', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } }).mockResolvedValueOnce({ data: history, error: null })
    const { result } = renderHook(() => useStudentExamHistory())
    await waitFor(() => expect(result.current.error).toBe('denied'))
    await act(async () => result.current.refetch())
    await waitFor(() => expect(result.current.history).toEqual(history))
  })
})
