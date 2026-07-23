import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useExamAttempt } from '../useExamAttempt'
import type { ExamAttempt } from '../../types/examAttempt'

const attempt: ExamAttempt = { attempt_id: 'attempt-1', status: 'in_progress', started_at: '2026-01-01T00:00:00Z', deadline_at: '2026-01-01T01:00:00Z', server_now: '2026-01-01T00:00:00Z', questions: [{ exam_question_id: 'question-1', order: 0, text: 'Question', category: null, selected_option_id: null, options: [{ id: 'option-1', text: 'Option', order: 0 }] }], result: null }
let rpc: ReturnType<typeof vi.fn>
vi.mock('../../lib/supabase', () => ({ get supabase() { return { rpc } } }))

describe('useExamAttempt', () => {
  beforeEach(() => { rpc = vi.fn().mockResolvedValue({ data: attempt, error: null }) })

  it('loads exclusively through the attempt RPC and saves answers through its RPC', async () => {
    const { result } = renderHook(() => useExamAttempt('attempt-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.saveAnswer('question-1', 'option-1') })
    expect(rpc).toHaveBeenNthCalledWith(1, 'get_exam_attempt', { p_attempt_id: 'attempt-1' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'save_exam_answer', { p_attempt_id: 'attempt-1', p_exam_question_id: 'question-1', p_option_id: 'option-1' })
  })

  it('uses submit_exam and replaces the attempt with the stable result payload', async () => {
    const completed = { ...attempt, status: 'completed' as const, result: { score: 80, level: { id: 'level-1', code: 'B2', name: 'Vantage', version: 1 } } }
    rpc.mockResolvedValueOnce({ data: attempt, error: null }).mockResolvedValueOnce({ data: completed, error: null })
    const { result } = renderHook(() => useExamAttempt('attempt-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.submit() })
    expect(rpc).toHaveBeenLastCalledWith('submit_exam', { p_attempt_id: 'attempt-1' })
    expect(result.current.attempt).toEqual(completed)
  })

  it('ignores an older answer-save response that resolves after a newer selection', async () => {
    let resolveFirst: ((value: { data: typeof attempt; error: null }) => void) | undefined
    let resolveSecond: ((value: { data: typeof attempt; error: null }) => void) | undefined
    const firstResponse = { ...attempt, questions: [{ ...attempt.questions[0], selected_option_id: 'option-1' }] }
    const secondResponse = { ...attempt, questions: [{ ...attempt.questions[0], selected_option_id: 'option-2' }] }
    rpc.mockResolvedValueOnce({ data: attempt, error: null })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
    const { result } = renderHook(() => useExamAttempt('attempt-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let firstSave!: Promise<unknown>
    let secondSave!: Promise<unknown>
    act(() => {
      firstSave = result.current.saveAnswer('question-1', 'option-1')
      secondSave = result.current.saveAnswer('question-1', 'option-2')
    })
    expect(result.current.savingAnswers).toBe(true)

    await act(async () => { resolveSecond?.({ data: secondResponse, error: null }); await secondSave })
    expect(result.current.attempt).toEqual(secondResponse)
    await act(async () => { resolveFirst?.({ data: firstResponse, error: null }); await firstSave })
    expect(result.current.attempt).toEqual(secondResponse)
    expect(result.current.savingAnswers).toBe(false)
  })

  it('recovers a failed timed-out submit by re-fetching the persisted result without another submit', async () => {
    const completed = { ...attempt, status: 'completed' as const, result: { score: 80, level: { id: 'level-1', code: 'B2', name: 'Vantage', version: 1 } } }
    rpc.mockResolvedValueOnce({ data: attempt, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'offline' } }).mockResolvedValueOnce({ data: completed, error: null })
    const { result } = renderHook(() => useExamAttempt('attempt-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { expect(await result.current.submit()).toBeNull() })
    await act(async () => { await result.current.recoverTimedOutSubmit() })
    expect(rpc).toHaveBeenLastCalledWith('get_exam_attempt', { p_attempt_id: 'attempt-1' })
    expect(rpc).toHaveBeenCalledTimes(3)
    expect(result.current.attempt).toEqual(completed)
  })
})
