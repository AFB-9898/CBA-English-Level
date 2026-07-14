/// <reference types="vitest" />
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLevels } from '../useLevels'

// ── Mock chain builder ────────────────────────────────────────
function createMockChain(
  resolvedData: unknown = null,
  resolvedError: unknown = null,
  resolvedCount: number | null = null,
) {
  const chain: Record<string, any> = {}
  const methods = ['select', 'order']

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }

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

describe('useLevels', () => {
  it('returns levels with correct shape on success', async () => {
    const levelsData = [
      { id: 'l1', name: 'A1', min_score: 0, max_score: 30, description: null },
      { id: 'l2', name: 'A2', min_score: 31, max_score: 60, description: null },
    ]

    const selectChain = createMockChain(levelsData, null)

    mockFrom = vi.fn(() => selectChain)

    const { result } = renderHook(() => useLevels())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeNull()
    expect(result.current.levels).toHaveLength(2)
    expect(result.current.levels[0].name).toBe('A1')
    expect(result.current.levels[1].name).toBe('A2')
  })

  it('returns error state on network failure', async () => {
    const errorChain = createMockChain(null, { message: 'network error' })

    mockFrom = vi.fn(() => errorChain)

    const { result } = renderHook(() => useLevels())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('network error')
    expect(result.current.levels).toHaveLength(0)
  })

  it('starts with loading state', () => {
    const pendingChain: Record<string, any> = {}
    const methods = ['select', 'order']
    for (const method of methods) {
      pendingChain[method] = vi.fn().mockReturnValue(pendingChain)
    }
    pendingChain.then = () => new Promise(() => {})

    mockFrom = vi.fn(() => pendingChain)

    const { result } = renderHook(() => useLevels())

    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })
})
