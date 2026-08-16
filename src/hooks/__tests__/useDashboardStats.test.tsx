/// <reference types="vitest" />
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDashboardStats } from '../useDashboardStats'

let rpc: ReturnType<typeof vi.fn>

vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return { rpc }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useDashboardStats', () => {
  it('loads and maps the dashboard through one RPC', async () => {
    rpc = vi.fn().mockResolvedValue({ data: {
      totals: { students: 42, exams: 156 },
      completed_today: 8,
      completed_score_average: 73.3,
      level_distribution: [{ level_id: 'l1', name: 'A1', count: 2, percentage: 67 }],
      recent_completed: [{ id: 'e1', student_full_name: 'Ana', level_name: 'A2', score: 75, completed_at: '2025-07-10T12:00:00Z' }],
    }, error: null })

    const { result } = renderHook(() => useDashboardStats())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeNull()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('get_admin_dashboard_statistics')
    expect(result.current.stats).toEqual({ totalStudents: 42, totalExams: 156, examsToday: 8, avgScore: 73.3 })
    expect(result.current.recentExams).toHaveLength(1)
    expect(result.current.recentExams[0]).toMatchObject({ student: { full_name: 'Ana' }, level: { name: 'A2' }, status: 'completed' })
    expect(result.current.distribution).toEqual([{ level_id: 'l1', name: 'A1', count: 2, percentage: 67 }])
  })

  it('returns error state on Supabase failure', async () => {
    rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'connection refused' } })

    const { result } = renderHook(() => useDashboardStats())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('connection refused')
  })

  it('starts with loading state', () => {
    rpc = vi.fn(() => new Promise(() => {}))

    const { result } = renderHook(() => useDashboardStats())

    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
  })
})
