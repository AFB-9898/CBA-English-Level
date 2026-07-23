import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ExamAttempt } from '../types/examAttempt'

function errorMessage(error: unknown): string {
  const value = error as { message?: string } | null
  return value?.message || (error instanceof Error ? error.message : 'Unknown error')
}

export function useExamAttempt(attemptId: string | undefined) {
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null)
  const [receivedAt, setReceivedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null)
  const [savingAnswers, setSavingAnswers] = useState(false)
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const mounted = useRef(true)
  const saveRequestId = useRef(0)
  const pendingSaves = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const applyAttempt = useCallback((next: ExamAttempt) => {
    if (!mounted.current) return
    setAttempt(next)
    setReceivedAt(Date.now())
  }, [])

  const refetch = useCallback(async () => {
    if (!attemptId) {
      if (mounted.current) {
        setError('Exam attempt is missing')
        setLoading(false)
      }
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_exam_attempt', { p_attempt_id: attemptId })
      if (rpcError) throw rpcError
      if (!data) throw new Error('Exam attempt not found')
      applyAttempt(data as ExamAttempt)
      return data as ExamAttempt
    } catch (err) {
      if (mounted.current) setError(errorMessage(err))
      return null
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [applyAttempt, attemptId])

  useEffect(() => { void refetch() }, [refetch])

  const saveAnswer = useCallback(async (questionId: string, optionId: string) => {
    if (!attemptId) return null
    const requestId = ++saveRequestId.current
    pendingSaves.current += 1
    setSavingQuestionId(questionId)
    setSavingAnswers(true)
    setSaveErrors((errors) => ({ ...errors, [questionId]: '' }))
    try {
      const { data, error: rpcError } = await supabase.rpc('save_exam_answer', {
        p_attempt_id: attemptId,
        p_exam_question_id: questionId,
        p_option_id: optionId,
      })
      if (rpcError) throw rpcError
      if (!data) throw new Error('Save answer returned no response')
      const response = data as ExamAttempt
      if (requestId === saveRequestId.current) applyAttempt(response)
      return response
    } catch (err) {
      if (mounted.current && requestId === saveRequestId.current) setSaveErrors((errors) => ({ ...errors, [questionId]: errorMessage(err) }))
      return null
    } finally {
      pendingSaves.current -= 1
      if (mounted.current) {
        setSavingQuestionId(null)
        setSavingAnswers(pendingSaves.current > 0)
      }
    }
  }, [applyAttempt, attemptId])

  const submit = useCallback(async () => {
    if (!attemptId || submitting) return null
    setSubmitting(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('submit_exam', { p_attempt_id: attemptId })
      if (rpcError) throw rpcError
      if (!data) throw new Error('Submit exam returned no result')
      applyAttempt(data as ExamAttempt)
      return data as ExamAttempt
    } catch (err) {
      if (mounted.current) setError(errorMessage(err))
      return null
    } finally {
      if (mounted.current) setSubmitting(false)
    }
  }, [applyAttempt, attemptId, submitting])

  const recoverTimedOutSubmit = useCallback(async () => {
    const current = await refetch()
    if (!current || current.status === 'completed') return current
    return submit()
  }, [refetch, submit])

  return { attempt, receivedAt, loading, error, refetch, saveAnswer, savingQuestionId, savingAnswers, saveErrors, submitting, submit, recoverTimedOutSubmit }
}
