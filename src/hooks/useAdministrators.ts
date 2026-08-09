import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Administrator } from '../types'

export function useAdministrators() {
  const [administrators, setAdministrators] = useState<Administrator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const refetch = useCallback(() => setVersion((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.rpc('get_administrators')
      if (cancelled) return
      if (error) setError(error.message)
      else setAdministrators((data ?? []) as Administrator[])
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [version])

  const updateAdministrator = useCallback(async (administrator: Administrator) => {
    const { error } = await supabase.rpc('update_administrator', {
      p_admin_id: administrator.id,
      p_full_name: administrator.full_name,
      p_role: administrator.role,
      p_is_active: administrator.is_active,
    })
    if (!error) refetch()
    return error?.message ?? null
  }, [refetch])

  const inviteAdministrator = useCallback(async (email: string, fullName: string) => {
    const { error } = await supabase.functions.invoke('invite-administrator', { body: { email, full_name: fullName } })
    if (!error) refetch()
    return error?.message ?? null
  }, [refetch])

  return { administrators, loading, error, refetch, updateAdministrator, inviteAdministrator }
}
