/// <reference types="vitest" />
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import DashboardScreen from '../DashboardScreen'

// ── Mock useDashboardStats ────────────────────────────────────
vi.mock('../../hooks/useDashboardStats', () => ({
  useDashboardStats: vi.fn(),
}))

import { useDashboardStats } from '../../hooks/useDashboardStats'

const mockUseDashboardStats = vi.mocked(useDashboardStats)

// ── Mock AuthContext ──────────────────────────────────────────
vi.mock('../../components/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'admin@cba.edu.bo' },
    adminName: null,
    logout: vi.fn(),
  }),
}))

describe('DashboardScreen', () => {
  it('renders all three sections when data is loaded', () => {
    mockUseDashboardStats.mockReturnValue({
      stats: { totalStudents: 42, totalExams: 156, examsToday: 8, avgScore: 73.5 },
      distribution: [{ level_id: 'l1', name: 'A1', count: 30, percentage: 50 }],
      recentExams: [
        {
          id: 'e1',
          student: { full_name: 'Ana' },
          level: { name: 'A1' },
          score: 75,
          status: 'completed',
          completed_at: '2025-07-10T12:00:00Z',
          created_at: '2025-07-10T12:00:00Z',
        },
      ],
      levels: [],
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter>
        <DashboardScreen />
      </MemoryRouter>,
    )

    // KPI cards
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('156')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('73.5')).toBeInTheDocument()

    // Level distribution — "A1" appears in both LevelBar and the table
    expect(screen.getAllByText('A1').length).toBeGreaterThanOrEqual(1)

    // Recent exams table
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('shows error message when hook returns an error', () => {
    mockUseDashboardStats.mockReturnValue({
      stats: { totalStudents: 0, totalExams: 0, examsToday: 0, avgScore: 0 },
      distribution: [],
      recentExams: [],
      levels: [],
      loading: false,
      error: 'Failed to fetch',
    })

    render(
      <MemoryRouter>
        <DashboardScreen />
      </MemoryRouter>,
    )

    expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
  })

  it('renders skeletons when loading', () => {
    mockUseDashboardStats.mockReturnValue({
      stats: { totalStudents: 0, totalExams: 0, examsToday: 0, avgScore: 0 },
      distribution: [],
      recentExams: [],
      levels: [],
      loading: true,
      error: null,
    })

    const { container } = render(
      <MemoryRouter>
        <DashboardScreen />
      </MemoryRouter>,
    )

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })
})
