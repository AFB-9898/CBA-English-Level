import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useLevels } from './useLevels'
import { useQuestions } from './useQuestions'
import type { QuestionOptionFormData } from '../types'

const MIN_OPTIONS = 4
const MAX_OPTIONS = 10

function emptyOptions(): QuestionOptionFormData[] {
  return Array.from({ length: MIN_OPTIONS }, () => ({ text: '', is_correct: false }))
}

export function useQuestionForm(mode: 'create' | 'edit', questionId?: string) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { levels, loading: levelsLoading } = useLevels()
  const { createQuestion, updateQuestion } = useQuestions()

  const [text, setText] = useState('')
  const [levelId, setLevelId] = useState('')
  const [category, setCategory] = useState('')
  const [options, setOptions] = useState<QuestionOptionFormData[]>(emptyOptions)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingQuestion, setLoadingQuestion] = useState(mode === 'edit')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (mode !== 'edit' || !questionId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('question').select('*, question_option(*)').eq('id', questionId).single()
        if (cancelled) return
        if (error || !data) { setNotFound(true); return }
        setText(data.text)
        setLevelId(data.level_id)
        setCategory(data.category ?? '')
        setOptions(
          (data.question_option ?? [])
            .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
            .map((o: { id: string; text: string; is_correct: boolean }) => ({ id: o.id, text: o.text, is_correct: o.is_correct })),
        )
      } catch { if (!cancelled) setNotFound(true) }
      finally { if (!cancelled) setLoadingQuestion(false) }
    })()
    return () => { cancelled = true }
  }, [mode, questionId])

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!text.trim()) e.text = t('questions.validation.textRequired')
    if (!levelId) e.levelId = t('questions.validation.levelRequired')
    if (category.length > 100) e.category = t('questions.validation.categoryTooLong')
    if (options.length < MIN_OPTIONS) e.options = t('questions.validation.minOptions')
    if (options.length > MAX_OPTIONS) e.options = t('questions.validation.maxOptions')
    if (!options.some((o) => o.is_correct)) e.correct = t('questions.validation.correctRequired')
    options.forEach((opt, i) => { if (!opt.text.trim()) e[`option_${i}`] = t('questions.validation.optionTextRequired') })
    return e
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGeneralError(null)
    const errs = validate()
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})
    setSubmitting(true)
    try {
      const payload = {
        text: text.trim(), level_id: levelId, category: category.trim(),
        options: options.map((o) => ({ text: o.text.trim(), is_correct: o.is_correct })),
      }
      const result = mode === 'create'
        ? await createQuestion(payload)
        : await updateQuestion(questionId!, payload)
      if (result.error) { setGeneralError(result.error); return }
      navigate('/admin/questions')
    } catch {
      setGeneralError(mode === 'create' ? t('questions.errors.createFailed') : t('questions.errors.updateFailed'))
    } finally { setSubmitting(false) }
  }

  const addOption = useCallback(() => { if (options.length < MAX_OPTIONS) setOptions((p) => [...p, { text: '', is_correct: false }]) }, [options.length])
  const removeOption = useCallback((i: number) => { if (options.length > MIN_OPTIONS) setOptions((p) => p.filter((_, j) => j !== i)) }, [options.length])
  const updateOptionText = useCallback((i: number, v: string) => { setOptions((p) => p.map((o, j) => (j === i ? { ...o, text: v } : o))) }, [])
  const selectCorrect = useCallback((i: number) => { setOptions((p) => p.map((o, j) => ({ ...o, is_correct: j === i }))) }, [])

  return {
    text, setText, levelId, setLevelId, category, setCategory,
    options, fieldErrors, generalError, submitting, loadingQuestion, notFound,
    levels, levelsLoading,
    addOption, removeOption, updateOptionText, selectCorrect, handleSubmit,
  }
}
