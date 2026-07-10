/// <reference types="vitest" />
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProtectedRoute from '../ProtectedRoute'

// We'll mock AuthContext entirely for these tests
const mockUseAuth = vi.fn()
vi.mock('../AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin"
          element={<ProtectedRoute />}
        >
          <Route index element={<div data-testid="admin-content">Admin Dashboard</div>} />
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it("renders Outlet when user is admin", () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1' },
      isAdmin: true,
      loading: false,
    })

    renderAtPath('/admin')

    expect(screen.getByTestId('admin-content')).toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it("redirects to /login when user is null", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAdmin: false,
      loading: false,
    })

    renderAtPath('/admin')

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument()
  })

  it("redirects to /login when isAdmin is false", () => {
    mockUseAuth.mockReturnValue({
      user: { id: '2' },
      isAdmin: false,
      loading: false,
    })

    renderAtPath('/admin')

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument()
  })

  it("shows spinner while loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAdmin: false,
      loading: true,
    })

    renderAtPath('/admin')

    // Spinner should be visible
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })
})
