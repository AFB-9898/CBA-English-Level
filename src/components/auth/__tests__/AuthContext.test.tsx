/// <reference types="vitest" />
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetSession, mockOnAuthStateChange, mockSignInWithPassword, mockSignOut, mockFrom } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockFrom: vi.fn(),
}))

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
    from: mockFrom,
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
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  })
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

  it("sets user and isAdmin when session has admin role", async () => {
    const mockUser = {
      id: 'admin-1',
      email: 'admin@cba.edu.bo',
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

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('logged-in')
    })
    expect(screen.getByTestId('is-admin')).toHaveTextContent('true')
  })

  it("sets isAdmin to false when role is not admin", async () => {
    const mockUser = {
      id: 'student-1',
      email: 'student@test.com',
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

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('logged-in')
    })
    expect(screen.getByTestId('is-admin')).toHaveTextContent('false')
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

  it("maps unknown errors to generic network error message", async () => {
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
        'Network error. Please try again.'
      )
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
