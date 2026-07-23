import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useExamAttempt } from '../hooks/useExamAttempt'
import { useExamTimer } from '../hooks/useExamTimer'

function formatTime(milliseconds: number) {
  const totalSeconds = Math.ceil(milliseconds / 1_000)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

export default function StudentExamScreen() {
  const { t } = useTranslation()
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const { attempt, receivedAt, loading, error, refetch, saveAnswer, savingQuestionId, savingAnswers, saveErrors, submitting, submit, recoverTimedOutSubmit } = useExamAttempt(attemptId)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selected, setSelected] = useState<Record<string, string | null>>({})
  const [timeoutSubmitFailed, setTimeoutSubmitFailed] = useState(false)
  const submittedOnTimeout = useRef(false)
  const activeQuestion = attempt?.questions[activeIndex]
  const { remaining, expired } = useExamTimer(attempt?.deadline_at, attempt?.server_now, receivedAt, attempt?.status === 'in_progress')

  useEffect(() => {
    if (!attempt) return
    setSelected((current) => {
      const next = { ...current }
      attempt.questions.forEach((question) => { if (!(question.exam_question_id in next)) next[question.exam_question_id] = question.selected_option_id })
      return next
    })
    setActiveIndex((index) => Math.min(index, Math.max(0, attempt.questions.length - 1)))
  }, [attempt])

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') void refetch()
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refetch])

  useEffect(() => {
    if (!expired || attempt?.status !== 'in_progress' || submittedOnTimeout.current) return
    submittedOnTimeout.current = true
    void submit().then((result) => setTimeoutSubmitFailed(result === null))
  }, [attempt?.status, expired, submit])

  async function recoverTimeoutSubmission() {
    const result = await recoverTimedOutSubmit()
    setTimeoutSubmitFailed(result === null)
  }

  async function chooseAnswer(questionId: string, optionId: string) {
    if (expired || attempt?.status !== 'in_progress') return
    setSelected((current) => ({ ...current, [questionId]: optionId }))
    await saveAnswer(questionId, optionId)
  }

  async function confirmSubmit() {
    if (window.confirm(t('studentExam.confirmSubmit'))) await submit()
  }

  if (loading && !attempt) return <main className="min-h-screen bg-gray-50 p-6" aria-busy="true"><div className="mx-auto h-64 max-w-3xl animate-pulse rounded-lg bg-gray-200" /></main>
  if (error && !attempt) return <main className="min-h-screen bg-gray-50 p-6"><section className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow"><div role="alert" className="text-red-800">{t('studentExam.loadFailed')}</div><button type="button" onClick={() => void refetch()} className="mt-4 rounded bg-blue-700 px-4 py-2 text-white">{t('common.retry')}</button></section></main>
  if (!attempt) return <main className="min-h-screen bg-gray-50 p-6"><p className="text-center">{t('studentExam.empty')}</p></main>

  if (attempt.status === 'completed') {
    return <main className="min-h-screen bg-gray-50 p-6"><section className="mx-auto max-w-lg rounded-lg bg-white p-6 text-center shadow"><h1 className="text-2xl font-bold text-gray-900">{t('studentExam.resultTitle')}</h1><p className="mt-5 text-5xl font-bold text-blue-700">{attempt.result?.score ?? '—'}<span className="text-lg">%</span></p><p className="mt-4 text-lg text-gray-800">{attempt.result?.level ? `${attempt.result.level.code} - ${attempt.result.level.name}` : t('studentExam.resultUnavailable')}</p><p className="mt-2 text-sm text-gray-600">{t('studentExam.resultDescription')}</p><button type="button" onClick={() => navigate('/student')} className="mt-6 rounded bg-blue-700 px-4 py-2 font-medium text-white">{t('studentExam.backToDashboard')}</button></section></main>
  }

  if (!activeQuestion) return <main className="min-h-screen bg-gray-50 p-6"><p className="text-center">{t('studentExam.empty')}</p></main>
  const answered = attempt.questions.filter((question) => selected[question.exam_question_id]).length

  return <main className="min-h-screen bg-gray-50 p-4 sm:p-6"><section className="mx-auto max-w-4xl rounded-lg bg-white p-4 shadow sm:p-6"><header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"><div><h1 className="text-xl font-bold text-gray-900">{t('studentExam.title')}</h1><p className="text-sm text-gray-600">{t('studentExam.progress', { answered, total: attempt.questions.length })}</p></div><div role="timer" aria-live="polite" className={`rounded px-3 py-2 font-mono text-lg font-bold ${expired ? 'bg-red-100 text-red-800' : 'bg-blue-50 text-blue-800'}`}>{t('studentExam.timeRemaining', { time: formatTime(remaining) })}</div></header>
    {timeoutSubmitFailed && <div role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800"><p>{t('studentExam.timeoutSubmitFailed')}</p><div className="mt-2 flex gap-3"><button type="button" onClick={() => void recoverTimeoutSubmission()} disabled={submitting} className="font-medium underline">{t('studentExam.retrySubmission')}</button><button type="button" onClick={() => void refetch()} disabled={loading} className="font-medium underline">{t('studentExam.reloadAttempt')}</button></div></div>}
    {error && !timeoutSubmitFailed && <div role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <nav className="mt-4 flex flex-wrap gap-2" aria-label={t('studentExam.questionNavigation')}>{attempt.questions.map((question, index) => <button key={question.exam_question_id} type="button" onClick={() => setActiveIndex(index)} aria-current={index === activeIndex ? 'step' : undefined} className={`h-9 w-9 rounded border text-sm font-medium ${index === activeIndex ? 'border-blue-700 bg-blue-700 text-white' : selected[question.exam_question_id] ? 'border-green-600 bg-green-50 text-green-800' : 'border-gray-300 text-gray-700'}`}>{index + 1}</button>)}</nav>
    <article className="mt-6"><p className="text-sm text-gray-500">{t('studentExam.questionNumber', { number: activeIndex + 1, total: attempt.questions.length })}</p><h2 className="mt-2 text-lg font-semibold text-gray-900">{activeQuestion.text}</h2><fieldset className="mt-5 space-y-3" disabled={expired || savingQuestionId === activeQuestion.exam_question_id}><legend className="sr-only">{t('studentExam.selectAnswer')}</legend>{activeQuestion.options.map((option) => <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded border border-gray-200 p-3 hover:bg-gray-50"><input type="radio" name={activeQuestion.exam_question_id} checked={selected[activeQuestion.exam_question_id] === option.id} onChange={() => void chooseAnswer(activeQuestion.exam_question_id, option.id)} /><span>{option.text}</span></label>)}</fieldset>
      {savingQuestionId === activeQuestion.exam_question_id && <p role="status" className="mt-3 text-sm text-gray-600">{t('studentExam.saving')}</p>}
      {saveErrors[activeQuestion.exam_question_id] && <p role="alert" className="mt-3 text-sm text-red-700">{t('studentExam.saveFailed')} <button type="button" onClick={() => { const optionId = selected[activeQuestion.exam_question_id]; if (optionId) void saveAnswer(activeQuestion.exam_question_id, optionId) }} className="font-medium underline">{t('common.retry')}</button></p>}
    </article>
    <footer className="mt-8 flex flex-wrap justify-between gap-3 border-t pt-4"><button type="button" onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} disabled={activeIndex === 0} className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50">{t('studentExam.previous')}</button><button type="button" onClick={() => setActiveIndex((index) => Math.min(attempt.questions.length - 1, index + 1))} disabled={activeIndex === attempt.questions.length - 1} className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50">{t('studentExam.next')}</button><button type="button" onClick={() => void confirmSubmit()} disabled={expired || savingAnswers || submitting} className="rounded bg-blue-700 px-4 py-2 font-medium text-white disabled:bg-gray-400">{submitting ? t('studentExam.submitting') : t('studentExam.submit')}</button></footer>
  </section></main>
}
