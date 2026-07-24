import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { StudentExamHistoryDetail, StudentExamHistoryItem } from '../types'

function errorMessage(error: unknown): string {
  const value = error as { message?: string } | null
  return value?.message || (error instanceof Error ? error.message : 'Unknown error')
}

export function useStudentExamHistory() {
  const [history, setHistory] = useState<StudentExamHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
  const refetch = useCallback(() => setRequestVersion((version) => version + 1), [])

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: rpcError } = await supabase.rpc('get_student_exam_history')
        if (rpcError) throw rpcError
        if (!cancelled) setHistory((data ?? []) as StudentExamHistoryItem[])
      } catch (err) {
        if (!cancelled) {
          setHistory([])
          setError(errorMessage(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadHistory()
    return () => { cancelled = true }
  }, [requestVersion])

  return { history, loading, error, refetch }
}

export function useStudentExamHistoryDetail(attemptId: string | undefined) {
  const [detail, setDetail] = useState<StudentExamHistoryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
  const refetch = useCallback(() => setRequestVersion((version) => version + 1), [])

  useEffect(() => {
    let cancelled = false

    async function loadDetail() {
      if (!attemptId) {
        setDetail(null)
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const { data, error: rpcError } = await supabase.rpc('get_student_exam_history_detail', { p_attempt_id: attemptId })
        if (rpcError) throw rpcError
        if (!cancelled) setDetail(((data ?? [])[0] ?? null) as StudentExamHistoryDetail | null)
      } catch (err) {
        if (!cancelled) {
          setDetail(null)
          setError(errorMessage(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadDetail()
    return () => { cancelled = true }
  }, [attemptId, requestVersion])

  return { detail, loading, error, refetch }
}
