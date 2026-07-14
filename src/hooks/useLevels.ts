import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Level } from '../types'

export interface UseLevelsResult {
  levels: Level[]
  loading: boolean
  error: string | null
}

export function useLevels(): UseLevelsResult {
  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchLevels() {
      setLoading(true)
      setError(null)

      try {
        const { data, error: supaError } = await supabase
          .from('level')
          .select('*')
          .order('min_score', { ascending: true })

        if (cancelled) return

        if (supaError) {
          throw new Error(supaError.message)
        }

        setLevels((data ?? []) as Level[])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchLevels()

    return () => {
      cancelled = true
    }
  }, [])

  return { levels, loading, error }
}
