// ============================================================
// Sistema de Exámenes de Colocación CBA — TypeScript Interfaces
// ============================================================

// --- Enums ---

export type ExamStatus = 'pending' | 'in_progress' | 'completed'

// --- Tables ---

export interface Student {
  id: string
  ci: string
  full_name: string
  email: string
  phone: string | null
  created_at: string
}

export interface Admin {
  id: string
  email: string
  full_name: string
  created_at: string
}

export interface Level {
  id: string
  name: string
  min_score: number
  max_score: number
  description: string | null
}

export interface ExamConfig {
  id: string
  time_limit_minutes: number
  questions_per_exam: number
  passing_score: number
  updated_at: string
}

export interface Question {
  id: string
  text: string
  level_id: string
  category: string | null
  created_at: string
  updated_at: string
}

export interface QuestionOption {
  id: string
  question_id: string
  text: string
  is_correct: boolean
  order: number
}

export interface Exam {
  id: string
  student_id: string
  started_at: string | null
  completed_at: string | null
  score: number | null
  level_id: string | null
  status: ExamStatus
  created_at: string
}

export interface ExamQuestion {
  id: string
  exam_id: string
  question_id: string
  order: number
}

export interface StudentAnswer {
  id: string
  exam_id: string
  question_id: string
  selected_option_id: string | null
  is_correct: boolean | null
  answered_at: string | null
}

export interface AuditLog {
  id: string
  admin_id: string | null
  action: string
  entity: string
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

// --- Dashboard ---

export interface DashboardStats {
  totalStudents: number
  totalExams: number
  examsToday: number
  avgScore: number
}

export interface LevelDistributionItem {
  level_id: string
  name: string
  count: number
  percentage: number
}

export interface RecentExam {
  id: string
  student: { full_name: string } | null
  level: { name: string } | null
  score: number | null
  status: ExamStatus
  completed_at: string | null
  created_at: string
}

// --- Payloads (request/response) ---

export interface ExamResult {
  score: number
  level_id: string
  level_name: string
}

export interface LoginPayload {
  identifier: string  // CI or email
  password: string
}

export interface StudentRegistrationPayload {
  ci: string
  full_name: string
  email: string
  password: string
  phone?: string
}

// --- Question Management ---

export interface QuestionWithLevel extends Question {
  level: Level | null
}

export interface QuestionFormData {
  text: string
  level_id: string
  category: string
  options: QuestionOptionFormData[]
}

export interface QuestionOptionFormData {
  id?: string          // present only in edit mode
  text: string
  is_correct: boolean
}
