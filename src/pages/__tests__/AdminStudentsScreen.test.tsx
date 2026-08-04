import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import AdminStudentsScreen from '../AdminStudentsScreen'
import i18n from '../../i18n'

let rpc: ReturnType<typeof vi.fn>

vi.mock('../../lib/supabase', () => ({
  get supabase() { return { rpc } },
}))

beforeEach(async () => {
  vi.clearAllMocks()
  await i18n.changeLanguage('en')
  rpc = vi.fn().mockResolvedValue({
    data: [{ student_id: 'student-1', full_name: 'Ada Student', ci: 'CI-1', email: 'ada@test.local', created_at: '2026-07-01T00:00:00Z' }],
    error: null,
  })
})

describe('AdminStudentsScreen', () => {
  it('renders students returned by the admin student RPC', async () => {
    render(<BrowserRouter><AdminStudentsScreen /></BrowserRouter>)
    expect(await screen.findAllByText('Ada Student')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'View profile' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'View profile' })[0]).toHaveAttribute('href', '/admin/students/student-1')
    expect(rpc).toHaveBeenCalledWith('get_admin_students', {
      p_search: null,
      p_cursor_full_name: null,
      p_cursor_id: null,
      p_page_size: 26,
    })
  })

  it('shows the translated error and retry state instead of empty content when the admin student RPC fails', async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'RPC unavailable' } })
      .mockResolvedValueOnce({
        data: [{ student_id: 'student-1', full_name: 'Ada Student', ci: 'CI-1', email: 'ada@test.local', created_at: '2026-07-01T00:00:00Z' }],
        error: null,
      })
    const user = userEvent.setup()

    render(<BrowserRouter><AdminStudentsScreen /></BrowserRouter>)

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load student data.')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    expect(screen.queryByText('No students match this search.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findAllByText('Ada Student')).toHaveLength(2)
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('shows the empty state when the admin student RPC returns no students', async () => {
    rpc.mockResolvedValue({ data: [], error: null })

    render(<BrowserRouter><AdminStudentsScreen /></BrowserRouter>)

    expect(await screen.findAllByText('No students match this search.')).toHaveLength(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
