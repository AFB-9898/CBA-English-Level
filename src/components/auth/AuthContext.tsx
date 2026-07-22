import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import type { AuthContextValue, PrincipalRole } from '../../types/auth'

const AuthContext = createContext<AuthContextValue | null>(null)

function mapLoginError(error: unknown, t: (key: string) => string): string {
  const authError = error as { code?: unknown; message?: unknown; name?: unknown } | null

  if (authError?.code === 'invalid_credentials' || authError?.message === 'Invalid login credentials') {
    return t('auth.invalidCredentials')
  }

  if (authError?.code === 'email_not_confirmed' || authError?.message === 'Email not confirmed') {
    return t('auth.emailNotConfirmed')
  }

  if (error instanceof TypeError || authError?.name === 'AuthRetryableFetchError') {
    return t('auth.networkError')
  }

  return t('auth.signInFailed')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<PrincipalRole | null>(null)
  const [principalError, setPrincipalError] = useState<string | null>(null)
  const [adminName, setAdminName] = useState<string | null>(null)
  const requestId = useRef(0)

  const resetState = useCallback(() => {
    requestId.current += 1
    setUser(null)
    setSession(null)
    setRole(null)
    setPrincipalError(null)
    setAdminName(null)
  }, [])

  const resolveSession = useCallback(async (nextSession: Session | null) => {
    const currentRequest = ++requestId.current
    setSession(nextSession)
    setUser(nextSession?.user ?? null)
    setRole(null)
    setPrincipalError(null)
    setAdminName(null)

    if (!nextSession) {
      setLoading(false)
      return
    }

    setLoading(true)
    let result: { data: unknown; error: unknown }
    try {
      result = await supabase.rpc('get_current_principal')
    } catch {
      if (requestId.current === currentRequest) {
        setPrincipalError(t('auth.networkError'))
        setLoading(false)
      }
      return
    }
    if (requestId.current !== currentRequest) return

    if (result.error) {
      setPrincipalError(t('auth.networkError'))
    } else if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
      const principal = result.data as { role?: unknown; admin_name?: unknown }
      if (principal.role === 'admin' || principal.role === 'student') {
        setRole(principal.role)
        setAdminName(principal.role === 'admin' && typeof principal.admin_name === 'string' ? principal.admin_name : null)
      } else {
        setPrincipalError(t('auth.networkError'))
      }
    }
    setLoading(false)
  }, [t])

  useEffect(() => {
    // Restore session on mount
    void supabase.auth.getSession()
      .then(({ data: { session } }) => resolveSession(session))
      .catch(() => {
        setPrincipalError(t('auth.networkError'))
        setLoading(false)
      })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // getSession is the authoritative bootstrap source; INITIAL_SESSION can
      // otherwise race it with a transient session while principal resolution is pending.
      if (event === 'INITIAL_SESSION') return

      if (event === 'SIGNED_OUT') {
        resetState()
        setLoading(false)
      } else {
        void resolveSession(session)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [resetState, resolveSession, t])

  const isAdmin = role === 'admin'
  const isStudent = role === 'student'
  const retryPrincipal = useCallback(async () => {
    await resolveSession(session)
  }, [resolveSession, session])

  const login = useCallback(async (email: string, password: string) => {
    let error: unknown
    try {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }))
    } catch (error) {
      return { error: mapLoginError(error, t) }
    }

    if (error) {
      return { error: mapLoginError(error, t) }
    }

    return {}
  }, [t])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value: AuthContextValue = {
    user,
    session,
    loading,
    role,
    principalError,
    isAdmin,
    isStudent,
    adminName,
    login,
    retryPrincipal,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
