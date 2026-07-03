// Interfaces globales del sistema

export interface Student {
  id: string
  full_name: string
  email: string
  phone?: string
  created_at: string
}

export interface Admin {
  id: string
  email: string
  created_at: string
}

export interface Level {
  id: string
  name: string
  min_score: number
  max_score: number
  description?: string
}

export interface Question {
  id: string
  text: string
  options: string[]
  correct_answer: number
  level_id: string
  category?: string
}

export interface Exam {
  id: string
  student_id: string
  started_at: string
  completed_at?: string
  score?: number
  level_id?: string
  status: 'pending' | 'in_progress' | 'completed'
}

export interface ExamConfig {
  id: string
  time_limit_minutes: number
  questions_per_exam: number
  passing_score: number
}
