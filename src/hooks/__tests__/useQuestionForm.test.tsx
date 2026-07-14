/// <reference types="vitest" />
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useQuestionForm } from '../useQuestionForm'

// ── Mock chain builder ────────────────────────────────────────
function createMockChain(resolvedData: unknown = null, resolvedError: unknown = null) {
  const chain: Record<string, any> = {}
  for (const m of ['select', 'eq', 'insert', 'update', 'delete', 'order']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockReturnValue(chain)
  chain.then = (resolve: (v: any) => any, reject?: (r: any) => any) =>
    Promise.resolve({ data: resolvedData, error: resolvedError }).then(resolve, reject)
  return chain
}

// ── Shared mock refs ──────────────────────────────────────────
const mockCreateQuestion = vi.fn().mockResolvedValue({ error: null })
const mockUpdateQuestion = vi.fn().mockResolvedValue({ error: null })
let mockFrom: ReturnType<typeof vi.fn>

vi.mock('../../lib/supabase', () => ({
  get supabase() { return { from: mockFrom } },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('../useLevels', () => ({
  useLevels: () => ({ levels: [{ id: 'l1', name: 'A1' }], loading: false }),
}))

vi.mock('../useQuestions', () => ({
  useQuestions: () => ({
    createQuestion: mockCreateQuestion,
    updateQuestion: mockUpdateQuestion,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateQuestion.mockResolvedValue({ error: null })
  mockUpdateQuestion.mockResolvedValue({ error: null })
})

// Helper: fill all option texts so validation passes
function fillOptions(result: { current: { options: { text: string }[]; updateOptionText: (i: number, v: string) => void } }) {
  result.current.options.forEach((_: any, i: number) => {
    act(() => result.current.updateOptionText(i, `Option ${i + 1}`))
  })
}

describe('useQuestionForm', () => {
  describe('create mode', () => {
    it('validates: empty text', async () => {
      mockFrom = vi.fn(() => createMockChain([], null))
      const { result } = renderHook(() => useQuestionForm('create'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as any))
      expect(result.current.fieldErrors.text).toBeDefined()
    })

    it('validates: no level selected', async () => {
      mockFrom = vi.fn(() => createMockChain([], null))
      const { result } = renderHook(() => useQuestionForm('create'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      act(() => result.current.setText('What is 2+2?'))
      await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as any))
      expect(result.current.fieldErrors.levelId).toBeDefined()
    })

    it('validates: no correct answer', async () => {
      mockFrom = vi.fn(() => createMockChain([], null))
      const { result } = renderHook(() => useQuestionForm('create'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      act(() => { result.current.setText('Q'); result.current.setLevelId('l1') })
      await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as any))
      expect(result.current.fieldErrors.correct).toBeDefined()
    })

    it('validates: empty option text', async () => {
      mockFrom = vi.fn(() => createMockChain([], null))
      const { result } = renderHook(() => useQuestionForm('create'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      act(() => { result.current.setText('Q'); result.current.setLevelId('l1'); result.current.selectCorrect(0) })
      // Options have empty text by default — validation should catch it
      await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as any))
      expect(result.current.fieldErrors.option_0).toBeDefined()
    })

    it('submit successful: calls createQuestion', async () => {
      mockFrom = vi.fn(() => createMockChain([], null))
      const { result } = renderHook(() => useQuestionForm('create'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      act(() => { result.current.setText('What is 2+2?'); result.current.setLevelId('l1'); result.current.selectCorrect(0) })
      fillOptions(result)
      await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as any))
      expect(mockCreateQuestion).toHaveBeenCalled()
      expect(result.current.generalError).toBeNull()
    })

    it('submit error: returns error', async () => {
      mockCreateQuestion.mockResolvedValue({ error: 'Supabase error' })
      mockFrom = vi.fn(() => createMockChain([], null))
      const { result } = renderHook(() => useQuestionForm('create'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      act(() => { result.current.setText('Q'); result.current.setLevelId('l1'); result.current.selectCorrect(0) })
      fillOptions(result)
      await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as any))
      expect(result.current.generalError).toBe('Supabase error')
    })
  })

  describe('edit mode', () => {
    it('fetches question data and pre-fills', async () => {
      const questionData = {
        text: 'What is 2+2?',
        level_id: 'l1',
        category: 'math',
        question_option: [
          { id: 'o1', text: '4', is_correct: true, order: 0 },
          { id: 'o2', text: '5', is_correct: false, order: 1 },
        ],
      }
      mockFrom = vi.fn(() => createMockChain(questionData, null))
      const { result } = renderHook(() => useQuestionForm('edit', 'q1'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      expect(result.current.text).toBe('What is 2+2?')
      expect(result.current.levelId).toBe('l1')
      expect(result.current.category).toBe('math')
      expect(result.current.options).toHaveLength(2)
    })

    it('sets notFound on error', async () => {
      mockFrom = vi.fn(() => createMockChain(null, { message: 'not found' }))
      const { result } = renderHook(() => useQuestionForm('edit', 'bad-id'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      expect(result.current.notFound).toBe(true)
    })

    it('submit successful: calls updateQuestion', async () => {
      const questionData = {
        text: 'Old question',
        level_id: 'l1',
        category: '',
        question_option: [
          { id: 'o1', text: 'A', is_correct: true, order: 0 },
          { id: 'o2', text: 'B', is_correct: false, order: 1 },
          { id: 'o3', text: 'C', is_correct: false, order: 2 },
          { id: 'o4', text: 'D', is_correct: false, order: 3 },
        ],
      }
      mockFrom = vi.fn(() => createMockChain(questionData, null))
      const { result } = renderHook(() => useQuestionForm('edit', 'q1'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      act(() => result.current.setText('Updated question'))
      await act(async () => result.current.handleSubmit({ preventDefault: vi.fn() } as any))
      expect(mockUpdateQuestion).toHaveBeenCalledWith('q1', expect.objectContaining({ text: 'Updated question' }))
    })
  })

  describe('option management', () => {
    it('addOption adds an option', async () => {
      mockFrom = vi.fn(() => createMockChain([], null))
      const { result } = renderHook(() => useQuestionForm('create'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      const initial = result.current.options.length
      act(() => result.current.addOption())
      expect(result.current.options).toHaveLength(initial + 1)
    })

    it('removeOption respects minimum (does not go below 4)', async () => {
      mockFrom = vi.fn(() => createMockChain([], null))
      const { result } = renderHook(() => useQuestionForm('create'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      expect(result.current.options).toHaveLength(4)
      act(() => result.current.removeOption(0))
      // Guard prevents removal below MIN_OPTIONS (4)
      expect(result.current.options).toHaveLength(4)
    })

    it('updateOptionText updates text', async () => {
      mockFrom = vi.fn(() => createMockChain([], null))
      const { result } = renderHook(() => useQuestionForm('create'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      act(() => result.current.updateOptionText(0, 'New text'))
      expect(result.current.options[0].text).toBe('New text')
    })

    it('selectCorrect marks one option as correct', async () => {
      mockFrom = vi.fn(() => createMockChain([], null))
      const { result } = renderHook(() => useQuestionForm('create'))
      await waitFor(() => expect(result.current.loadingQuestion).toBe(false))
      act(() => result.current.selectCorrect(2))
      expect(result.current.options[2].is_correct).toBe(true)
      expect(result.current.options[0].is_correct).toBe(false)
    })
  })
})
