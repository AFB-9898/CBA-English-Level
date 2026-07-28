import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import AdminStudentsScreen from '../AdminStudentsScreen'
import { useAdminStudents } from '../../hooks/useAdminStudents'

vi.mock('../../hooks/useAdminStudents', () => ({ useAdminStudents: vi.fn() }))
const mockUseAdminStudents = vi.mocked(useAdminStudents)

function base(): ReturnType<typeof useAdminStudents> {
  return { students: [{ student_id: 'student-1', full_name: 'Ada Student', ci: 'CI-1', email: 'ada@test.local', created_at: '2026-07-01T00:00:00Z' }], loading: false, loadingNextPage: false, error: null, hasNextPage: true, loadNextPage: vi.fn(), refetch: vi.fn() }
}

beforeEach(() => { vi.clearAllMocks(); mockUseAdminStudents.mockReturnValue(base()) })

describe('AdminStudentsScreen', () => {
  it('renders a searchable student projection and links only to detail', async () => {
    render(<BrowserRouter><AdminStudentsScreen /></BrowserRouter>)
    expect(screen.getAllByText('Ada Student')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'View profile' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'View profile' })[0]).toHaveAttribute('href', '/admin/students/student-1')
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search students'), { target: { value: 'ada' } })
    await waitFor(() => expect(mockUseAdminStudents).toHaveBeenLastCalledWith('ada'))
  })

  it('shows load errors and requests the next page', () => {
    const state = base()
    mockUseAdminStudents.mockReturnValue({ ...state, error: 'denied' })
    render(<BrowserRouter><AdminStudentsScreen /></BrowserRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load student data.')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(state.loadNextPage).toHaveBeenCalled()
  })
})
