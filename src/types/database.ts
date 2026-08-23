export type AppRole = 'admin' | 'equipe'

type AuditFields = {
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

export type Profile = AuditFields & {
  id: string
  full_name: string | null
  role: AppRole
  active: boolean
}

export type Supplier = AuditFields & {
  id: string
  name: string
  legal_name: string | null
  tax_id: string | null
  category: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  active: boolean
  notes: string | null
}

export type CatalogCategory = AuditFields & {
  id: string
  name: string
  active: boolean
}

export type CatalogItem = AuditFields & {
  id: string
  code: string
  name: string
  category_id: string
  unit: string
  description: string | null
  active: boolean
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
          active?: boolean
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          full_name?: string | null
          role?: AppRole
          active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: Supplier
        Insert: {
          id?: string
          name: string
          legal_name?: string | null
          tax_id?: string | null
          category?: string | null
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          active?: boolean
          notes?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: Partial<{
          name: string
          legal_name: string | null
          tax_id: string | null
          category: string | null
          contact_name: string | null
          email: string | null
          phone: string | null
          active: boolean
          notes: string | null
          updated_at: string
          updated_by: string | null
        }>
        Relationships: []
      }
      catalog_categories: {
        Row: CatalogCategory
        Insert: {
          id?: string
          name: string
          active?: boolean
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: Partial<{
          name: string
          active: boolean
          updated_at: string
          updated_by: string | null
        }>
        Relationships: []
      }
      catalog_items: {
        Row: CatalogItem
        Insert: {
          id?: string
          code: string
          name: string
          category_id: string
          unit: string
          description?: string | null
          active?: boolean
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: Partial<{
          code: string
          name: string
          category_id: string
          unit: string
          description: string | null
          active: boolean
          updated_at: string
          updated_by: string | null
        }>
        Relationships: [
          {
            foreignKeyName: 'catalog_items_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'catalog_categories'
            referencedColumns: ['id']
          },
        ]
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
    Enums: {
      app_role: AppRole
      adjustment_type: 'percentage' | 'fixed'
      margin_scope_type: 'global' | 'category' | 'item'
      price_status: 'approved' | 'review_required' | 'inactive'
      quotation_status: 'draft' | 'active' | 'cancelled'
    }
    CompositeTypes: Record<string, never>
  }
}
