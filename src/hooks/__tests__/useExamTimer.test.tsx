import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useExamTimer } from '../useExamTimer'

describe('useExamTimer', () => {
  it('uses the server clock offset when the browser clock is skewed and reaches zero without becoming negative', () => {
    const browserNow = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:10:00Z').getTime())
    const receivedAt = Date.now()
    const { result, rerender } = renderHook(({ serverNow }) => useExamTimer('2026-01-01T00:02:00Z', serverNow, receivedAt, true), { initialProps: { serverNow: '2026-01-01T00:00:00Z' } })
    expect(result.current.remaining).toBe(120_000)
    rerender({ serverNow: '2026-01-01T00:03:00Z' })
    expect(result.current).toMatchObject({ remaining: 0, expired: true })
    browserNow.mockRestore()
  })
})
