/// <reference types="vitest" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExamConfigurationScreen from '../ExamConfigurationScreen'
import { useExamConfig } from '../../hooks/useExamConfig'

vi.mock('../../hooks/useExamConfig', () => ({ useExamConfig: vi.fn() }))
const mockUseExamConfig = vi.mocked(useExamConfig)
const config = { id: 'config-1', singleton: true, revision: 4, time_limit_minutes: 60, questions_per_exam: 40, passing_score: 70, question_selection_rule: 'random_all_questions' as const, updated_at: '2026-07-20T00:00:00Z' }
const base = (): ReturnType<typeof useExamConfig> => ({ config, loading: false, error: null, refetch: vi.fn(), updateExamConfig: vi.fn().mockResolvedValue({ data: { ...config, revision: 5, time_limit_minutes: 75 }, error: null }) })

beforeEach(() => { vi.clearAllMocks(); mockUseExamConfig.mockReturnValue(base()) })

describe('ExamConfigurationScreen', () => {
  it('shows controlled configuration fields and the CEFR clarification', () => {
    render(<ExamConfigurationScreen />)
    expect(screen.getByLabelText('Time limit (minutes)')).toHaveValue(60)
    expect(screen.getByLabelText('Questions per exam')).toHaveValue(40)
    expect(screen.getByLabelText('Passing score (%)')).toHaveValue(70)
    expect(screen.getByText(/pass\/fail status only/)).toBeInTheDocument()
    expect(screen.getByText(/CEFR level is determined by the active score ranges/)).toBeInTheDocument()
  })

  it('validates invalid and unchanged submissions without calling the RPC', () => {
    const hooks = base(); mockUseExamConfig.mockReturnValue(hooks)
    render(<ExamConfigurationScreen />)
    fireEvent.submit(screen.getByRole('button', { name: 'Save configuration' }).closest('form')!)
    expect(screen.getByText('Change at least one value before saving.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Passing score (%)'), { target: { value: '101' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Save configuration' }).closest('form')!)
    expect(screen.getByText('The passing score must be from 0 through 100.')).toBeInTheDocument()
    expect(hooks.updateExamConfig).not.toHaveBeenCalled()
  })

  it('saves once with the revision and shows success', async () => {
    const hooks = base(); mockUseExamConfig.mockReturnValue(hooks)
    render(<ExamConfigurationScreen />)
    fireEvent.change(screen.getByLabelText('Time limit (minutes)'), { target: { value: '75' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Save configuration' }).closest('form')!)
    await waitFor(() => expect(hooks.updateExamConfig).toHaveBeenCalledWith({ expected_revision: 4, time_limit_minutes: 75, questions_per_exam: 40, passing_score: 70 }))
    expect(screen.getByText('The exam configuration was updated.')).toBeInTheDocument()
  })

  it('shows loading, empty, load-error, and stale-server states', async () => {
    mockUseExamConfig.mockReturnValue({ ...base(), config: null, loading: true })
    const { rerender } = render(<ExamConfigurationScreen />)
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument()
    const empty = base(); empty.config = null; mockUseExamConfig.mockReturnValue(empty)
    rerender(<ExamConfigurationScreen />)
    expect(screen.getByText('Configuration unavailable')).toBeInTheDocument()
    const failed = base(); failed.error = 'network error'; mockUseExamConfig.mockReturnValue(failed)
    rerender(<ExamConfigurationScreen />)
    expect(screen.getByText('Exam configuration could not be loaded.')).toBeInTheDocument()
    const stale = base(); stale.updateExamConfig = vi.fn().mockResolvedValue({ data: null, error: 'stale', code: '40001', conflict: true }); mockUseExamConfig.mockReturnValue(stale)
    rerender(<ExamConfigurationScreen />)
    fireEvent.change(screen.getByLabelText('Time limit (minutes)'), { target: { value: '75' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Save configuration' }).closest('form')!)
    await waitFor(() => expect(screen.getByText(/configuration changed elsewhere/)).toBeInTheDocument())
  })
})
