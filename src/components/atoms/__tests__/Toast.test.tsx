import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import Toast from '../Toast'

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('Toast', () => {
  it('renders the message', () => {
    render(<Toast message="Hello" onClose={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Hello')
  })

  it('calls onClose after the duration', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<Toast message="Test" duration={1000} onClose={onClose} />)

    act(() => {
      vi.advanceTimersByTime(1300) // 1000ms duration + 300ms exit animation
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('applies success variant by default', () => {
    render(<Toast message="OK" onClose={() => {}} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
