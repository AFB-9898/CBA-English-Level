/// <reference types="vitest" />
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudentDashboard } from '../../types'

const logout = vi.fn()
vi.mock('../../components/auth/AuthContext', () => ({
  useAuth: () => ({ logout }),
}))

const refetch = vi.fn()
type DashboardState = { dashboard: StudentDashboard | null; loading: boolean; error: string | null }
const completedDashboard: StudentDashboard = { student_full_name: 'Ada Lovelace', exam_state: 'completed', latest_result_score: 88, latest_result_completed_at: '2026-07-22T12:00:00Z', assigned_level_code: 'B2', assigned_level_name: 'Vantage', assigned_level_version: 1, attempt_count: 2 }
let dashboardState: DashboardState = { dashboard: completedDashboard, loading: false, error: null }
vi.mock('../../hooks/useStudentDashboard', () => ({
  useStudentDashboard: () => ({ ...dashboardState, refetch }),
}))

import StudentWelcomeScreen from '../StudentWelcomeScreen'

describe('StudentWelcomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dashboardState = { dashboard: completedDashboard, loading: false, error: null }
  })

  it('shows the read-only student dashboard and a disabled future exam action', () => {
    render(<StudentWelcomeScreen />)
    expect(screen.getByText('Student Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('B2 - Vantage (v1)')).toBeInTheDocument()
    expect(screen.getByText('88')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start exam' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(logout).toHaveBeenCalled()
  })

  it('renders loading, error retry, and an empty dashboard state', () => {
    dashboardState = { dashboard: null, loading: true, error: null }
    const { container, rerender } = render(<StudentWelcomeScreen />)
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()

    dashboardState = { dashboard: null, loading: false, error: 'denied' }
    rerender(<StudentWelcomeScreen />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalled()

    dashboardState = { dashboard: null, loading: false, error: null }
    rerender(<StudentWelcomeScreen />)
    expect(screen.getByText('Your student dashboard is currently unavailable.')).toBeInTheDocument()
  })
})
