import type { User, Session } from '@supabase/supabase-js'

export type PrincipalRole = 'master_admin' | 'admin' | 'student'
export type AdminCapability = 'dashboard' | 'students' | 'questions' | 'reports' | 'administrator_management' | 'levels' | 'exam_configuration' | 'audit'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  role: PrincipalRole | null
  principalError: string | null
  isAdmin: boolean
  isMasterAdmin: boolean
  hasCapability: (capability: AdminCapability) => boolean
  isStudent: boolean
  adminName: string | null
  login: (email: string, password: string) => Promise<{ error?: string }>
  retryPrincipal: () => Promise<void>
  logout: () => Promise<void>
}
