/// <reference types="vitest" />
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatCard from '../StatCard'

describe('StatCard', () => {
  it('renders label and value when loaded', () => {
    render(<StatCard label="Total Students" value={42} loading={false} />)

    expect(screen.getByText('Total Students')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders string value', () => {
    render(<StatCard label="Avg Score" value="73.5" loading={false} />)

    expect(screen.getByText('73.5')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(<StatCard label="Students" value={10} icon="👥" loading={false} />)

    expect(screen.getByText('👥')).toBeInTheDocument()
  })

  it('shows skeleton when loading', () => {
    const { container } = render(<StatCard label="Students" value={0} loading={true} />)

    expect(screen.queryByText('Students')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})
