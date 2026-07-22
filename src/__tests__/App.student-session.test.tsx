import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetSession, mockOnAuthStateChange, mockRpc } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockRpc: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    rpc: mockRpc,
  },
}))

vi.mock('../pages/StudentWelcomeScreen', () => ({
  default: () => <div data-testid="student-dashboard">Student Dashboard</div>,
}))

vi.mock('../pages/AdminLayout', () => ({
  default: () => <div data-testid="admin-dashboard">Admin Dashboard</div>,
}))

import App from '../App'

describe('App student session restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['/student', 'student', 'student-dashboard'],
    ['/admin', 'admin', 'admin-dashboard'],
  ] as const)('keeps %s mounted until a restored %s principal resolves', async (path, role, dashboardTestId) => {
    const mockUser = { id: `${role}-1`, app_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() }
    let authStateChange: ((event: string, session: unknown) => void) | undefined
    let resolvePrincipal!: (result: { data: { role: typeof role }; error: null }) => void

    window.history.replaceState({}, '', path)

    mockGetSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null })
    mockOnAuthStateChange.mockImplementation((callback) => {
      authStateChange = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    mockRpc.mockImplementation(() => new Promise<{ data: { role: typeof role }; error: null }>((resolve) => {
      resolvePrincipal = resolve
    }))

    render(<App />)

    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('get_current_principal'))
    authStateChange?.('INITIAL_SESSION', null)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('CBA — Login')).not.toBeInTheDocument()

    await act(async () => {
      resolvePrincipal({ data: { role }, error: null })
    })

    await waitFor(() => expect(screen.getByTestId(dashboardTestId)).toBeInTheDocument())
    expect(window.location.pathname).toBe(path)
  })
})
