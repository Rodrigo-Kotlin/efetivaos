import { createContext, useContext } from 'react'

import type { Session, User } from '@supabase/supabase-js'

import type { Profile } from '@/types/database'

export type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  profileError: Error | null
  refreshProfile: () => Promise<unknown>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
