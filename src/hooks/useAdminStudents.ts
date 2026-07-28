import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AdminStudentListRow } from '../types'

interface StudentCursor {
  fullName: string
  id: string
}

export interface UseAdminStudentsResult {
  students: AdminStudentListRow[]
  loading: boolean
  loadingNextPage: boolean
  error: string | null
  hasNextPage: boolean
  loadNextPage: () => void
  refetch: () => void
}

function mapError(error: unknown): string {
  const value = error as { message?: string } | null
  return value?.message || (error instanceof Error ? error.message : 'Unknown error')
}

function rpcParams(search: string, cursor: StudentCursor | null, pageSize: number) {
  return {
    p_search: search.trim() || null,
    p_cursor_full_name: cursor?.fullName ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_page_size: pageSize + 1,
  }
}

export function useAdminStudents(search: string, pageSize = 25): UseAdminStudentsResult {
  const [students, setStudents] = useState<AdminStudentListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingNextPage, setLoadingNextPage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [cursor, setCursor] = useState<StudentCursor | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((key) => key + 1), [])

  useEffect(() => {
    let cancelled = false

    async function loadFirstPage() {
      setLoading(true)
      setError(null)
      setStudents([])
      setCursor(null)
      try {
        const { data, error: rpcError } = await supabase.rpc('get_admin_students', rpcParams(search, null, pageSize))
        if (cancelled) return
        if (rpcError) throw rpcError
        const page = (data ?? []) as AdminStudentListRow[]
        const visibleRows = page.slice(0, pageSize)
        setStudents(visibleRows)
        setHasNextPage(page.length > pageSize)
        const lastRow = visibleRows[visibleRows.length - 1]
        setCursor(lastRow ? { fullName: lastRow.full_name, id: lastRow.student_id } : null)
      } catch (err) {
        if (!cancelled) setError(mapError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadFirstPage()
    return () => { cancelled = true }
  }, [search, pageSize, fetchKey])

  const loadNextPage = useCallback(async () => {
    if (!cursor || !hasNextPage || loadingNextPage) return
    setLoadingNextPage(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_admin_students', rpcParams(search, cursor, pageSize))
      if (rpcError) throw rpcError
      const page = (data ?? []) as AdminStudentListRow[]
      const visibleRows = page.slice(0, pageSize)
      setStudents((current) => [...current, ...visibleRows])
      setHasNextPage(page.length > pageSize)
      const lastRow = visibleRows[visibleRows.length - 1]
      if (lastRow) setCursor({ fullName: lastRow.full_name, id: lastRow.student_id })
    } catch (err) {
      setError(mapError(err))
    } finally {
      setLoadingNextPage(false)
    }
  }, [cursor, hasNextPage, loadingNextPage, pageSize, search])

  return { students, loading, loadingNextPage, error, hasNextPage, loadNextPage, refetch }
}
