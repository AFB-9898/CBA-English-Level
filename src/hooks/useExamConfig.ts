import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ExamConfig, ExamConfigMutationResult, UpdateExamConfigInput } from '../types'

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

export interface UseExamConfigResult {
  config: ExamConfig | null
  loading: boolean
  error: string | null
  refetch: () => void
  updateExamConfig: (input: UpdateExamConfigInput) => Promise<ExamConfigMutationResult>
}

export function useExamConfig(): UseExamConfigResult {
  const [config, setConfig] = useState<ExamConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((key) => key + 1), [])

  useEffect(() => {
    let cancelled = false

    async function fetchConfig() {
      setLoading(true)
      setError(null)

      try {
        const { data, error: supabaseError } = await supabase
          .from('exam_config')
          .select('*')
          .eq('singleton', true)
          .maybeSingle()

        if (cancelled) return
        if (supabaseError) throw supabaseError
        setConfig(data as ExamConfig | null)
      } catch (err) {
        if (!cancelled) setError(mapError(err).error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchConfig()
    return () => { cancelled = true }
  }, [fetchKey])

  const updateExamConfig = useCallback(async (input: UpdateExamConfigInput): Promise<ExamConfigMutationResult> => {
    try {
      const { data, error: supabaseError } = await supabase.rpc('update_exam_config', {
        p_expected_revision: input.expected_revision,
        p_time_limit_minutes: input.time_limit_minutes,
        p_questions_per_exam: input.questions_per_exam,
        p_passing_score: input.passing_score,
      })
      if (supabaseError) {
        const mapped = mapError(supabaseError)
        if (mapped.code === '40001') refetch()
        return { data: null, ...mapped, ...(mapped.code === '40001' ? { conflict: true } : {}) }
      }
      if (data == null) return { data: null, error: 'Mutation returned no data' }
      refetch()
      return { data: data as ExamConfig, error: null }
    } catch (err) {
      return { data: null, ...mapError(err) }
    }
  }, [refetch])

  return { config, loading, error, refetch, updateExamConfig }
}
