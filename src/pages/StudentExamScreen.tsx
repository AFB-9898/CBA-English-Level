import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import StudentNavigation from '../components/organisms/StudentNavigation'
import { useExamAttempt } from '../hooks/useExamAttempt'
import { useExamTimer } from '../hooks/useExamTimer'

function formatTime(milliseconds: number) {
  const totalSeconds = Math.ceil(milliseconds / 1_000)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function StudentExamPage({ children }: { children: React.ReactNode }) {
  return <div className="cba-auth cba-student cba-student-exam"><StudentNavigation />{children}</div>
}

export default function StudentExamScreen() {
  const { t } = useTranslation()
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const { attempt, receivedAt, loading, error, refetch, saveAnswer, waitForPendingAnswerSaves, savingQuestionId, savingAnswers, saveErrors, submitting, submit, recoverTimedOutSubmit } = useExamAttempt(attemptId)
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
    void waitForPendingAnswerSaves().then(async (saved) => {
      if (!saved) {
        setTimeoutSubmitFailed(true)
        return
      }
      const result = await submit()
      setTimeoutSubmitFailed(result === null)
    })
  }, [attempt?.status, expired, submit, waitForPendingAnswerSaves])

  async function recoverTimeoutSubmission() {
    if (!await waitForPendingAnswerSaves()) {
      setTimeoutSubmitFailed(true)
      return
    }
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

  if (loading && !attempt) return <StudentExamPage><main className="cba-student__content" aria-busy="true"><div className="cba-student__skeleton cba-student-exam__skeleton" /></main></StudentExamPage>
  if (error && !attempt) return <StudentExamPage><main className="cba-student__content"><section className="cba-student__card cba-student-exam__message"><div role="alert" className="cba-student__alert">{t('studentExam.loadFailed')}</div><button type="button" onClick={() => void refetch()} className="cba-student__primary-action">{t('common.retry')}</button></section></main></StudentExamPage>
  if (!attempt) return <StudentExamPage><main className="cba-student__content"><p className="cba-student__empty cba-student-exam__message">{t('studentExam.empty')}</p></main></StudentExamPage>

  if (attempt.status === 'completed') {
    return <StudentExamPage><main className="cba-student__content"><section className="cba-student__card cba-student-exam__result"><p className="cba-student__eyebrow">{t('studentExam.title')}</p><h1 className="cba-student__title">{t('studentExam.resultTitle')}</h1><div className="cba-student-exam__score"><span>{attempt.result?.score ?? '—'}</span><small>%</small></div><p className="cba-student-exam__level">{attempt.result?.level ? `${attempt.result.level.code} - ${attempt.result.level.name}` : t('studentExam.resultUnavailable')}</p><p className="cba-student__subtitle">{t('studentExam.resultDescription')}</p><button type="button" onClick={() => navigate('/student')} className="cba-student__primary-action">{t('studentExam.backToDashboard')}</button></section></main></StudentExamPage>
  }

  if (!activeQuestion) return <StudentExamPage><main className="cba-student__content"><p className="cba-student__empty cba-student-exam__message">{t('studentExam.empty')}</p></main></StudentExamPage>
  const answered = attempt.questions.filter((question) => selected[question.exam_question_id]).length

  return <StudentExamPage><main className="cba-student__content"><section className="cba-student__card cba-student-exam__card"><header className="cba-student-exam__header"><div><p className="cba-student__eyebrow">{t('studentExam.title')}</p><h1 className="cba-student-exam__heading">{t('studentExam.progress', { answered, total: attempt.questions.length })}</h1></div><div role="timer" aria-live="polite" className={`cba-student-exam__timer${expired ? ' cba-student-exam__timer--expired' : ''}`}>{t('studentExam.timeRemaining', { time: formatTime(remaining) })}</div></header>
    {timeoutSubmitFailed && <div role="alert" className="cba-student__alert cba-student-exam__alert"><p>{t('studentExam.timeoutSubmitFailed')}</p><div className="cba-student-exam__alert-actions"><button type="button" onClick={() => void recoverTimeoutSubmission()} disabled={submitting} className="cba-student__retry">{t('studentExam.retrySubmission')}</button><button type="button" onClick={() => void refetch()} disabled={loading} className="cba-student__retry">{t('studentExam.reloadAttempt')}</button></div></div>}
    {error && !timeoutSubmitFailed && <div role="alert" className="cba-student__alert cba-student-exam__alert">{error}</div>}
    <nav className="cba-student-exam__navigation" aria-label={t('studentExam.questionNavigation')}>{attempt.questions.map((question, index) => <button key={question.exam_question_id} type="button" onClick={() => setActiveIndex(index)} aria-current={index === activeIndex ? 'step' : undefined} className={`cba-student-exam__question-index${index === activeIndex ? ' cba-student-exam__question-index--active' : selected[question.exam_question_id] ? ' cba-student-exam__question-index--answered' : ''}`}>{index + 1}</button>)}</nav>
    <article className="cba-student-exam__question"><p className="cba-student-exam__question-number">{t('studentExam.questionNumber', { number: activeIndex + 1, total: attempt.questions.length })}</p><h2>{activeQuestion.text}</h2><fieldset className="cba-student-exam__options" disabled={expired || savingQuestionId === activeQuestion.exam_question_id}><legend className="sr-only">{t('studentExam.selectAnswer')}</legend>{activeQuestion.options.map((option) => <label key={option.id} className="cba-student-exam__option"><input type="radio" name={activeQuestion.exam_question_id} checked={selected[activeQuestion.exam_question_id] === option.id} onChange={() => void chooseAnswer(activeQuestion.exam_question_id, option.id)} /><span>{option.text}</span></label>)}</fieldset>
      {savingQuestionId === activeQuestion.exam_question_id && <p role="status" className="cba-student__notice">{t('studentExam.saving')}</p>}
      {saveErrors[activeQuestion.exam_question_id] && <p role="alert" className="cba-student__alert cba-student-exam__alert">{t('studentExam.saveFailed')} <button type="button" onClick={() => { const optionId = selected[activeQuestion.exam_question_id]; if (optionId) void saveAnswer(activeQuestion.exam_question_id, optionId) }} className="cba-student__retry">{t('common.retry')}</button></p>}
    </article>
    <footer className="cba-student-exam__footer"><button type="button" onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} disabled={activeIndex === 0} className="cba-student-exam__secondary-action">{t('studentExam.previous')}</button><button type="button" onClick={() => setActiveIndex((index) => Math.min(attempt.questions.length - 1, index + 1))} disabled={activeIndex === attempt.questions.length - 1} className="cba-student-exam__secondary-action">{t('studentExam.next')}</button><button type="button" onClick={() => void confirmSubmit()} disabled={expired || savingAnswers || submitting} className="cba-student__primary-action cba-student-exam__submit">{submitting ? t('studentExam.submitting') : t('studentExam.submit')}</button></footer>
  </section></main></StudentExamPage>
}
