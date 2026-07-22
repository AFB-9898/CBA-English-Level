/// <reference types="vitest" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const login = vi.fn()
const logout = vi.fn()
const retryPrincipal = vi.fn()
const state = {
  user: null as { id: string } | null,
  role: null as 'admin' | 'student' | null,
  loading: false,
  principalError: null as string | null,
}

vi.mock('../../components/auth/AuthContext', () => ({
  useAuth: () => ({ ...state, login, logout, retryPrincipal }),
}))

import StudentLoginPage from '../StudentLoginPage'

function renderPage() {
  return render(<MemoryRouter initialEntries={['/student/login']}><Routes>
    <Route path="/student/login" element={<StudentLoginPage />} />
    <Route path="/student" element={<div data-testid="student-page">Student</div>} />
  </Routes></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  state.user = null
  state.role = null
  state.loading = false
  state.principalError = null
})

describe('StudentLoginPage', () => {
  it('retains input focus while typing consecutive email and password characters', async () => {
    const user = userEvent.setup()
    renderPage()

    const email = screen.getByLabelText('Email')
    await user.click(email)
    await user.type(email, 'student@test.local')
    expect(email).toHaveValue('student@test.local')
    expect(email).toHaveFocus()

    const password = screen.getByLabelText('Password')
    await user.click(password)
    await user.type(password, 'password123')
    expect(password).toHaveValue('password123')
    expect(password).toHaveFocus()
  })

  it('signs in with email and password only', async () => {
    login.mockResolvedValue({})
    renderPage()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@test.local' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(login).toHaveBeenCalledWith('student@test.local', 'password123'))
  })

  it('redirects an authenticated student to the student access screen', () => {
    state.user = { id: 'student-1' }
    state.role = 'student'
    renderPage()
    expect(screen.getByTestId('student-page')).toBeInTheDocument()
  })

  it('retains a session after a principal-resolution failure and lets the student retry', () => {
    state.user = { id: 'student-1' }
    state.principalError = 'Network error. Please try again.'
    renderPage()

    expect(logout).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Network error. Please try again.')
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(retryPrincipal).toHaveBeenCalledOnce()
  })

  it('logs out an administrator instead of admitting it as a student', async () => {
    state.user = { id: 'admin-1' }
    state.role = 'admin'
    renderPage()
    await waitFor(() => expect(logout).toHaveBeenCalled())
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied: this account is not a student account')
  })
})
