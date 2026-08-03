import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const logout = vi.fn()
vi.mock('../../components/auth/AuthContext', () => ({
  useAuth: () => ({ logout }),
}))

const history = [{ attempt_id: '00000000-0000-0000-0000-000000000124', completed_at: '2026-07-22T12:00:00Z', score: 88, cefr_level_code: 'B2', cefr_level_name: 'Vantage', cefr_level_version: 1, historical_status: 'finalized' as const }]
const newlyFinalizedAttempt = { attempt_id: '00000000-0000-0000-0000-000000000125', completed_at: '2026-07-23T12:00:00Z', score: 92, cefr_level_code: 'C1', cefr_level_name: 'Effective Operational Proficiency', cefr_level_version: 1, historical_status: 'finalized' as const }
let listState = { history, loading: false, error: null as string | null }
let detailState: { detail: typeof history[number] | null; loading: boolean; error: string | null } = { detail: history[0], loading: false, error: null }
const refetch = vi.fn()
const detailAttemptIds = vi.fn()
vi.mock('../../hooks/useStudentExamHistory', () => ({
  useStudentExamHistory: () => ({ ...listState, refetch }),
  useStudentExamHistoryDetail: (attemptId: string) => {
    detailAttemptIds(attemptId)
    return { ...detailState, refetch }
  },
}))

import StudentExamHistoryScreen from '../StudentExamHistoryScreen'

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/student/history" element={<StudentExamHistoryScreen />} /><Route path="/student/history/:attemptId" element={<StudentExamHistoryScreen />} /></Routes></MemoryRouter>)
}

describe('StudentExamHistoryScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listState = { history, loading: false, error: null }
    detailState = { detail: history[0], loading: false, error: null }
  })

  it('shows finalized attempts without answer data or internal identifiers', () => {
    renderAt('/student/history')
    expect(screen.getByRole('heading', { name: 'Exam history' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exam history' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/student')
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('B2 - Vantage (v1)')).toBeInTheDocument()
    expect(screen.getByText('Finalized')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute('href', `/student/history/${history[0].attempt_id}`)
    expect(screen.queryByText(/correct answer/i)).not.toBeInTheDocument()
  })

  it('shows a safe detail projection and handles unavailable entries', () => {
    const { rerender } = renderAt(`/student/history/${history[0].attempt_id}`)
    expect(screen.getByText('Exam attempt')).toBeInTheDocument()
    expect(screen.getByText('88%')).toBeInTheDocument()

    detailState = { detail: null, loading: false, error: null }
    rerender(<MemoryRouter initialEntries={[`/student/history/${history[0].attempt_id}`]}><Routes><Route path="/student/history/:attemptId" element={<StudentExamHistoryScreen />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('This exam history entry is unavailable.')
  })

  it('keeps existing detail links bound to their original attempt after a new finalization', () => {
    const { rerender, unmount } = renderAt('/student/history')
    const originalLink = screen.getByRole('link', { name: 'View details' })
    expect(originalLink).toHaveAttribute('href', `/student/history/${history[0].attempt_id}`)

    listState = { history: [newlyFinalizedAttempt, ...history], loading: false, error: null }
    rerender(<MemoryRouter initialEntries={['/student/history']}><Routes><Route path="/student/history" element={<StudentExamHistoryScreen />} /></Routes></MemoryRouter>)
    expect(screen.getAllByRole('link', { name: 'View details' }).map((link) => link.getAttribute('href'))).toEqual([
      `/student/history/${newlyFinalizedAttempt.attempt_id}`,
      `/student/history/${history[0].attempt_id}`,
    ])

    unmount()
    renderAt(`/student/history/${history[0].attempt_id}`)
    expect(detailAttemptIds).toHaveBeenLastCalledWith(history[0].attempt_id)
    expect(screen.getByText('88%')).toBeInTheDocument()
  })
})
