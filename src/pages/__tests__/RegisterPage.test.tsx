import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, act, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import RegisterPage from '../RegisterPage'
import i18n from '../../i18n'

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

beforeEach(async () => {
  await i18n.changeLanguage('en')
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
    expect(screen.getAllByRole('img', { name: 'CBA Tarija, Bolivia and Tarija flags' })).not.toHaveLength(0)
  })

  it('updates registration visual content when switching between English and Spanish', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByText('Placement Exam')).toBeInTheDocument()
    expect(screen.getByText('Create your profile and discover the English level that fits you.')).toBeInTheDocument()
    expect(screen.getByTitle('Switch to Spanish')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'EN' }))

    await waitFor(() => {
      expect(screen.getByText('Examen de colocación')).toBeInTheDocument()
      expect(screen.getByText('Creá tu perfil y descubrí el nivel de inglés adecuado para vos.')).toBeInTheDocument()
      expect(screen.getByText('CBA — Registro de estudiante')).toBeInTheDocument()
      expect(screen.getAllByRole('img', { name: 'CBA Tarija, banderas de Bolivia y Tarija' })).not.toHaveLength(0)
      expect(screen.getByTitle('Cambiar a inglés')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ES' }))

    await waitFor(() => {
      expect(screen.getByText('Placement Exam')).toBeInTheDocument()
      expect(screen.getByText('Create your profile and discover the English level that fits you.')).toBeInTheDocument()
      expect(screen.getByText('CBA — Student Registration')).toBeInTheDocument()
      expect(screen.getByTitle('Switch to Spanish')).toBeInTheDocument()
    })
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
