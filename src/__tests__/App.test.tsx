/// <reference types="vitest" />
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetSession, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  },
}))

import App from '../App'

vi.mock('../pages/LevelsScreen', () => ({
  default: () => <div data-testid="levels-screen">CEFR Levels</div>,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('App — Auth Flow Integration', () => {
  it("redirects to login when session is expired (null session on admin route)", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })

    window.history.pushState({}, '', '/admin')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('CBA — Login')).toBeInTheDocument()
    })
  })

  it("renders login page when navigating to /login (unauthenticated)", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('CBA — Login')).toBeInTheDocument()
    })
  })

  it("redirects to login when visiting /admin unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })

    window.history.pushState({}, '', '/admin')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('CBA — Login')).toBeInTheDocument()
    })
  })

  it("renders admin layout when authenticated as admin", async () => {
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

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('CBA — Admin Panel')).toBeInTheDocument()
    })
  })

  it('makes the Levels screen reachable at /admin/levels for an authenticated admin', async () => {
    const mockUser = {
      id: 'admin-1',
      email: 'admin@cba.edu.bo',
      user_metadata: { role: 'admin' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }
    mockGetSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null })
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    window.history.pushState({}, '', '/admin/levels')

    render(<App />)

    await waitFor(() => expect(screen.getByTestId('levels-screen')).toBeInTheDocument())
  })

  it.each(['/admin/students', '/admin/audit-log'])('%s renders its registered placeholder route', async (path) => {
    const mockUser = {
      id: 'admin-1',
      email: 'admin@cba.edu.bo',
      user_metadata: { role: 'admin' },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }
    mockGetSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null })
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    window.history.pushState({}, '', path)

    render(<App />)

    await waitFor(() => expect(screen.getByText('Coming soon / Próximamente.')).toBeInTheDocument())
  })
})
