import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const refetch = vi.fn()
const saveAnswer = vi.fn().mockResolvedValue({ status: 'in_progress' })
const waitForPendingAnswerSaves = vi.fn().mockResolvedValue(true)
const submit = vi.fn().mockResolvedValue(null)
const recoverTimedOutSubmit = vi.fn().mockResolvedValue(null)
let timerState = { remaining: 60_000, expired: false }
let savingAnswers = false
let saveErrors: Record<string, string> = {}
const inProgressAttempt = {
  attempt_id: 'attempt-1', status: 'in_progress' as const, deadline_at: '2026-01-01T01:00:00Z', server_now: '2026-01-01T00:00:00Z',
  questions: [
    { exam_question_id: 'q1', order: 0, text: 'First question', category: null, selected_option_id: null, options: [{ id: 'o1', text: 'First option', order: 0 }] },
    { exam_question_id: 'q2', order: 1, text: 'Second question', category: null, selected_option_id: null, options: [{ id: 'o2', text: 'Second option', order: 0 }] },
  ], result: null,
}
let attempt: Omit<typeof inProgressAttempt, 'status' | 'result'> & {
  status: 'in_progress' | 'completed'
  result: { score: number; level: { id: string; code: string; name: string; version: number } } | null
} = inProgressAttempt

vi.mock('../../hooks/useExamAttempt', () => ({
  useExamAttempt: () => ({ attempt, receivedAt: Date.now(), loading: false, error: null, refetch, saveAnswer, waitForPendingAnswerSaves, savingQuestionId: null, savingAnswers, saveErrors, submitting: false, submit, recoverTimedOutSubmit }),
}))
vi.mock('../../hooks/useExamTimer', () => ({ useExamTimer: () => timerState }))

import StudentExamScreen from '../StudentExamScreen'

function renderScreen() {
  return render(<MemoryRouter initialEntries={['/student/exam/attempt-1']}><Routes><Route path="/student/exam/:attemptId" element={<StudentExamScreen />} /></Routes></MemoryRouter>)
}

describe('StudentExamScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    attempt = inProgressAttempt
    timerState = { remaining: 60_000, expired: false }
    savingAnswers = false
    saveErrors = {}
    waitForPendingAnswerSaves.mockResolvedValue(true)
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('navigates questions, saves a selection, and refreshes on focus', async () => {
    renderScreen()
    expect(screen.getByText('First question')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'First option' }))
    await waitFor(() => expect(saveAnswer).toHaveBeenCalledWith('q1', 'o1'))
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByText('Second question')).toBeInTheDocument()
    fireEvent.focus(window)
    expect(refetch).toHaveBeenCalled()
  })

  it('disables manual submission until an answer save completes', async () => {
    savingAnswers = true
    renderScreen()
    expect(screen.getByRole('button', { name: 'Submit exam' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Submit exam' }))
    expect(submit).not.toHaveBeenCalled()
  })

  it('submits once when the server-derived timer expires', async () => {
    timerState = { remaining: 0, expired: true }
    renderScreen()
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
  })

  it('waits for a pending answer save before submitting on timeout', async () => {
    let finishSave: ((value: boolean) => void) | undefined
    waitForPendingAnswerSaves.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve }))
    timerState = { remaining: 0, expired: true }
    renderScreen()
    await waitFor(() => expect(waitForPendingAnswerSaves).toHaveBeenCalledTimes(1))
    expect(submit).not.toHaveBeenCalled()

    finishSave?.(true)
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
  })

  it('does not finalize when a pending answer save fails, including through timeout recovery', async () => {
    waitForPendingAnswerSaves.mockResolvedValue(false)
    saveErrors = { q1: 'offline' }
    timerState = { remaining: 0, expired: true }
    renderScreen()
    await screen.findByText('Time ran out, but we could not confirm your submission.')
    expect(submit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
    await waitFor(() => expect(waitForPendingAnswerSaves).toHaveBeenCalledTimes(2))
    expect(recoverTimedOutSubmit).not.toHaveBeenCalled()
  })

  it('offers recovery after an automatic timeout submit fails and shows the persisted result after reload', async () => {
    timerState = { remaining: 0, expired: true }
    const completed = { ...inProgressAttempt, status: 'completed' as const, result: { score: 80, level: { id: 'level-1', code: 'B2', name: 'Vantage', version: 1 } } }
    recoverTimedOutSubmit.mockImplementation(async () => {
      attempt = completed
      return completed
    })
    renderScreen()
    await screen.findByText('Time ran out, but we could not confirm your submission.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry submission' }))
    await waitFor(() => expect(recoverTimedOutSubmit).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Your placement result')).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.textContent === '80%')).toBeInTheDocument()
  })
})
