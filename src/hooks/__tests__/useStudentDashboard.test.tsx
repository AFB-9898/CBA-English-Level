import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStudentDashboard } from '../useStudentDashboard'

const dashboard = { student_full_name: 'Ada Lovelace', exam_state: 'completed' as const, latest_result_score: 88, latest_result_completed_at: '2026-07-22T12:00:00Z', assigned_level_code: 'B2', assigned_level_name: 'Vantage', assigned_level_version: 1, attempt_count: 2 }

let rpc: ReturnType<typeof vi.fn>
vi.mock('../../lib/supabase', () => ({ get supabase() { return { rpc } } }))

beforeEach(() => { vi.clearAllMocks(); rpc = vi.fn().mockResolvedValue({ data: [dashboard], error: null }) })

describe('useStudentDashboard', () => {
  it('loads the authenticated student dashboard through the parameterless RPC', async () => {
    const { result } = renderHook(() => useStudentDashboard())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.dashboard).toEqual(dashboard)
    expect(rpc).toHaveBeenCalledWith('get_student_dashboard')
  })

  it('exposes errors and retries without a mutation RPC', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } }).mockResolvedValueOnce({ data: [dashboard], error: null })
    const { result } = renderHook(() => useStudentDashboard())
    await waitFor(() => expect(result.current.error).toBe('denied'))
    await act(async () => result.current.refetch())
    await waitFor(() => expect(result.current.dashboard).toEqual(dashboard))
    expect(rpc).toHaveBeenCalledTimes(2)
  })
})
