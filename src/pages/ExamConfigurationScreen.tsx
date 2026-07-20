import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useExamConfig } from '../hooks/useExamConfig'

type FormState = {
  time_limit_minutes: string
  questions_per_exam: string
  passing_score: string
}

const emptyForm: FormState = { time_limit_minutes: '', questions_per_exam: '', passing_score: '' }

function toFormState(config: { time_limit_minutes: number; questions_per_exam: number; passing_score: number }): FormState {
  return {
    time_limit_minutes: String(config.time_limit_minutes),
    questions_per_exam: String(config.questions_per_exam),
    passing_score: String(config.passing_score),
  }
}

export default function ExamConfigurationScreen() {
  const { t } = useTranslation()
  const { config, loading, error, refetch, updateExamConfig } = useExamConfig()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  useEffect(() => {
    if (config) setForm(toFormState(config))
  }, [config])

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setFormError(null)
    setNotice(null)
  }

  function validate(): { values: Record<keyof FormState, number> } | { error: string } {
    const values = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)])) as Record<keyof FormState, number>
    if (Object.values(form).some((value) => !/^\d+$/.test(value))) return { error: t('examConfiguration.validation.wholeNumbers') }
    if (values.time_limit_minutes <= 0) return { error: t('examConfiguration.validation.timeLimit') }
    if (values.questions_per_exam <= 0) return { error: t('examConfiguration.validation.questions') }
    if (values.passing_score < 0 || values.passing_score > 100) return { error: t('examConfiguration.validation.passingScore') }
    return { values }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingRef.current || !config) return
    setFormError(null)
    setNotice(null)

    const validation = validate()
    if ('error' in validation) { setFormError(validation.error); return }
    const { values } = validation
    if (values.time_limit_minutes === config.time_limit_minutes && values.questions_per_exam === config.questions_per_exam && values.passing_score === config.passing_score) {
      setFormError(t('examConfiguration.validation.noChanges'))
      return
    }

    savingRef.current = true
    setSaving(true)
    const result = await updateExamConfig({ expected_revision: config.revision, ...values })
    savingRef.current = false
    setSaving(false)
    if (result.error || !result.data) {
      if (result.conflict) setFormError(t('examConfiguration.errors.conflict'))
      else if (result.code === '42501') setFormError(t('examConfiguration.errors.permission'))
      else setFormError(result.error || t('examConfiguration.errors.saveFailed'))
      return
    }
    setForm(toFormState(result.data))
    setNotice(t('examConfiguration.success.saved'))
  }

  const disabled = loading || saving || !config

  return <div className="max-w-3xl space-y-6">
    <div>
      <h1 className="text-xl font-semibold text-gray-900">{t('examConfiguration.title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('examConfiguration.subtitle')}</p>
    </div>

    {loading && <div className="rounded-xl border border-gray-200 bg-white p-5" aria-busy="true"><div className="h-32 animate-pulse rounded bg-gray-100" /></div>}
    {!loading && error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong>{t('examConfiguration.errors.title')}</strong><p>{t('examConfiguration.errors.loadFailed')}</p><p className="mt-1 text-red-500">{error}</p><button type="button" onClick={refetch} className="mt-3 rounded border border-red-300 px-3 py-1.5 font-medium">{t('examConfiguration.actions.retry')}</button></div>}
    {!loading && !error && !config && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>{t('examConfiguration.empty.title')}</strong><p>{t('examConfiguration.empty.message')}</p><button type="button" onClick={refetch} className="mt-3 rounded border border-amber-300 px-3 py-1.5 font-medium">{t('examConfiguration.actions.retry')}</button></div>}

    {!loading && !error && config && <form onSubmit={submit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800"><strong>{t('examConfiguration.passingScoreNote.title')}</strong><p className="mt-1">{t('examConfiguration.passingScoreNote.message')}</p></div>
      {(formError || notice) && <div role="alert" className={`rounded-lg border p-4 text-sm ${notice ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}><strong>{notice ? t('examConfiguration.success.title') : t('examConfiguration.errors.title')}</strong><p>{notice || formError}</p></div>}
      <div className="grid gap-5 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm font-medium text-gray-700" htmlFor="time-limit-minutes">{t('examConfiguration.fields.timeLimit')}<input id="time-limit-minutes" type="number" inputMode="numeric" min="1" step="1" value={form.time_limit_minutes} onChange={(event) => updateField('time_limit_minutes', event.target.value)} disabled={disabled} required className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100" /></label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700" htmlFor="questions-per-exam">{t('examConfiguration.fields.questions')}<input id="questions-per-exam" type="number" inputMode="numeric" min="1" step="1" value={form.questions_per_exam} onChange={(event) => updateField('questions_per_exam', event.target.value)} disabled={disabled} required className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100" /></label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700" htmlFor="passing-score">{t('examConfiguration.fields.passingScore')}<input id="passing-score" type="number" inputMode="numeric" min="0" max="100" step="1" value={form.passing_score} onChange={(event) => updateField('passing_score', event.target.value)} disabled={disabled} required className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100" /></label>
      </div>
      <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-gray-500">{t('examConfiguration.revision', { revision: config.revision })}</p><button type="submit" disabled={disabled} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? t('examConfiguration.actions.saving') : t('examConfiguration.actions.save')}</button></div>
    </form>}
  </div>
}
