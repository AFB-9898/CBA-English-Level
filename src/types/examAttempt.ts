export interface ExamAttemptOption {
  id: string
  text: string
  order: number
}

export interface ExamAttemptQuestion {
  exam_question_id: string
  order: number
  text: string
  category: string | null
  selected_option_id: string | null
  options: ExamAttemptOption[]
}

export interface ExamAttemptResult {
  score: number
  level: {
    id: string
    code: string
    name: string
    version: number
  } | null
}

export interface ExamAttempt {
  attempt_id: string
  status: 'in_progress' | 'completed'
  started_at: string
  deadline_at: string
  server_now: string
  questions: ExamAttemptQuestion[]
  result: ExamAttemptResult | null
}
