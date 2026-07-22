import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RegisterPage from '../RegisterPage'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../components/organisms/RegisterForm', () => ({
  default: ({ onSuccess }: { onSuccess?: () => void }) => (
    <button onClick={() => onSuccess?.()}>Trigger Success</button>
  ),
}))

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  mockNavigate.mockClear()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  )
}

describe('RegisterPage', () => {
  it('renders the registration form', () => {
    renderPage()
    expect(screen.getByText('CBA — Student Registration')).toBeInTheDocument()
    expect(screen.getByText('Create an account to take placement exams')).toBeInTheDocument()
  })

  it('shows toast on successful registration', () => {
    renderPage()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => {
      screen.getByText('Trigger Success').click()
    })

    expect(screen.getByRole('status')).toHaveTextContent('Registration successful! Please sign in.')
  })

  it('navigates to /login after 2.5 seconds on success', () => {
    vi.useFakeTimers()
    renderPage()

    act(() => {
      screen.getByText('Trigger Success').click()
    })

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
