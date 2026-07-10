import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { AuthContextValue } from '../../types/auth'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState<string | null>(null)

  const fetchAdminName = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('admin')
      .select('full_name')
      .eq('id', userId)
      .single()

    if (data) {
      setAdminName(data.full_name)
    }
  }, [])

  const resetState = useCallback(() => {
    setUser(null)
    setSession(null)
    setAdminName(null)
  }, [])

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user?.user_metadata?.role === 'admin') {
        fetchAdminName(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (event === 'SIGNED_IN' && session?.user?.user_metadata?.role === 'admin') {
        fetchAdminName(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        resetState()
      }

      if (!session) {
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchAdminName, resetState])

  const isAdmin = user?.user_metadata?.role === 'admin'

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Map Supabase error messages to user-friendly ones
      const message =
        error.message === 'Invalid login credentials'
          ? 'Invalid email or password'
          : error.message === 'Email not confirmed'
            ? 'Please confirm your email before logging in'
            : 'Network error. Please try again.'

      return { error: message }
    }

    return {}
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value: AuthContextValue = {
    user,
    session,
    loading,
    isAdmin,
    adminName,
    login,
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
