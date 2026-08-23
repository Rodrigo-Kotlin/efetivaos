export type AppRole = 'admin' | 'equipe'

export type Profile = {
  id: string
  full_name: string | null
  role: AppRole
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          full_name?: string | null
          role?: AppRole
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string | null
          role?: AppRole
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      set_user_role: {
        Args: { target_user_id: string; new_role: AppRole }
        Returns: undefined
      }
    }
    Enums: { app_role: AppRole }
    CompositeTypes: Record<string, never>
  }
}
