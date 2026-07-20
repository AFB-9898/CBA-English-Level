import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AdminReportRow, ReportFilters } from '../types'

const EXPORT_ROW_LIMIT = 5000

export interface UseReportsResult {
  rows: AdminReportRow[]
  loading: boolean
  error: string | null
  hasNextPage: boolean
  refetch: () => void
  loadExportRows: () => Promise<{ data: AdminReportRow[]; error: string | null }>
}

function mapError(error: unknown): string {
  const value = error as { message?: string } | null
  return value?.message || (error instanceof Error ? error.message : 'Unknown error')
}

function rpcParams(filters: ReportFilters, page: number, pageSize: number) {
  return {
    p_completed_from: filters.completedFrom || null,
    p_completed_to: filters.completedTo || null,
    p_level_id: filters.levelId || null,
    p_status: filters.status || null,
    p_page: page,
    p_page_size: pageSize,
  }
}

export function useReports(filters: ReportFilters, page: number, pageSize = 25): UseReportsResult {
  const [rows, setRows] = useState<AdminReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((key) => key + 1), [])

  useEffect(() => {
    let cancelled = false

    async function loadRows() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: rpcError } = await supabase.rpc('get_admin_exam_report', rpcParams(filters, page, pageSize))
        if (cancelled) return
        if (rpcError) throw rpcError
        setRows((data ?? []) as AdminReportRow[])
      } catch (err) {
        if (!cancelled) setError(mapError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRows()
    return () => { cancelled = true }
  }, [filters.completedFrom, filters.completedTo, filters.levelId, filters.status, page, pageSize, fetchKey])

  const loadExportRows = useCallback(async (): Promise<{ data: AdminReportRow[]; error: string | null }> => {
    try {
      const rows: AdminReportRow[] = []
      let exportPage = 1
      while (true) {
        const { data, error: rpcError } = await supabase.rpc('get_admin_exam_report', rpcParams(filters, exportPage, EXPORT_ROW_LIMIT))
        if (rpcError) return { data: [], error: mapError(rpcError) }
        const exportRows = (data ?? []) as AdminReportRow[]
        rows.push(...exportRows)
        if (exportRows.length < EXPORT_ROW_LIMIT) return { data: rows, error: null }
        exportPage += 1
      }
    } catch (err) {
      return { data: [], error: mapError(err) }
    }
  }, [filters.completedFrom, filters.completedTo, filters.levelId, filters.status])

  return { rows, loading, error, hasNextPage: rows.length === pageSize, refetch, loadExportRows }
}
