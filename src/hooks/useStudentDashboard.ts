import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { StudentDashboard } from '../types'

export interface UseStudentDashboardResult {
  dashboard: StudentDashboard | null
  loading: boolean
  error: string | null
  refetch: () => void
}

function errorMessage(error: unknown): string {
  const value = error as { message?: string } | null
  return value?.message || (error instanceof Error ? error.message : 'Unknown error')
}

export function useStudentDashboard(): UseStudentDashboardResult {
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
  const refetch = useCallback(() => setRequestVersion((version) => version + 1), [])

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: rpcError } = await supabase.rpc('get_student_dashboard')
        if (rpcError) throw rpcError
        if (!cancelled) setDashboard(((data ?? [])[0] ?? null) as StudentDashboard | null)
      } catch (err) {
        if (!cancelled) {
          setDashboard(null)
          setError(errorMessage(err))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadDashboard()
    return () => { cancelled = true }
  }, [requestVersion])

  return { dashboard, loading, error, refetch }
}
