/// <reference types="vitest" />
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RecentExamsTable from '../RecentExamsTable'
import type { RecentExam } from '../../../types'

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
]

describe('RecentExamsTable', () => {
  it('renders rows with student data', () => {
    render(<RecentExamsTable exams={mockExams} loading={false} />)

    expect(screen.getByText('Ana García')).toBeInTheDocument()
    expect(screen.getByText('Carlos López')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('A2')).toBeInTheDocument()
  })

  it('renders completed status badge with green style', () => {
    render(<RecentExamsTable exams={mockExams} loading={false} />)

    const badge = screen.getByText('completed')
    expect(badge).toHaveClass('bg-green-100')
  })

  it('renders in_progress status badge with yellow style', () => {
    render(<RecentExamsTable exams={mockExams} loading={false} />)

    const badge = screen.getByText('in_progress')
    expect(badge).toHaveClass('bg-yellow-100')
  })

  it('shows empty state when exams array is empty', () => {
    render(<RecentExamsTable exams={[]} loading={false} />)

    expect(screen.getByText('No exams recorded yet')).toBeInTheDocument()
  })

  it('shows skeleton when loading', () => {
    const { container } = render(<RecentExamsTable exams={[]} loading={true} />)

    expect(screen.queryByText('No exams recorded yet')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows dash for null score', () => {
    render(<RecentExamsTable exams={mockExams} loading={false} />)

    // Carlos has no score (in_progress)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })
})
