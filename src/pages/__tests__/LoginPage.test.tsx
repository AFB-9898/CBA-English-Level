/// <reference types="vitest" />
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLogin = vi.fn()
const mockLogout = vi.fn()

const { mockUser, mockIsAdmin, mockLoading } = vi.hoisted(() => ({
  mockUser: { value: null as any },
  mockIsAdmin: { value: false },
  mockLoading: { value: false },
}))

vi.mock('../../components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser.value,
    isAdmin: mockIsAdmin.value,
    loading: mockLoading.value,
    adminName: null,
    login: mockLogin,
    logout: mockLogout,
  }),
}))

import LoginPage from '../LoginPage'

beforeEach(() => {
  vi.clearAllMocks()
  mockUser.value = null
  mockIsAdmin.value = false
  mockLoading.value = false
})

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<div data-testid="admin-page">Admin</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function fillForm(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: email },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  })
}

describe('LoginPage', () => {
  it("renders the login form with email and password fields", () => {
    renderLoginPage()

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it("calls login on form submit", async () => {
    mockLogin.mockResolvedValue({})
    renderLoginPage()
    fillForm('admin@cba.edu.bo', 'password123')

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@cba.edu.bo', 'password123')
    })
  })

  it("displays an error when login fails", async () => {
    mockLogin.mockResolvedValue({ error: 'Invalid email or password' })
    renderLoginPage()
    fillForm('admin@cba.edu.bo', 'wrong')

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password')
    })
  })

  it("shows validation error when fields are empty", async () => {
    renderLoginPage()

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Please enter both email and password.')
    })
  })

  it("redirects to /admin when already authenticated as admin", () => {
    mockUser.value = { id: '1' }
    mockIsAdmin.value = true
    mockLoading.value = false

    renderLoginPage()

    expect(screen.getByTestId('admin-page')).toBeInTheDocument()
  })

  it("calls logout and shows access denied when non-admin user has active session", async () => {
    mockUser.value = { id: 'student-1', email: 'student@test.com' }
    mockIsAdmin.value = false
    mockLoading.value = false

    renderLoginPage()

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
    })

    expect(screen.getByText('Access denied: not an admin')).toBeInTheDocument()
  })

  it("shows a Register link that navigates to /register", () => {
    renderLoginPage()

    const registerLink = screen.getByRole('link', { name: /register/i })
    expect(registerLink).toBeInTheDocument()
    expect(registerLink).toHaveAttribute('href', '/register')
  })

  it("disables the submit button while submitting", async () => {
    mockLogin.mockImplementation(() => new Promise(() => {}))
    renderLoginPage()
    fillForm('admin@cba.edu.bo', 'pw')

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
    })
  })
})
