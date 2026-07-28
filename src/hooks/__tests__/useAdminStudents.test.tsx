import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminStudents } from '../useAdminStudents'

const rows = [
  { student_id: 'student-1', full_name: 'Ada Student', ci: 'CI-1', email: 'ada@test.local', created_at: '2026-07-01T00:00:00Z' },
  { student_id: 'student-2', full_name: 'Bea Student', ci: 'CI-2', email: 'bea@test.local', created_at: '2026-07-02T00:00:00Z' },
  { student_id: 'student-3', full_name: 'Cia Student', ci: 'CI-3', email: 'cia@test.local', created_at: '2026-07-03T00:00:00Z' },
]

let rpc: ReturnType<typeof vi.fn>
vi.mock('../../lib/supabase', () => ({ get supabase() { return { rpc } } }))

beforeEach(() => {
  vi.clearAllMocks()
  rpc = vi.fn().mockImplementation((_name: string, params?: Record<string, unknown>) => Promise.resolve({ data: params?.p_cursor_id === 'student-2' ? [rows[2]] : rows, error: null }))
})

describe('useAdminStudents', () => {
  it('requests the safe paged projection with a normalized search query', async () => {
    const { result } = renderHook(() => useAdminStudents(' ada ', 2))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.students).toEqual(rows.slice(0, 2))
    expect(rpc).toHaveBeenCalledWith('get_admin_students', { p_search: 'ada', p_cursor_full_name: null, p_cursor_id: null, p_page_size: 3 })
  })

  it('uses the final projected row as the next keyset cursor', async () => {
    const { result } = renderHook(() => useAdminStudents('', 2))
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(async () => result.current.loadNextPage())
    expect(rpc).toHaveBeenLastCalledWith('get_admin_students', { p_search: null, p_cursor_full_name: 'Bea Student', p_cursor_id: 'student-2', p_page_size: 3 })
    expect(result.current.students).toEqual(rows)
  })
})
