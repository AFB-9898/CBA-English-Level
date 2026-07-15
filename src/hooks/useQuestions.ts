import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { QuestionWithLevel, QuestionFormData } from '../types'

export interface UseQuestionsResult {
  questions: QuestionWithLevel[]
  total: number
  loading: boolean
  error: string | null
  createQuestion: (data: QuestionFormData) => Promise<{ error: string | null; code?: string }>
  updateQuestion: (id: string, data: QuestionFormData) => Promise<{ error: string | null; code?: string }>
  deleteQuestion: (id: string) => Promise<{ error: string | null; code?: string }>
  refetch: () => void
}

interface UseQuestionsOptions {
  levelId?: string
  category?: string
  page?: number
  pageSize?: number
}

export function useQuestions(options: UseQuestionsOptions = {}): UseQuestionsResult {
  const { levelId, category, page = 1, pageSize = 10 } = options

  const [questions, setQuestions] = useState<QuestionWithLevel[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => setFetchKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false

    async function fetchQuestions() {
      setLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('question')
          .select('*, level:level_id(*)', { count: 'exact' })

        if (levelId) {
          query = query.eq('level_id', levelId)
        }
        if (category) {
          query = query.ilike('category', `%${category}%`)
        }

        // Order by most recent first
        query = query.order('created_at', { ascending: false })

        // Pagination via range
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1
        query = query.range(from, to)

        const { data, error: supaError, count } = await query

        if (cancelled) return

        if (supaError) {
          throw new Error(supaError.message)
        }

        setQuestions((data ?? []) as QuestionWithLevel[])
        setTotal(count ?? 0)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchQuestions()

    return () => {
      cancelled = true
    }
  }, [levelId, category, page, pageSize, fetchKey])

  const createQuestion = useCallback(
    async (data: QuestionFormData): Promise<{ error: string | null; code?: string }> => {
      try {
        // Insert the question
        const { data: question, error: qError } = await supabase
          .from('question')
          .insert({
            text: data.text,
            level_id: data.level_id,
            category: data.category || null,
          })
          .select()
          .single()

        if (qError) return { error: qError.message, code: (qError as any).code }

        // Insert options with order
        const optionsPayload = data.options.map((opt, index) => ({
          question_id: question.id,
          text: opt.text,
          is_correct: opt.is_correct,
          order: index,
        }))

        const { error: oError } = await supabase
          .from('question_option')
          .insert(optionsPayload)

        if (oError) { await supabase.from('question').delete().eq('id', question.id); return { error: oError.message } }

        refetch()
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Unknown error' }
      }
    },
    [refetch],
  )

  const updateQuestion = useCallback(
    async (id: string, data: QuestionFormData): Promise<{ error: string | null; code?: string }> => {
      try {
        // Update the question
        const { error: qError } = await supabase
          .from('question')
          .update({
            text: data.text,
            level_id: data.level_id,
            category: data.category || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        if (qError) return { error: qError.message, code: (qError as any).code }

        const { data: savedOptions } = await supabase.from('question_option').select('*').eq('question_id', id).order('order')

        // Delete old options
        const { error: dError } = await supabase
          .from('question_option')
          .delete()
          .eq('question_id', id)

        if (dError) return { error: dError.message }

        // Insert new options with order
        const optionsPayload = data.options.map((opt, index) => ({
          question_id: id,
          text: opt.text,
          is_correct: opt.is_correct,
          order: index,
        }))

        const { error: oError } = await supabase
          .from('question_option')
          .insert(optionsPayload)

        if (oError) {
          if (savedOptions?.length) await supabase.from('question_option').insert(savedOptions.map((o) => ({ id: o.id, question_id: id, text: o.text, is_correct: o.is_correct, order: o.order })))
          return { error: oError.message }
        }

        refetch()
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Unknown error' }
      }
    },
    [refetch],
  )

  const deleteQuestion = useCallback(
    async (id: string): Promise<{ error: string | null; code?: string }> => {
      try {
        const { error: dError } = await supabase
          .from('question')
          .delete()
          .eq('id', id)

        if (dError) return { error: dError.message, code: (dError as any).code }

        refetch()
        return { error: null }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Unknown error' }
      }
    },
    [refetch],
  )

  return { questions, total, loading, error, createQuestion, updateQuestion, deleteQuestion, refetch }
}
