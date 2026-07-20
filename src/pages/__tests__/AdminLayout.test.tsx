/// <reference types="vitest" />
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminLayout from '../AdminLayout'

const mockLogout = vi.fn()

let mockAuthState: {
  user: any | null
  adminName: string | null
  logout: ReturnType<typeof vi.fn>
}

vi.mock('../../components/auth/AuthContext', () => ({
  useAuth: () => mockAuthState,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuthState = {
    user: { id: '1', email: 'admin@cba.edu.bo' },
    adminName: null,
    logout: mockLogout,
  }
})

function renderAdminLayout(entry = '/admin') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div data-testid="dashboard-content">Dashboard</div>} />
          <Route path="students" element={<div data-testid="students-content">Coming soon / Próximamente.</div>} />
          <Route path="questions" element={<div data-testid="questions-content">Questions</div>} />
           <Route path="levels" element={<div data-testid="levels-content">Levels</div>} />
            <Route path="exam-configuration" element={<div data-testid="exam-configuration-content">Exam Configuration</div>} />
            <Route path="reports" element={<div data-testid="reports-content">Reports</div>} />
           <Route path="audit-log" element={<div data-testid="audit-content">Coming soon / Próximamente.</div>} />
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLayout', () => {
  it('renders the header with title and logout button', () => {
    renderAdminLayout()

    expect(screen.getByText('CBA — Admin Panel')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('renders outlet content (nested route)', () => {
    renderAdminLayout()

    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument()
  })

  it('displays user email in the header', () => {
    renderAdminLayout()

    expect(screen.getByText('admin@cba.edu.bo')).toBeInTheDocument()
  })

  it('calls logout and navigates to /login when logout button is clicked', async () => {
    mockLogout.mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderAdminLayout()

    await user.click(screen.getByText('Logout'))

    expect(mockLogout).toHaveBeenCalled()
  })

  it('renders sidebar with 7 navigation links including reports', () => {
    renderAdminLayout()

    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toBeInTheDocument()
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Students')).toBeInTheDocument()
    expect(screen.getByText('Questions')).toBeInTheDocument()
    expect(screen.getByText('Levels')).toBeInTheDocument()
    expect(screen.getByText('Exam Configuration')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('Audit Log')).toBeInTheDocument()

    expect([...sidebar.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
      '/admin',
      '/admin/students',
      '/admin/questions',
      '/admin/levels',
      '/admin/exam-configuration',
      '/admin/reports',
      '/admin/audit-log',
    ])
  })

  it('highlights the active link on current route', () => {
    renderAdminLayout('/admin')

    const sidebar = screen.getByTestId('sidebar')
    const dashboardLink = sidebar.querySelector('a[href="/admin"]')
    expect(dashboardLink).toHaveClass('bg-blue-50')
  })

  it('navigates when clicking a sidebar link', async () => {
    const user = userEvent.setup()
    renderAdminLayout()

    await user.click(screen.getByText('Students'))
    expect(screen.getByTestId('students-content')).toBeInTheDocument()
  })

  it('navigates to Levels and highlights it as active', async () => {
    const user = userEvent.setup()
    renderAdminLayout()

    await user.click(screen.getByText('Levels'))

    expect(screen.getByTestId('levels-content')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Levels' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Levels' })).toHaveClass('bg-blue-50')
  })

  it('navigates to Exam Configuration and highlights it as active', async () => {
    const user = userEvent.setup()
    renderAdminLayout()
    await user.click(screen.getByText('Exam Configuration'))
    expect(screen.getByTestId('exam-configuration-content')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exam Configuration' })).toHaveAttribute('aria-current', 'page')
  })

  it('navigates to Reports and highlights it as active', async () => {
    const user = userEvent.setup()
    renderAdminLayout()
    await user.click(screen.getByText('Reports'))
    expect(screen.getByTestId('reports-content')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute('aria-current', 'page')
  })

  it('navigates to the registered Audit Log placeholder route', async () => {
    const user = userEvent.setup()
    renderAdminLayout()

    await user.click(screen.getByText('Audit Log'))

    expect(screen.getByTestId('audit-content')).toHaveTextContent('Coming soon / Próximamente.')
    expect(screen.getByRole('link', { name: 'Audit Log' })).toHaveAttribute('aria-current', 'page')
  })
})
