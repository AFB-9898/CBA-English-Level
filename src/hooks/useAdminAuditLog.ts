import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AdminAuditActor, AdminAuditFilters, AdminAuditRow } from '../types'

interface AuditCursor {
  createdAt: string
  id: string
}

export interface UseAdminAuditLogResult {
  rows: AdminAuditRow[]
  actors: AdminAuditActor[]
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

function rpcParams(filters: AdminAuditFilters, cursor: AuditCursor | null, pageSize: number) {
  return {
    p_created_from: filters.createdFrom || null,
    p_created_to: filters.createdTo || null,
    p_admin_id: filters.adminId || null,
    p_entity: filters.entity || null,
    p_action: filters.action || null,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_page_size: pageSize + 1,
  }
}

export function useAdminAuditLog(filters: AdminAuditFilters, pageSize = 25): UseAdminAuditLogResult {
  const [rows, setRows] = useState<AdminAuditRow[]>([])
  const [actors, setActors] = useState<AdminAuditActor[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingNextPage, setLoadingNextPage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [cursor, setCursor] = useState<AuditCursor | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((key) => key + 1), [])

  useEffect(() => {
    let cancelled = false

    async function loadFirstPage() {
      setLoading(true)
      setError(null)
      setRows([])
      setCursor(null)
      try {
        const [{ data, error: auditError }, { data: actorData, error: actorError }] = await Promise.all([
          supabase.rpc('get_admin_audit_log', rpcParams(filters, null, pageSize)),
          supabase.rpc('get_admin_audit_actors'),
        ])
        if (cancelled) return
        if (auditError) throw auditError
        if (actorError) throw actorError
        const page = (data ?? []) as AdminAuditRow[]
        const visibleRows = page.slice(0, pageSize)
        setRows(visibleRows)
        setActors((actorData ?? []) as AdminAuditActor[])
        setHasNextPage(page.length > pageSize)
        const lastRow = visibleRows[visibleRows.length - 1]
        setCursor(lastRow ? { createdAt: lastRow.created_at, id: lastRow.audit_id } : null)
      } catch (err) {
        if (!cancelled) setError(mapError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadFirstPage()
    return () => { cancelled = true }
  }, [filters.createdFrom, filters.createdTo, filters.adminId, filters.entity, filters.action, pageSize, fetchKey])

  const loadNextPage = useCallback(async () => {
    if (!cursor || !hasNextPage || loadingNextPage) return
    setLoadingNextPage(true)
    setError(null)
    try {
      const { data, error: auditError } = await supabase.rpc('get_admin_audit_log', rpcParams(filters, cursor, pageSize))
      if (auditError) throw auditError
      const page = (data ?? []) as AdminAuditRow[]
      const visibleRows = page.slice(0, pageSize)
      setRows((current) => [...current, ...visibleRows])
      setHasNextPage(page.length > pageSize)
      const lastRow = visibleRows[visibleRows.length - 1]
      if (lastRow) setCursor({ createdAt: lastRow.created_at, id: lastRow.audit_id })
    } catch (err) {
      setError(mapError(err))
    } finally {
      setLoadingNextPage(false)
    }
  }, [cursor, filters, hasNextPage, loadingNextPage, pageSize])

  return { rows, actors, loading, loadingNextPage, error, hasNextPage, loadNextPage, refetch }
}
