/// <reference types="vitest" />
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetSession, mockOnAuthStateChange, mockSignInWithPassword, mockSignOut, mockRpc } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
    rpc: mockRpc,
  },
}))

import { AuthProvider, useAuth } from '../AuthContext'

function TestConsumer() {
  const auth = useAuth()
  return (
    <div>
      <div data-testid="loading">{String(auth.loading)}</div>
      <div data-testid="user">{auth.user ? 'logged-in' : 'no-user'}</div>
      <div data-testid="is-admin">{String(auth.isAdmin)}</div>
      <div data-testid="is-student">{String(auth.isStudent)}</div>
      <div data-testid="principal-error">{auth.principalError ?? 'no-error'}</div>
      <span data-testid="login-result" />
      <button
        data-testid="login-btn"
        onClick={async () => {
          const result = await auth.login('a@b.com', 'pw')
          const el = document.querySelector('[data-testid="login-result"]')
          if (el && result.error) el.textContent = result.error
        }}
      >
        login
      </button>
      <button data-testid="logout-btn" onClick={() => auth.logout()}>
        logout
      </button>
      <button data-testid="retry-principal-btn" onClick={() => auth.retryPrincipal()}>
        retry principal
      </button>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockResolvedValue({ data: null, error: null })
})

describe('AuthContext', () => {
  it("renders children and shows loading initially then resolves", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('true')

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
  })

  it('recovers from a rejected session lookup', async () => {
    mockGetSession.mockRejectedValue(new Error('Network unavailable'))
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('principal-error')).toHaveTextContent('Network error. Please try again.')
  })

  it("resolves an administrator from the trusted principal RPC, not user metadata", async () => {
    const mockUser = {
      id: 'admin-1',
      email: 'admin@cba.edu.bo',
      user_metadata: { role: 'student' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }

    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockRpc.mockResolvedValue({ data: { role: 'admin', admin_name: 'Ada Admin' }, error: null })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('logged-in')
    })
    expect(screen.getByTestId('is-admin')).toHaveTextContent('true')
    expect(mockRpc).toHaveBeenCalledWith('get_current_principal')
  })

  it("resolves a student even when hostile metadata claims administrator", async () => {
    const mockUser = {
      id: 'student-1',
      email: 'student@test.com',
      user_metadata: { role: 'admin' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }

    mockGetSession.mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockRpc.mockResolvedValue({ data: { role: 'student' }, error: null })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('logged-in')
    })
    expect(screen.getByTestId('is-admin')).toHaveTextContent('false')
    expect(screen.getByTestId('is-student')).toHaveTextContent('true')
  })

  it('retains the session and exposes a retryable error when principal resolution fails', async () => {
    const mockUser = { id: 'student-1', app_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() }
    mockGetSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null })
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Pooler unavailable' } })
      .mockResolvedValueOnce({ data: { role: 'student' }, error: null })

    render(<AuthProvider><TestConsumer /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('logged-in')
      expect(screen.getByTestId('principal-error')).toHaveTextContent('Network error. Please try again.')
    })
    expect(screen.getByTestId('is-student')).toHaveTextContent('false')

    fireEvent.click(screen.getByTestId('retry-principal-btn'))

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(2)
      expect(screen.getByTestId('principal-error')).toHaveTextContent('no-error')
      expect(screen.getByTestId('is-student')).toHaveTextContent('true')
    })
  })

  it("calls login via supabase auth", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    screen.getByTestId('login-btn').click()

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'pw',
      })
    })
  })

  it("maps invalid login credentials to user-friendly message", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    screen.getByTestId('login-btn').click()

    await waitFor(() => {
      expect(screen.getByTestId('login-result')).toHaveTextContent(
        'Invalid email or password'
      )
    })
  })

  it('maps an unconfirmed email error to a user-friendly message', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    screen.getByTestId('login-btn').click()

    await waitFor(() => {
      expect(screen.getByTestId('login-result')).toHaveTextContent(
        'Please confirm your email before logging in',
      )
    })
  })

  it('maps a rejected transport error to the network error message', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockSignInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    screen.getByTestId('login-btn').click()

    await waitFor(() => {
      expect(screen.getByTestId('login-result')).toHaveTextContent('Network error. Please try again.')
    })
  })

  it('maps unknown Supabase errors to a neutral sign-in failure message', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockSignInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Something went terribly wrong' },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    screen.getByTestId('login-btn').click()

    await waitFor(() => {
      expect(screen.getByTestId('login-result')).toHaveTextContent(
        'We could not sign you in. Please try again.'
      )
    })
  })

  it('keeps rejected non-transport errors as neutral sign-in failures', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockSignInWithPassword.mockRejectedValue(new Error('Unexpected provider failure'))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    screen.getByTestId('login-btn').click()

    await waitFor(() => {
      expect(screen.getByTestId('login-result')).toHaveTextContent('We could not sign you in. Please try again.')
    })
  })

  it("calls logout via supabase auth", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mockSignOut.mockResolvedValue({ error: null })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    screen.getByTestId('logout-btn').click()

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
    })
  })
})
