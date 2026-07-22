/// <reference types="vitest" />
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const logout = vi.fn()
vi.mock('../../components/auth/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'student@test.local' }, logout }),
}))

import StudentWelcomeScreen from '../StudentWelcomeScreen'

describe('StudentWelcomeScreen', () => {
  it('shows account access status without exposing exam content and supports logout', () => {
    render(<StudentWelcomeScreen />)
    expect(screen.getByText('Welcome to CBA')).toBeInTheDocument()
    expect(screen.getByText('student@test.local')).toBeInTheDocument()
    expect(screen.queryByText(/question/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(logout).toHaveBeenCalled()
  })
})
