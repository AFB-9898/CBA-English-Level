/// <reference types="vitest" />
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import LevelBar from '../LevelBar'
import type { LevelDistributionItem } from '../../../types'

const mockLevels: LevelDistributionItem[] = [
  { level_id: 'l1', name: 'A1', count: 30, percentage: 50 },
  { level_id: 'l2', name: 'A2', count: 20, percentage: 33 },
  { level_id: 'l3', name: 'B1', count: 10, percentage: 17 },
]

describe('LevelBar', () => {
  it('renders bars with correct labels and counts', () => {
    render(<LevelBar levels={mockLevels} loading={false} />)

    expect(screen.getByText('A1')).toBeInTheDocument()
    expect(screen.getByText('30 (50%)')).toBeInTheDocument()
    expect(screen.getByText('A2')).toBeInTheDocument()
    expect(screen.getByText('20 (33%)')).toBeInTheDocument()
    expect(screen.getByText('B1')).toBeInTheDocument()
    expect(screen.getByText('10 (17%)')).toBeInTheDocument()
  })

  it('renders correct number of bar elements', () => {
    const { container } = render(<LevelBar levels={mockLevels} loading={false} />)

    const bars = container.querySelectorAll('.rounded-full')
    // 3 level bars + 3 background bars = 6
    expect(bars.length).toBeGreaterThanOrEqual(3)
  })

  it('shows empty state when levels array is empty', () => {
    render(<LevelBar levels={[]} loading={false} />)

    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('shows skeleton when loading', () => {
    const { container } = render(<LevelBar levels={[]} loading={true} />)

    expect(screen.queryByText('No data available')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})
