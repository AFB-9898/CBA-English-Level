import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAuditLogScreen from '../AdminAuditLogScreen'
import { useAdminAuditLog } from '../../hooks/useAdminAuditLog'

vi.mock('../../hooks/useAdminAuditLog', () => ({ useAdminAuditLog: vi.fn() }))
const mockUseAdminAuditLog = vi.mocked(useAdminAuditLog)
const rows = [{ audit_id: 'audit-1', created_at: '2026-07-10T12:00:00Z', actor_id: 'admin-1', actor_display_name: 'Ada Admin', action: 'answer_change', entity: 'question_option', entity_id: 'option-1', summary: 'Changed correct answer' }]

function base(): ReturnType<typeof useAdminAuditLog> {
  return { rows, actors: [{ admin_id: 'admin-1', display_name: 'Ada Admin' }], loading: false, loadingNextPage: false, error: null, hasNextPage: true, loadNextPage: vi.fn(), refetch: vi.fn() }
}

beforeEach(() => { vi.clearAllMocks(); mockUseAdminAuditLog.mockReturnValue(base()) })

describe('AdminAuditLogScreen', () => {
  it('renders safe projected rows and all required filters without raw details', () => {
    render(<AdminAuditLogScreen />)
    expect(screen.getAllByText('Changed correct answer')).toHaveLength(2)
    expect(screen.getByLabelText('Administrator')).toHaveValue('')
    expect(screen.getByLabelText('Entity')).toHaveValue('')
    expect(screen.queryByText('before')).not.toBeInTheDocument()
  })

  it('passes filter changes to the hook and requests the next keyset page', async () => {
    const auditHook = base()
    mockUseAdminAuditLog.mockReturnValue(auditHook)
    render(<AdminAuditLogScreen />)
    fireEvent.change(screen.getByLabelText('Entity'), { target: { value: 'question' } })
    await waitFor(() => expect(mockUseAdminAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ entity: 'question' })))
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(auditHook.loadNextPage).toHaveBeenCalled()
  })

  it('shows errors and empty results', () => {
    mockUseAdminAuditLog.mockReturnValue({ ...base(), rows: [], error: 'denied', hasNextPage: false })
    render(<AdminAuditLogScreen />)
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load the audit timeline.')
    expect(screen.getAllByText('No audit events match these filters.')).toHaveLength(2)
  })
})
