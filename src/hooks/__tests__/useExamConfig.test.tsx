/// <reference types="vitest" />
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useExamConfig } from '../useExamConfig'

const config = { id: 'config-1', singleton: true, revision: 4, time_limit_minutes: 60, questions_per_exam: 40, passing_score: 70, question_selection_rule: 'random_all_questions' as const, updated_at: '2026-07-20T00:00:00Z' }

function chain(data: unknown, error: unknown = null) {
  const value: Record<string, any> = {}
  ;['select', 'eq', 'maybeSingle'].forEach((method) => { value[method] = vi.fn().mockReturnValue(value) })
  value.then = (resolve: (result: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve)
  return value
}

let from: ReturnType<typeof vi.fn>
let rpc: ReturnType<typeof vi.fn>
vi.mock('../../lib/supabase', () => ({ get supabase() { return { from, rpc } } }))

beforeEach(() => {
  vi.clearAllMocks()
  from = vi.fn(() => chain(config))
  rpc = vi.fn()
})

describe('useExamConfig', () => {
  it('loads the singleton configuration', async () => {
    const { result } = renderHook(() => useExamConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config).toEqual(config)
    expect(from).toHaveBeenCalledWith('exam_config')
  })

  it('updates all editable values through the revision-checked RPC', async () => {
    const updated = { ...config, revision: 5, time_limit_minutes: 75 }
    rpc.mockResolvedValue({ data: updated, error: null })
    const { result } = renderHook(() => useExamConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => expect(await result.current.updateExamConfig({ expected_revision: 4, time_limit_minutes: 75, questions_per_exam: 40, passing_score: 70 })).toEqual({ data: updated, error: null }))
    expect(rpc).toHaveBeenCalledWith('update_exam_config', { p_expected_revision: 4, p_time_limit_minutes: 75, p_questions_per_exam: 40, p_passing_score: 70 })
  })

  it('marks stale revisions as conflicts and refetches', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Exam configuration revision is stale', code: '40001' } })
    const { result } = renderHook(() => useExamConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => expect(await result.current.updateExamConfig({ expected_revision: 3, time_limit_minutes: 60, questions_per_exam: 40, passing_score: 70 })).toMatchObject({ error: 'Exam configuration revision is stale', code: '40001', conflict: true }))
    await waitFor(() => expect(from).toHaveBeenCalledTimes(2))
  })

  it('exposes empty and failed reads without treating them as valid configuration', async () => {
    from = vi.fn(() => chain(null))
    const { result, unmount } = renderHook(() => useExamConfig())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.config).toBeNull()
    unmount()
    from = vi.fn(() => chain(null, { message: 'network error' }))
    const failed = renderHook(() => useExamConfig())
    await waitFor(() => expect(failed.result.current.loading).toBe(false))
    expect(failed.result.current.error).toBe('network error')
  })
})
