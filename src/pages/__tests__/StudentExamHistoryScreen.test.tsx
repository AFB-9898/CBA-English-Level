import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from '../../i18n'
import type { StudentExamHistoryItem } from '../../types'

const logout = vi.fn()
vi.mock('../../components/auth/AuthContext', () => ({
  useAuth: () => ({ logout }),
}))

const history: StudentExamHistoryItem[] = [{ attempt_id: '00000000-0000-0000-0000-000000000124', completed_at: '2026-07-22T12:00:00Z', score: 88, cefr_level_code: 'B2', cefr_level_name: 'Vantage', cefr_level_version: 1, historical_status: 'finalized' }]
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
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.clearAllMocks()
    listState = { history, loading: false, error: null }
    detailState = { detail: history[0], loading: false, error: null }
  })

  it('shows finalized attempts without answer data, internal identifiers, or CEFR versions', () => {
    renderAt('/student/history')
    expect(screen.getByRole('heading', { name: 'Exam history' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exam history' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/student')
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('B2 - Vantage')).toBeInTheDocument()
    expect(screen.queryByText('B2 - Vantage (v1)')).not.toBeInTheDocument()
    expect(screen.getByText('Finalized')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute('href', `/student/history/${history[0].attempt_id}`)
    expect(screen.getByRole('region', { name: 'Exam history' })).toHaveClass('cba-student-history__list')
    expect(screen.queryByText(/correct answer/i)).not.toBeInTheDocument()
  })

  it('shows a CEFR code without a literal null or empty level name', () => {
    listState = { history: [{ ...history[0], cefr_level_name: null }], loading: false, error: null }
    const { unmount } = renderAt('/student/history')
    expect(screen.getByText('B2')).toBeInTheDocument()
    expect(screen.queryByText(/null/i)).not.toBeInTheDocument()

    unmount()
    detailState = { detail: { ...history[0], cefr_level_name: '   ' }, loading: false, error: null }
    renderAt(`/student/history/${history[0].attempt_id}`)
    expect(screen.getByText('B2')).toBeInTheDocument()
  })

  it('shows a complete centered score and a version-free CEFR level in the detail', () => {
    detailState = { detail: { ...history[0], score: 100 }, loading: false, error: null }
    const { rerender } = renderAt(`/student/history/${history[0].attempt_id}`)
    expect(screen.getByText('Exam attempt')).toBeInTheDocument()
    const score = document.querySelector('.cba-student-history__score')
    expect(score).toHaveTextContent('100%')
    expect(score?.querySelector('span')).toHaveTextContent('100')
    expect(score?.querySelector('small')).toHaveTextContent('%')
    expect(screen.getByText('B2 - Vantage')).toBeInTheDocument()
    expect(screen.queryByText('B2 - Vantage (v1)')).not.toBeInTheDocument()

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
    expect(document.querySelector('.cba-student-history__score')).toHaveTextContent('88%')
  })

  it('retains CBA loading, error, and empty states for the history list', () => {
    listState = { history: [], loading: true, error: null }
    const { rerender } = renderAt('/student/history')
    expect(screen.getByRole('main', { busy: true })).toBeInTheDocument()

    listState = { history: [], loading: false, error: 'Request failed' }
    rerender(<MemoryRouter initialEntries={['/student/history']}><Routes><Route path="/student/history" element={<StudentExamHistoryScreen />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()

    listState = { history: [], loading: false, error: null }
    rerender(<MemoryRouter initialEntries={['/student/history']}><Routes><Route path="/student/history" element={<StudentExamHistoryScreen />} /></Routes></MemoryRouter>)
    expect(document.querySelector('.cba-student-history__empty')).toBeInTheDocument()
  })

  it('localizes detail loading errors without exposing RPC details and retries the detail request', async () => {
    detailState = { detail: null, loading: false, error: 'permission denied for function get_student_exam_history_detail' }
    const user = userEvent.setup()
    renderAt(`/student/history/${history[0].attempt_id}`)

    expect(screen.getByRole('alert')).toHaveTextContent('We could not load this exam history entry.')
    expect(screen.queryByText(/permission denied/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('localizes detail loading errors in Spanish', async () => {
    await i18n.changeLanguage('es')
    detailState = { detail: null, loading: false, error: 'RPC error' }
    renderAt(`/student/history/${history[0].attempt_id}`)

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar esta entrada del historial de exámenes.')
    expect(screen.queryByText('RPC error')).not.toBeInTheDocument()
  })
})
