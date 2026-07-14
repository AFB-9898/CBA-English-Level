/// <reference types="vitest" />
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useQuestions } from '../useQuestions'

// ── Mock chain builder ────────────────────────────────────────
function createMockChain(
  resolvedData: unknown = null,
  resolvedError: unknown = null,
  resolvedCount: number | null = null,
) {
  const chain: Record<string, any> = {}
  const methods = ['select', 'eq', 'ilike', 'order', 'range', 'insert', 'update', 'delete']

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }

  // Single returns a chain that resolves to a single object
  chain.single = vi.fn().mockReturnValue(chain)

  chain.then = function (
    resolve: (value: { data: unknown; error: unknown; count: number | null }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) {
    const result = { data: resolvedData, error: resolvedError, count: resolvedCount }
    return Promise.resolve(result).then(resolve, reject)
  }

  return chain
}

// ── Mock supabase ─────────────────────────────────────────────
let mockFrom: ReturnType<typeof vi.fn>

vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return { from: mockFrom }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useQuestions', () => {
  it('returns questions with correct shape on success', async () => {
    const questionsData = [
      {
        id: 'q1',
        text: 'What is 2+2?',
        level_id: 'l1',
        category: 'math',
        created_at: '2025-07-10T12:00:00Z',
        updated_at: '2025-07-10T12:00:00Z',
        level: { id: 'l1', name: 'A1', min_score: 0, max_score: 30, description: null },
      },
    ]

    const selectChain = createMockChain(questionsData, null, 1)

    mockFrom = vi.fn(() => selectChain)

    const { result } = renderHook(() => useQuestions())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeNull()
    expect(result.current.questions).toHaveLength(1)
    expect(result.current.total).toBe(1)
    expect(result.current.questions[0].level?.name).toBe('A1')
  })

  it('returns error state on Supabase failure', async () => {
    const errorChain = createMockChain(null, { message: 'connection refused' })

    mockFrom = vi.fn(() => errorChain)

    const { result } = renderHook(() => useQuestions())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('connection refused')
    expect(result.current.questions).toHaveLength(0)
  })

  it('starts with loading state', () => {
    const pendingChain: Record<string, any> = {}
    const methods = ['select', 'eq', 'ilike', 'order', 'range']
    for (const method of methods) {
      pendingChain[method] = vi.fn().mockReturnValue(pendingChain)
    }
    pendingChain.then = () => new Promise(() => {})

    mockFrom = vi.fn(() => pendingChain)

    const { result } = renderHook(() => useQuestions())

    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('applies level filter when levelId is provided', async () => {
    const selectChain = createMockChain([], null, 0)

    mockFrom = vi.fn(() => selectChain)

    const { result } = renderHook(() => useQuestions({ levelId: 'l2' }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Verify eq was called with level_id filter
    expect(selectChain.eq).toHaveBeenCalledWith('level_id', 'l2')
  })

  it('applies category filter when category is provided', async () => {
    const selectChain = createMockChain([], null, 0)

    mockFrom = vi.fn(() => selectChain)

    const { result } = renderHook(() => useQuestions({ category: 'grammar' }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(selectChain.ilike).toHaveBeenCalledWith('category', '%grammar%')
  })

  it('createQuestion inserts question and options', async () => {
    const insertChain = createMockChain({ id: 'q-new' }, null)
    const optionsInsertChain = createMockChain(null, null)

    mockFrom = vi.fn((table: string) => {
      if (table === 'question') return insertChain
      if (table === 'question_option') return optionsInsertChain
      return createMockChain(null, null)
    })

    const { result } = renderHook(() => useQuestions())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let response: { error: string | null } | undefined
    await act(async () => {
      response = await result.current.createQuestion({
        text: 'New question?',
        level_id: 'l1',
        category: 'test',
        options: [
          { text: 'Option A', is_correct: true },
          { text: 'Option B', is_correct: false },
        ],
      })
    })

    expect(response!.error).toBeNull()
    expect(insertChain.insert).toHaveBeenCalled()
    expect(optionsInsertChain.insert).toHaveBeenCalled()
  })

  it('deleteQuestion removes question by id', async () => {
    const deleteChain = createMockChain(null, null)
    const selectChain = createMockChain([], null, 0)

    mockFrom = vi.fn((table: string) => {
      if (table === 'question') {
        // First call: select for list; second call: delete
        if (deleteChain.delete.mock.calls.length > 0) return selectChain
        return deleteChain
      }
      return createMockChain(null, null)
    })

    const { result } = renderHook(() => useQuestions())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let response: { error: string | null } | undefined
    await act(async () => {
      response = await result.current.deleteQuestion('q1')
    })

    expect(response!.error).toBeNull()
  })

  it('refetch triggers a re-fetch of data', async () => {
    const selectChain = createMockChain([], null, 0)

    mockFrom = vi.fn(() => selectChain)

    const { result } = renderHook(() => useQuestions())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Call refetch
    act(() => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // select should have been called at least twice (initial + refetch)
    expect(selectChain.select).toHaveBeenCalledTimes(2)
  })
})
