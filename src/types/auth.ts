import type { User, Session } from '@supabase/supabase-js'

export type PrincipalRole = 'admin' | 'student'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  role: PrincipalRole | null
  principalError: string | null
  isAdmin: boolean
  isStudent: boolean
  adminName: string | null
  login: (email: string, password: string) => Promise<{ error?: string }>
  retryPrincipal: () => Promise<void>
  logout: () => Promise<void>
}
