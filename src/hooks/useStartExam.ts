import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ExamAttempt } from '../types/examAttempt'

function errorMessage(error: unknown): string {
  const value = error as { message?: string } | null
  return value?.message || (error instanceof Error ? error.message : 'Unknown error')
}

export function useStartExam() {
  const requestId = useRef<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start(): Promise<ExamAttempt | null> {
    requestId.current ??= crypto.randomUUID()
    setStarting(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('start_exam', { p_request_id: requestId.current })
      if (rpcError) throw rpcError
      if (!data) throw new Error('Start exam returned no attempt')
      return data as ExamAttempt
    } catch (err) {
      setError(errorMessage(err))
      return null
    } finally {
      setStarting(false)
    }
  }

  return { start, starting, error }
}
