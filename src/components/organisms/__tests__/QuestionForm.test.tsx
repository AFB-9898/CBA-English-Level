/// <reference types="vitest" />
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import QuestionForm from '../QuestionForm'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const mockUseQuestionForm = vi.fn()
vi.mock('../../../hooks/useQuestionForm', () => ({
  useQuestionForm: (...a: any[]) => mockUseQuestionForm(...a),
}))

const baseFormState = {
  text: '', setText: vi.fn(), levelId: '', setLevelId: vi.fn(),
  category: '', setCategory: vi.fn(),
  options: [
    { text: '', is_correct: false }, { text: '', is_correct: false },
    { text: '', is_correct: false }, { text: '', is_correct: false },
  ],
  fieldErrors: {} as Record<string, string>, generalError: null,
  submitting: false, loadingQuestion: false, notFound: false,
  levels: [{ id: 'l1', name: 'A1' }], levelsLoading: false,
  addOption: vi.fn(), removeOption: vi.fn(),
  updateOptionText: vi.fn(), selectCorrect: vi.fn(), handleSubmit: vi.fn(),
}

function renderForm(mode: 'create' | 'edit' = 'create') {
  return render(
    <MemoryRouter>
      <QuestionForm mode={mode} />
    </MemoryRouter>,
  )
}

describe('QuestionForm', () => {
  it('renders loading state', () => {
    mockUseQuestionForm.mockReturnValue({ ...baseFormState, loadingQuestion: true })
    renderForm('edit')
    expect(screen.getByText('questions.form.loadingQuestion')).toBeInTheDocument()
  })

  it('renders not-found state', () => {
    mockUseQuestionForm.mockReturnValue({ ...baseFormState, notFound: true })
    renderForm('edit')
    expect(screen.getByText('questions.form.notFound')).toBeInTheDocument()
  })

  it('renders create form with all fields', () => {
    mockUseQuestionForm.mockReturnValue(baseFormState)
    renderForm('create')
    expect(screen.getByText('questions.form.createTitle')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('questions.form.questionTextPlaceholder')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('questions.form.category')).toBeInTheDocument()
    expect(screen.getByText('questions.form.save')).toBeInTheDocument()
  })

  it('renders edit title in edit mode', () => {
    mockUseQuestionForm.mockReturnValue(baseFormState)
    renderForm('edit')
    expect(screen.getByText('questions.form.editTitle')).toBeInTheDocument()
  })

  it('shows general error when present', () => {
    mockUseQuestionForm.mockReturnValue({ ...baseFormState, generalError: 'Something went wrong' })
    renderForm()
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('shows validation error for text field', () => {
    mockUseQuestionForm.mockReturnValue({ ...baseFormState, fieldErrors: { text: 'Text is required' } })
    renderForm()
    expect(screen.getByText('Text is required')).toBeInTheDocument()
  })

  it('renders back link to list', () => {
    mockUseQuestionForm.mockReturnValue(baseFormState)
    renderForm()
    expect(screen.getByText(/questions\.form\.backToList/)).toBeInTheDocument()
  })
})
