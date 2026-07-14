/// <reference types="vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QuestionTableRow, QuestionCard } from '../QuestionRow'
import type { QuestionWithLevel } from '../../../types'

const mockQuestion: QuestionWithLevel = {
  id: 'q1',
  text: 'What is 2+2?',
  level_id: 'l1',
  category: 'math',
  created_at: '2025-07-10T12:00:00Z',
  updated_at: '2025-07-10T12:00:00Z',
  level: { id: 'l1', name: 'A1', min_score: 0, max_score: 30, description: null },
}

describe('QuestionTableRow', () => {
  function renderRow(props = {}) {
    return render(
      <table>
        <tbody>
          <QuestionTableRow
            question={mockQuestion}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            {...props}
          />
        </tbody>
      </table>,
    )
  }

  it('renders question text', () => {
    renderRow()
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument()
  })

  it('renders level name', () => {
    renderRow()
    expect(screen.getByText('A1')).toBeInTheDocument()
  })

  it('renders category', () => {
    renderRow()
    expect(screen.getByText('math')).toBeInTheDocument()
  })

  it('renders formatted date', () => {
    renderRow()
    const dateStr = new Date('2025-07-10T12:00:00Z').toLocaleDateString()
    expect(screen.getByText(dateStr)).toBeInTheDocument()
  })

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn()
    render(
      <table>
        <tbody>
          <QuestionTableRow question={mockQuestion} onEdit={onEdit} onDelete={vi.fn()} />
        </tbody>
      </table>,
    )
    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledWith('q1')
  })

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn()
    render(
      <table>
        <tbody>
          <QuestionTableRow question={mockQuestion} onEdit={vi.fn()} onDelete={onDelete} />
        </tbody>
      </table>,
    )
    fireEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledWith('q1')
  })

  it('renders dash for null category', () => {
    const noCategoryQuestion = { ...mockQuestion, category: null }
    render(
      <table>
        <tbody>
          <QuestionTableRow question={noCategoryQuestion} onEdit={vi.fn()} onDelete={vi.fn()} />
        </tbody>
      </table>,
    )
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('renders dash for null level', () => {
    const noLevelQuestion = { ...mockQuestion, level: null }
    render(
      <table>
        <tbody>
          <QuestionTableRow question={noLevelQuestion} onEdit={vi.fn()} onDelete={vi.fn()} />
        </tbody>
      </table>,
    )
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })
})

describe('QuestionCard', () => {
  it('renders question text', () => {
    render(
      <QuestionCard question={mockQuestion} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument()
  })

  it('renders level badge', () => {
    render(
      <QuestionCard question={mockQuestion} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText('A1')).toBeInTheDocument()
  })

  it('renders category badge', () => {
    render(
      <QuestionCard question={mockQuestion} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    expect(screen.getByText('math')).toBeInTheDocument()
  })

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn()
    render(
      <QuestionCard question={mockQuestion} onEdit={onEdit} onDelete={vi.fn()} />,
    )
    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledWith('q1')
  })

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn()
    render(
      <QuestionCard question={mockQuestion} onEdit={vi.fn()} onDelete={onDelete} />,
    )
    fireEvent.click(screen.getByText('Delete'))
    expect(onDelete).toHaveBeenCalledWith('q1')
  })

  it('hides category badge when category is null', () => {
    const noCategoryQuestion = { ...mockQuestion, category: null }
    render(
      <QuestionCard question={noCategoryQuestion} onEdit={vi.fn()} onDelete={vi.fn()} />,
    )
    // Only the level badge "A1" should appear, not "math"
    expect(screen.queryByText('math')).not.toBeInTheDocument()
  })
})
