import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import RegisterForm from '../RegisterForm'

// Mock supabase module
const mockSignUp = vi.fn()

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}))

function renderForm(props?: { onSuccess?: () => void }) {
  return render(
    <MemoryRouter>
      <RegisterForm {...props} />
    </MemoryRouter>,
  )
}

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all 5 fields and submit button', () => {
    renderForm()

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/ci/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
  })

  it('shows validation errors on empty submission', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: /register/i }))

    expect(screen.getByText('Full name is required')).toBeInTheDocument()
    expect(screen.getByText('CI is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('calls signUp with correct data on valid submission', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({ error: null, data: { user: { id: '1' } } })
    const onSuccess = vi.fn()

    renderForm({ onSuccess })

    await user.type(screen.getByLabelText(/full name/i), 'Juan Pérez')
    await user.type(screen.getByLabelText(/ci/i), '1234567')
    await user.type(screen.getByLabelText(/email/i), 'juan@example.com')
    await user.type(screen.getByLabelText(/phone/i), '71234567')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'juan@example.com',
        password: 'password123',
        options: {
          data: {
            ci: '1234567',
            full_name: 'Juan Pérez',
            phone: '71234567',
          },
        },
      })
    })

    expect(onSuccess).toHaveBeenCalled()
  })

  it('shows inline email error on duplicate email', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({
      error: { message: 'User already registered', code: undefined },
    })

    renderForm()

    await user.type(screen.getByLabelText(/full name/i), 'Juan Pérez')
    await user.type(screen.getByLabelText(/ci/i), '1234567')
    await user.type(screen.getByLabelText(/email/i), 'duplicate@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText('This email is already registered')).toBeInTheDocument()
    })
  })

  it('shows general error on network failure', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValue({
      error: { message: 'Failed to fetch' },
    })

    renderForm()

    await user.type(screen.getByLabelText(/full name/i), 'Juan Pérez')
    await user.type(screen.getByLabelText(/ci/i), '1234567')
    await user.type(screen.getByLabelText(/email/i), 'juan@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() => {
      expect(screen.getByText('Network error. Please try again.')).toBeInTheDocument()
    })
  })

  it('shows validation error for short password', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText(/full name/i), 'Juan Pérez')
    await user.type(screen.getByLabelText(/ci/i), '1234567')
    await user.type(screen.getByLabelText(/email/i), 'juan@example.com')
    await user.type(screen.getByLabelText(/password/i), 'short')
    await user.click(screen.getByRole('button', { name: /register/i }))

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('renders all fields and button at 320px viewport width', () => {
    // Simulate mobile viewport (320px)
    Object.defineProperty(window, 'innerWidth', { value: 320, writable: true })
    window.dispatchEvent(new Event('resize'))

    renderForm()

    // All 5 fields must be in the document
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/ci/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()

    // Body should not have overflow-x hidden (no horizontal scroll needed)
    expect(document.body.style.overflowX).not.toBe('hidden')
  })

  it('links to login page', () => {
    renderForm()

    const loginLink = screen.getByRole('link', { name: /login/i })
    expect(loginLink).toHaveAttribute('href', '/login')
  })
})
