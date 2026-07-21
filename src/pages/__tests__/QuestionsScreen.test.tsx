/// <reference types="vitest" />
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import QuestionsScreen from '../QuestionsScreen'

// ── Mock useQuestions ─────────────────────────────────────────
vi.mock('../../hooks/useQuestions', () => ({
  useQuestions: vi.fn(),
}))

// ── Mock useLevels ────────────────────────────────────────────
vi.mock('../../hooks/useLevels', () => ({
  useLevels: vi.fn(),
}))

vi.mock('../../components/organisms/QuestionForm', () => ({
  default: ({ mode, questionId }: { mode: string, questionId?: string }) => (
    <div data-testid="question-form">{mode}:{questionId ?? ''}</div>
  ),
}))

import { useQuestions } from '../../hooks/useQuestions'
import { useLevels } from '../../hooks/useLevels'

const mockUseQuestions = vi.mocked(useQuestions)
const mockUseLevels = vi.mocked(useLevels)

beforeEach(() => {
  vi.clearAllMocks()
})

function LocationDisplay() {
  const { pathname } = useLocation()

  return <output data-testid="location">{pathname}</output>
}

function renderScreen(initialEntries = ['/admin/questions']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QuestionsScreen />
      <LocationDisplay />
    </MemoryRouter>,
  )
}

describe('QuestionsScreen', () => {
  it('renders title and new question button', () => {
    mockUseQuestions.mockReturnValue({
      questions: [],
      total: 0,
      loading: false,
      error: null,
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
      refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })

    renderScreen()
    expect(screen.getByText('Question Bank')).toBeInTheDocument()
    expect(screen.getByText('New Question')).toBeInTheDocument()
  })

  it('renders the create form for the direct new-question URL', () => {
    mockUseQuestions.mockReturnValue({
      questions: [], total: 0, loading: false, error: null,
      createQuestion: vi.fn(), updateQuestion: vi.fn(), deleteQuestion: vi.fn(), refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })

    renderScreen(['/admin/questions/new'])

    expect(screen.getByTestId('question-form')).toHaveTextContent('create:')
  })

  it('renders the edit form for the direct edit-question URL', () => {
    mockUseQuestions.mockReturnValue({
      questions: [], total: 0, loading: false, error: null,
      createQuestion: vi.fn(), updateQuestion: vi.fn(), deleteQuestion: vi.fn(), refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })

    renderScreen(['/admin/questions/question-1/edit'])

    expect(screen.getByTestId('question-form')).toHaveTextContent('edit:question-1')
  })

  it('navigates to the create form when New Question is clicked', async () => {
    mockUseQuestions.mockReturnValue({
      questions: [], total: 0, loading: false, error: null,
      createQuestion: vi.fn(), updateQuestion: vi.fn(), deleteQuestion: vi.fn(), refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })
    const user = userEvent.setup()

    renderScreen()
    await user.click(screen.getByText('New Question'))

    expect(screen.getByTestId('location')).toHaveTextContent('/admin/questions/new')
    expect(screen.getByTestId('question-form')).toHaveTextContent('create:')
  })

  it('navigates to the edit form when Edit is clicked', async () => {
    mockUseQuestions.mockReturnValue({
      questions: [{
        id: 'question-1', text: 'Test question', level_id: 'l1', category: null,
        created_at: '2025-07-10T12:00:00Z', updated_at: '2025-07-10T12:00:00Z',
        level: { id: 'l1', name: 'A1', min_score: 0, max_score: 30, description: null },
      }],
      total: 1, loading: false, error: null,
      createQuestion: vi.fn(), updateQuestion: vi.fn(), deleteQuestion: vi.fn(), refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })
    const user = userEvent.setup()

    renderScreen()
    await user.click(screen.getAllByText('Edit')[0])

    expect(screen.getByTestId('location')).toHaveTextContent('/admin/questions/question-1/edit')
    expect(screen.getByTestId('question-form')).toHaveTextContent('edit:question-1')
  })

  it('shows empty state when no questions', () => {
    mockUseQuestions.mockReturnValue({
      questions: [],
      total: 0,
      loading: false,
      error: null,
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
      refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })

    renderScreen()
    expect(screen.getByText('No questions registered yet')).toBeInTheDocument()
  })

  it('renders questions in both table and card views', () => {
    mockUseQuestions.mockReturnValue({
      questions: [
        {
          id: 'q1',
          text: 'What is 2+2?',
          level_id: 'l1',
          category: 'math',
          created_at: '2025-07-10T12:00:00Z',
          updated_at: '2025-07-10T12:00:00Z',
          level: { id: 'l1', name: 'A1', min_score: 0, max_score: 30, description: null },
        },
      ],
      total: 1,
      loading: false,
      error: null,
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
      refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })

    renderScreen()

    // Text appears twice: once in table row, once in card
    const textElements = screen.getAllByText('What is 2+2?')
    expect(textElements.length).toBe(2)

    // Level appears in both views
    const levelElements = screen.getAllByText('A1')
    expect(levelElements.length).toBe(2)
  })

  it('shows error message when hook returns an error', () => {
    mockUseQuestions.mockReturnValue({
      questions: [],
      total: 0,
      loading: false,
      error: 'connection refused',
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
      refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })

    renderScreen()
    expect(screen.getByText('Failed to load questions')).toBeInTheDocument()
    expect(screen.getByText('connection refused')).toBeInTheDocument()
  })

  it('renders skeleton when loading', () => {
    mockUseQuestions.mockReturnValue({
      questions: [],
      total: 0,
      loading: true,
      error: null,
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
      refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })

    const { container } = renderScreen()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders filter bar with level dropdown and category input', () => {
    mockUseQuestions.mockReturnValue({
      questions: [],
      total: 0,
      loading: false,
      error: null,
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
      refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({
      levels: [
        { id: 'l1', name: 'A1', min_score: 0, max_score: 30, description: null },
        { id: 'l2', name: 'B1', min_score: 31, max_score: 60, description: null },
      ],
      loading: false,
      error: null,
    })

    renderScreen()
    expect(screen.getByText('Select a level')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('B1')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. grammar, vocabulary')).toBeInTheDocument()
  })

  it('shows pagination when totalPages > 1', () => {
    mockUseQuestions.mockReturnValue({
      questions: Array.from({ length: 10 }, (_, i) => ({
        id: `q${i}`,
        text: `Question ${i}`,
        level_id: 'l1',
        category: null,
        created_at: '2025-07-10T12:00:00Z',
        updated_at: '2025-07-10T12:00:00Z',
        level: { id: 'l1', name: 'A1', min_score: 0, max_score: 30, description: null },
      })),
      total: 25,
      loading: false,
      error: null,
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
      refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })

    renderScreen()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
    expect(screen.getByText('Previous')).toBeInTheDocument()
  })

  describe('delete flow', () => {
    function mockQuestionWithDelete(del: any) {
      mockUseQuestions.mockReturnValue({
        questions: [{
          id: 'q1', text: 'Test question', level_id: 'l1', category: null,
          created_at: '2025-07-10T12:00:00Z', updated_at: '2025-07-10T12:00:00Z',
          level: { id: 'l1', name: 'A1', min_score: 0, max_score: 30, description: null },
        }],
        total: 1, loading: false, error: null,
        createQuestion: vi.fn(), updateQuestion: vi.fn(), deleteQuestion: del, refetch: vi.fn(),
      })
      mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })
    }

    it('shows FK error when delete returns code 23503', async () => {
      mockQuestionWithDelete(vi.fn().mockResolvedValue({ error: 'FK violation', code: '23503' }))
      const spy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      renderScreen()
      screen.getAllByText('Delete')[0].click()
      await vi.waitFor(() => {
        expect(screen.getByText('Cannot delete: this question is linked to existing exams')).toBeInTheDocument()
      })
      spy.mockRestore()
    })

    it('does not delete when confirm is cancelled', () => {
      const del = vi.fn()
      mockQuestionWithDelete(del)
      const spy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderScreen()
      screen.getAllByText('Delete')[0].click()
      expect(del).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('calls deleteQuestion on confirm', () => {
      const del = vi.fn().mockResolvedValue({ error: null })
      mockQuestionWithDelete(del)
      const spy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      renderScreen()
      screen.getAllByText('Delete')[0].click()
      expect(del).toHaveBeenCalledWith('q1')
      spy.mockRestore()
    })
  })

  it('disables Previous button on first page', () => {
    mockUseQuestions.mockReturnValue({
      questions: Array.from({ length: 10 }, (_, i) => ({
        id: `q${i}`,
        text: `Question ${i}`,
        level_id: 'l1',
        category: null,
        created_at: '2025-07-10T12:00:00Z',
        updated_at: '2025-07-10T12:00:00Z',
        level: { id: 'l1', name: 'A1', min_score: 0, max_score: 30, description: null },
      })),
      total: 25,
      loading: false,
      error: null,
      createQuestion: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
      refetch: vi.fn(),
    })
    mockUseLevels.mockReturnValue({ levels: [], loading: false, error: null })

    renderScreen()
    const prevBtn = screen.getByText('Previous')
    expect(prevBtn).toBeDisabled()
  })
})
