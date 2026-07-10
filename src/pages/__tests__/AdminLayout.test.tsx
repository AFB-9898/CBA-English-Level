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

function renderAdminLayout() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div data-testid="dashboard-content">Dashboard</div>} />
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminLayout', () => {
  it("renders the header with title and logout button", () => {
    renderAdminLayout()

    expect(screen.getByText('CBA — Admin Panel')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it("renders outlet content (nested route)", () => {
    renderAdminLayout()

    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument()
  })

  it("displays user email in the header", () => {
    renderAdminLayout()

    expect(screen.getByText('admin@cba.edu.bo')).toBeInTheDocument()
  })

  it("calls logout and navigates to /login when logout button is clicked", async () => {
    mockLogout.mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderAdminLayout()

    await user.click(screen.getByText('Logout'))

    expect(mockLogout).toHaveBeenCalled()
  })
})
