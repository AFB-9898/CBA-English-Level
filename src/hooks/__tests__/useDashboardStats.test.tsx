/// <reference types="vitest" />
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDashboardStats } from '../useDashboardStats'

// ── Mock chain builder ────────────────────────────────────────
function createMockChain(resolvedData: unknown = null, resolvedError: unknown = null, resolvedCount: number | null = null) {
  const chain: Record<string, any> = {}
  const methods = ['select', 'eq', 'gte', 'order', 'limit']

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }

  // Make it thenable so Promise.all works
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

describe('useDashboardStats', () => {
  it('returns correct stats shape on success', async () => {
    // Build separate chains for each query
    const studentChain = createMockChain(null, null, 42)

    const examChain = createMockChain(null, null, 156)

    const todayChain = createMockChain(null, null, 8)

    const scoresChain = createMockChain([{ score: 70 }, { score: 80 }, { score: 70 }], null)

    const levelIdsChain = createMockChain(
      [{ level_id: 'l1' }, { level_id: 'l1' }, { level_id: 'l2' }],
      null,
    )

    const recentChain = createMockChain(
      [
        {
          id: 'e1',
          student: { full_name: 'Ana' },
          level: { name: 'A2' },
          score: 75,
          status: 'completed',
          completed_at: '2025-07-10T12:00:00Z',
          created_at: '2025-07-10T12:00:00Z',
        },
      ],
      null,
    )

    const levelsChain = createMockChain(
      [
        { id: 'l1', name: 'A1', min_score: 0, max_score: 30, description: null },
        { id: 'l2', name: 'A2', min_score: 31, max_score: 60, description: null },
      ],
      null,
    )

    // Track how many times from('exam') has been called
    let examCallCount = 0
    const examChains = [examChain, todayChain, scoresChain, levelIdsChain, recentChain]

    mockFrom = vi.fn((table: string) => {
      if (table === 'student') return studentChain
      if (table === 'level') return levelsChain
      if (table === 'exam') {
        const chain = examChains[examCallCount] ?? createMockChain(null, null)
        examCallCount++
        return chain
      }
      return createMockChain(null, null)
    })

    const { result } = renderHook(() => useDashboardStats())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeNull()
    expect(result.current.stats.totalStudents).toBe(42)
    expect(result.current.stats.totalExams).toBe(156)
    expect(result.current.stats.examsToday).toBe(8)
    expect(result.current.stats.avgScore).toBe(73.3) // (70+80+70)/3 = 73.333 → 73.3
    expect(result.current.recentExams).toHaveLength(1)
    expect(result.current.distribution).toHaveLength(2)
  })

  it('returns error state on Supabase failure', async () => {
    const errorChain = createMockChain(null, { message: 'connection refused' })

    mockFrom = vi.fn(() => errorChain)

    const { result } = renderHook(() => useDashboardStats())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('connection refused')
  })

  it('starts with loading state', () => {
    // Use a never-resolving chain to keep loading=true
    const pendingChain: Record<string, any> = {}
    const methods = ['select', 'eq', 'gte', 'order', 'limit']
    for (const method of methods) {
      pendingChain[method] = vi.fn().mockReturnValue(pendingChain)
    }
    pendingChain.then = () => new Promise(() => {}) // never resolves

    mockFrom = vi.fn(() => pendingChain)

    const { result } = renderHook(() => useDashboardStats())

    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })
})
