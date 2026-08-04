/// <reference types="vitest" />
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RecentExamsTable from '../RecentExamsTable'
import type { RecentExam } from '../../../types'
import i18n from '../../../i18n'

const mockExams: RecentExam[] = [
  {
    id: 'e1',
    student: { full_name: 'Ana García' },
    level: { name: 'A2' },
    score: 75,
    status: 'completed',
    completed_at: '2025-07-10T12:00:00Z',
    created_at: '2025-07-10T12:00:00Z',
  },
  {
    id: 'e2',
    student: { full_name: 'Carlos López' },
    level: { name: 'B1' },
    score: 55,
    status: 'in_progress',
    completed_at: null,
    created_at: '2025-07-10T14:00:00Z',
  },
  {
    id: 'e3',
    student: { full_name: 'Lucía Pérez' },
    level: null,
    score: null,
    status: 'pending',
    completed_at: null,
    created_at: '2025-07-10T15:00:00Z',
  },
]

describe('RecentExamsTable', () => {
  it('renders Spanish headings, empty state, and status labels', async () => {
    await i18n.changeLanguage('es')
    const { rerender } = render(<RecentExamsTable exams={mockExams} loading={false} />)

    expect(screen.getByText('Exámenes Recientes')).toBeInTheDocument()
    expect(screen.getByText('Estudiante')).toBeInTheDocument()
    expect(screen.getByText('Puntaje')).toBeInTheDocument()
    expect(screen.getByText('Nivel')).toBeInTheDocument()
    expect(screen.getByText('Estado')).toBeInTheDocument()
    expect(screen.getByText('Fecha')).toBeInTheDocument()
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('En curso')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()

    rerender(<RecentExamsTable exams={[]} loading={false} />)
    expect(screen.getByText('No hay exámenes registrados aún')).toHaveClass('cba-admin__muted-text')
  })

  it('renders rows with student data', () => {
    render(<RecentExamsTable exams={mockExams} loading={false} />)

    expect(screen.getByText('Ana García')).toBeInTheDocument()
    expect(screen.getByText('Carlos López')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('A2')).toBeInTheDocument()
  })

  it('formats completed dates using the active language locale', async () => {
    await i18n.changeLanguage('es')
    const { rerender } = render(<RecentExamsTable exams={mockExams} loading={false} />)

    expect(screen.getByText('10 jul 2025')).toBeInTheDocument()

    await i18n.changeLanguage('en')
    rerender(<RecentExamsTable exams={mockExams} loading={false} />)

    expect(screen.getByText('Jul 10, 2025')).toBeInTheDocument()
  })

  it('renders completed status badge with green style', async () => {
    await i18n.changeLanguage('en')
    render(<RecentExamsTable exams={mockExams} loading={false} />)

    const badge = screen.getByText('Completed')
    expect(badge).toHaveClass('cba-dashboard__status--completed')
  })

  it('renders in_progress status badge with yellow style', async () => {
    await i18n.changeLanguage('en')
    render(<RecentExamsTable exams={mockExams} loading={false} />)

    const badge = screen.getByText('In progress')
    expect(badge).toHaveClass('cba-dashboard__status--in-progress')
  })

  it('shows empty state when exams array is empty', async () => {
    await i18n.changeLanguage('en')
    render(<RecentExamsTable exams={[]} loading={false} />)

    expect(screen.getByText('No exams recorded yet')).toBeInTheDocument()
  })

  it('shows skeleton when loading', async () => {
    await i18n.changeLanguage('en')
    const { container } = render(<RecentExamsTable exams={[]} loading={true} />)

    expect(screen.queryByText('No exams recorded yet')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows dash for null score', async () => {
    await i18n.changeLanguage('en')
    render(<RecentExamsTable exams={mockExams} loading={false} />)

    // Carlos has no score (in_progress)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })
})
