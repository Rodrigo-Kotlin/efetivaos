import { createClient } from '@supabase/supabase-js'

import { env, isSupabaseConfigured } from '@/lib/env'
import type { Database } from '@/types/database'

const fallbackUrl = 'https://configuration-required.supabase.co'
const fallbackKey = 'configuration-required'

export const supabase = createClient<Database>(
  isSupabaseConfigured ? env.supabaseUrl : fallbackUrl,
  isSupabaseConfigured ? env.supabaseAnonKey : fallbackKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'efetiva-os-auth',
    },
  },
)
