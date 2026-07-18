import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type {
  ActiveLevelDistribution,
  Level,
  LevelMutationResult,
  LevelDistributionMutation,
  ReplaceActiveLevelDistributionInput,
  UpdateLevelMetadataInput,
} from '../types'

export interface UseLevelsOptions {
  includeHistorical?: boolean
}

export interface UseLevelsResult {
  levels: Level[]
  loading: boolean
  error: string | null
  /** Optional keeps existing question and screen test doubles source-compatible. */
  activeDistribution?: ActiveLevelDistribution | null
  replaceActiveLevelDistribution?: (input: ReplaceActiveLevelDistributionInput) => Promise<LevelMutationResult<LevelDistributionMutation>>
  updateLevelMetadata?: (input: UpdateLevelMetadataInput) => Promise<LevelMutationResult>
  refetch?: () => void
}

interface SupabaseError {
  message?: string
  code?: string
}

function mapError(error: unknown): { error: string; code?: string } {
  const value = error as SupabaseError | null
  return {
    error: value?.message || (error instanceof Error ? error.message : 'Unknown error'),
    ...(value?.code ? { code: value.code } : {}),
  }
}

export function useLevels({ includeHistorical = false }: UseLevelsOptions = {}): UseLevelsResult {
  const [levels, setLevels] = useState<Level[]>([])
  const [activeDistribution, setActiveDistribution] = useState<ActiveLevelDistribution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((key) => key + 1), [])

  useEffect(() => {
    let cancelled = false

    async function fetchLevels() {
      setLoading(true)
      setError(null)

      try {
        let query = supabase.from('level').select('*')
        if (!includeHistorical) query = query.eq('is_active', true)
        const [{ data, error: supaError }, { data: revisionRow, error: revisionError }] = await Promise.all([
          query.order('min_score', { ascending: true }),
          supabase.from('level_partition_revision').select('revision').eq('id', true).single(),
        ])

        if (cancelled) return

        if (supaError) throw supaError
        if (revisionError) throw revisionError

        const loadedLevels = (data ?? []) as Level[]
        setLevels(loadedLevels)
        setActiveDistribution({
          revision: Number((revisionRow as { revision: number }).revision),
          levels: loadedLevels
            .filter((level) => level.is_active !== false)
            .map(({ id, min_score, max_score }) => ({ id, min_score, max_score })),
        })
      } catch (err) {
        if (!cancelled) {
          setError(mapError(err).error)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchLevels()

    return () => {
      cancelled = true
    }
  }, [includeHistorical, fetchKey])

  const invoke = useCallback(async <T = Level>(name: string, body: Record<string, unknown>): Promise<LevelMutationResult<T>> => {
    try {
      const { data, error: supaError } = await supabase.rpc(name, body)
      if (supaError) {
        const mapped = mapError(supaError)
        if (mapped.code === '40001') refetch()
        return { data: null, ...mapped, ...(mapped.code === '40001' ? { conflict: true } : {}) }
      }
      if (data == null) return { data: null, error: 'Mutation returned no data' }
      refetch()
      return { data: data as T, error: null }
    } catch (err) {
      return { data: null, ...mapError(err) }
    }
  }, [])

  const replaceActiveLevelDistribution = useCallback(async (input: ReplaceActiveLevelDistributionInput) => {
    const before = activeDistribution ?? { revision: input.expected_revision, levels: [] }
    const response = await invoke<{ revision: number; deactivated_level_id?: string | null }>('replace_active_level_distribution', {
      p_expected_revision: input.expected_revision,
      p_levels: input.levels,
      p_deactivate_level_id: input.deactivate_level_id ?? null,
    })
    if (response.error || !response.data) return response as LevelMutationResult<LevelDistributionMutation>
    return {
      ...response,
      data: {
        revision: response.data.revision,
        deactivated_level_id: response.data.deactivated_level_id ?? input.deactivate_level_id ?? null,
        before,
        after: { revision: response.data.revision, levels: input.levels },
      },
    }
  }, [activeDistribution, invoke])

  const updateLevelMetadata = useCallback((input: UpdateLevelMetadataInput) => invoke('update_level_metadata', {
    p_level_id: input.level_id,
    p_name: input.name,
    p_description: input.description,
  }), [invoke])

  return { levels, loading, error, activeDistribution, replaceActiveLevelDistribution, updateLevelMetadata, refetch }
}
