import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'

import { getProfile } from '@/features/auth/auth.service'
import { AuthContext } from '@/features/auth/auth-context'
import { isSupabaseConfigured } from '@/lib/env'
import { supabase } from '@/lib/supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let mounted = true
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setLoading(false)
      }
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const profileQuery = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: () => getProfile(session!.user.id),
    enabled: Boolean(session?.user.id),
  })

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile: profileQuery.data ?? null,
        loading: loading || (Boolean(session) && profileQuery.isPending),
        profileError: profileQuery.error,
        refreshProfile: profileQuery.refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
