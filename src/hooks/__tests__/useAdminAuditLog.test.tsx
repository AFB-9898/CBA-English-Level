import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminAuditLog } from '../useAdminAuditLog'
import type { AdminAuditFilters } from '../../types'

const filters: AdminAuditFilters = { createdFrom: '2026-07-01', createdTo: '2026-07-31', adminId: 'admin-1', entity: 'question', action: 'edit' }
const rows = [
  { audit_id: 'audit-3', created_at: '2026-07-03T12:00:00Z', actor_id: 'admin-1', actor_display_name: 'Ada Admin', action: 'edit', entity: 'question', entity_id: 'question-1', summary: 'Updated question' },
  { audit_id: 'audit-2', created_at: '2026-07-02T12:00:00Z', actor_id: 'admin-1', actor_display_name: 'Ada Admin', action: 'edit', entity: 'question', entity_id: 'question-2', summary: 'Updated question' },
  { audit_id: 'audit-1', created_at: '2026-07-01T12:00:00Z', actor_id: 'admin-1', actor_display_name: 'Ada Admin', action: 'edit', entity: 'question', entity_id: 'question-3', summary: 'Updated question' },
]

let rpc: ReturnType<typeof vi.fn>
vi.mock('../../lib/supabase', () => ({ get supabase() { return { rpc } } }))

beforeEach(() => { vi.clearAllMocks(); rpc = vi.fn().mockImplementation((name: string) => name === 'get_admin_audit_actors' ? Promise.resolve({ data: [{ admin_id: 'admin-1', display_name: 'Ada Admin' }], error: null }) : Promise.resolve({ data: rows, error: null })) })

describe('useAdminAuditLog', () => {
  it('loads the authorized projection with filters and obtains safe actor choices', async () => {
    const { result } = renderHook(() => useAdminAuditLog(filters, 2))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toEqual(rows.slice(0, 2))
    expect(result.current.actors).toEqual([{ admin_id: 'admin-1', display_name: 'Ada Admin' }])
    expect(rpc).toHaveBeenCalledWith('get_admin_audit_log', { p_created_from: '2026-07-01', p_created_to: '2026-07-31', p_admin_id: 'admin-1', p_entity: 'question', p_action: 'edit', p_cursor_created_at: null, p_cursor_id: null, p_page_size: 3 })
  })

  it('uses the last projected row as the keyset cursor for the next page', async () => {
    rpc.mockImplementation((name: string, params?: Record<string, unknown>) => {
      if (name === 'get_admin_audit_actors') return Promise.resolve({ data: [], error: null })
      if (params?.p_cursor_id === 'audit-2') return Promise.resolve({ data: [rows[2]], error: null })
      return Promise.resolve({ data: rows, error: null })
    })
    const { result } = renderHook(() => useAdminAuditLog(filters, 2))
    await waitFor(() => expect(result.current.hasNextPage).toBe(true))
    await act(async () => result.current.loadNextPage())
    expect(rpc).toHaveBeenLastCalledWith('get_admin_audit_log', expect.objectContaining({ p_cursor_created_at: '2026-07-02T12:00:00Z', p_cursor_id: 'audit-2', p_page_size: 3 }))
    expect(result.current.rows).toEqual(rows)
  })
})
