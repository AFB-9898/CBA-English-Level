/// <reference types="vitest" />
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import i18n from '../../i18n'
import AdminLayout from '../AdminLayout'
import AdminStudentsScreen from '../AdminStudentsScreen'

const mockLogout = vi.fn()
let rpc: ReturnType<typeof vi.fn>

let mockAuthState: {
  user: any | null
  adminName: string | null
  hasCapability: (capability: string) => boolean
  logout: ReturnType<typeof vi.fn>
}

vi.mock('../../components/auth/AuthContext', () => ({
  useAuth: () => mockAuthState,
}))

vi.mock('../../lib/supabase', () => ({
  get supabase() { return { rpc } },
}))

beforeEach(async () => {
  vi.clearAllMocks()
  rpc = vi.fn().mockResolvedValue({ data: [], error: null })
  await i18n.changeLanguage('en')
  mockAuthState = {
    user: { id: '1', email: 'admin@cba.edu.bo' },
    adminName: null,
    logout: mockLogout,
    hasCapability: (capability) => capability === 'administrator_management',
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderAdminLayout(entry = '/admin') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div data-testid="dashboard-content">Dashboard</div>} />
          <Route path="students" element={<AdminStudentsScreen />} />
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
    expect(screen.getByRole('img', { name: 'CBA Tarija, Bolivia and Tarija flags' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('renders outlet content (nested route)', () => {
    renderAdminLayout()

    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument()
  })

  it('uses Spanish labels for the mobile menu button', async () => {
    await i18n.changeLanguage('es')
    const user = userEvent.setup()

    renderAdminLayout()

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }))

    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toBeInTheDocument()
    expect(screen.getByTestId('mobile-menu-backdrop')).toHaveClass('z-20')
  })

  it('removes closed mobile navigation from the focus order and restores it when opened', async () => {
    const user = userEvent.setup()
    renderAdminLayout()

    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toHaveAttribute('inert')

    await user.click(screen.getByRole('button', { name: 'Open menu' }))

    expect(sidebar).not.toHaveAttribute('inert')
  })

  it('keeps desktop navigation available when the mobile menu is closed', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    renderAdminLayout()

    expect(screen.getByTestId('sidebar')).not.toHaveAttribute('inert')
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

  it('shows localized feedback and allows retrying when logout fails', async () => {
    mockLogout.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(undefined)
    await i18n.changeLanguage('es')
    const user = userEvent.setup()

    renderAdminLayout()

    await user.click(screen.getByText('Cerrar sesión'))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cerrar sesión. Intentá de nuevo.')
    await user.click(screen.getByRole('button', { name: 'Intentar de nuevo' }))

    expect(mockLogout).toHaveBeenCalledTimes(2)
    expect(await screen.findByTestId('login-page')).toBeInTheDocument()
  })

  it('renders the master-only Administrators item immediately after Students', () => {
    renderAdminLayout()

    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toBeInTheDocument()
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Students')).toBeInTheDocument()
    expect(screen.getByText('Administrators')).toBeInTheDocument()
    expect(screen.getByText('Questions')).toBeInTheDocument()
    expect(screen.getByText('Levels')).toBeInTheDocument()
    expect(screen.getByText('Exam Configuration')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('Audit Log')).toBeInTheDocument()

    expect([...sidebar.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
      '/admin',
      '/admin/students',
      '/admin/administrators',
      '/admin/questions',
      '/admin/levels',
      '/admin/exam-configuration',
      '/admin/reports',
      '/admin/audit-log',
    ])
  })

  it('hides Administrators for operational admins', () => {
    mockAuthState.hasCapability = () => false
    renderAdminLayout()
    expect(screen.queryByText('Administrators')).not.toBeInTheDocument()
  })

  it('highlights the active link on current route', () => {
    renderAdminLayout('/admin')

    const sidebar = screen.getByTestId('sidebar')
    const dashboardLink = sidebar.querySelector('a[href="/admin"]')
    expect(dashboardLink).toHaveClass('cba-admin__nav-link--active')
    expect(dashboardLink?.querySelector('.cba-admin__nav-icon')).toHaveAttribute('aria-hidden', 'true')
  })

  it('navigates when clicking a sidebar link', async () => {
    const user = userEvent.setup()
    renderAdminLayout()

    await user.click(screen.getByText('Students'))
    expect(await screen.findByRole('heading', { name: 'Students' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Students' })).toHaveClass('cba-admin__module-title')
  })

  it('navigates to Levels and highlights it as active', async () => {
    const user = userEvent.setup()
    renderAdminLayout()

    await user.click(screen.getByText('Levels'))

    expect(screen.getByTestId('levels-content')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Levels' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Levels' })).toHaveClass('cba-admin__nav-link--active')
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
