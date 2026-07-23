import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStartExam } from '../useStartExam'

let rpc: ReturnType<typeof vi.fn>
vi.mock('../../lib/supabase', () => ({ get supabase() { return { rpc } } }))

describe('useStartExam', () => {
  beforeEach(() => {
    rpc = vi.fn().mockResolvedValue({ data: { attempt_id: 'attempt-1', status: 'in_progress', server_now: '2026-01-01T00:00:00Z', questions: [] }, error: null })
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'request-uuid') })
  })

  it('uses one generated request UUID across a retry and returns the RPC attempt', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
    const { result } = renderHook(() => useStartExam())
    await act(async () => expect(await result.current.start()).toBeNull())
    await act(async () => expect(await result.current.start()).toMatchObject({ attempt_id: 'attempt-1' }))
    expect(rpc).toHaveBeenNthCalledWith(1, 'start_exam', { p_request_id: 'request-uuid' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'start_exam', { p_request_id: 'request-uuid' })
  })
})
