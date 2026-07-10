import type { User, Session } from '@supabase/supabase-js'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  adminName: string | null
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => Promise<void>
}
