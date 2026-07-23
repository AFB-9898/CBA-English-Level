import { useEffect, useState } from 'react'

function remainingAt(deadlineAt: string | undefined, serverNow: string | undefined, receivedAt: number | null, now: number): number {
  if (!deadlineAt || !serverNow || receivedAt === null) return 0
  const deadline = new Date(deadlineAt).getTime()
  const serverClockOffset = new Date(serverNow).getTime() - receivedAt
  return Math.max(0, deadline - (now + serverClockOffset))
}

export function useExamTimer(deadlineAt: string | undefined, serverNow: string | undefined, receivedAt: number | null, active: boolean) {
  const [now, setNow] = useState(Date.now)
  const remaining = remainingAt(deadlineAt, serverNow, receivedAt, now)

  useEffect(() => {
    function update() { setNow((current) => Math.max(Date.now(), current + 1_000)) }
    setNow(Date.now())
    if (!active) return
    const interval = window.setInterval(update, 1_000)
    return () => window.clearInterval(interval)
  }, [active, deadlineAt, receivedAt, serverNow])

  return { remaining, expired: remaining === 0 }
}
