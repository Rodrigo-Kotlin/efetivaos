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

export type QuotationStatus = 'draft' | 'active' | 'cancelled'

export type Quotation = AuditFields & {
  id: string
  supplier_id: string
  reference_number: string | null
  received_at: string
  valid_until: string | null
  status: QuotationStatus
  source_file_path: string | null
  source_file_pending: boolean
  revision: number
  notes: string | null
}

export type QuotationItem = AuditFields & {
  id: string
  quotation_id: string
  catalog_item_id: string | null
  supplier_description: string | null
  supplier_item_code: string | null
  unit_price: string
  notes: string | null
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
      quotations: {
        Row: Quotation
        Insert: {
          id?: string
          supplier_id: string
          reference_number?: string | null
          received_at: string
          valid_until?: string | null
          status?: QuotationStatus
          source_file_path?: string | null
          source_file_pending?: boolean
          revision?: number
          notes?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: Partial<{
          supplier_id: string
          reference_number: string | null
          received_at: string
          valid_until: string | null
          status: QuotationStatus
          source_file_path: string | null
          source_file_pending: boolean
          revision: number
          notes: string | null
          updated_at: string
          updated_by: string | null
        }>
        Relationships: [
          {
            foreignKeyName: 'quotations_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
        ]
      }
      quotation_items: {
        Row: QuotationItem
        Insert: {
          id?: string
          quotation_id: string
          catalog_item_id?: string | null
          supplier_description?: string | null
          supplier_item_code?: string | null
          unit_price: string
          notes?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: Partial<{
          quotation_id: string
          catalog_item_id: string | null
          supplier_description: string | null
          supplier_item_code: string | null
          unit_price: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }>
        Relationships: [
          {
            foreignKeyName: 'quotation_items_quotation_id_fkey'
            columns: ['quotation_id']
            isOneToOne: false
            referencedRelation: 'quotations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quotation_items_catalog_item_id_fkey'
            columns: ['catalog_item_id']
            isOneToOne: false
            referencedRelation: 'catalog_items'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      discard_pending_quotation_attachment: {
        Args: {
          p_quotation_id: string
          p_expected_revision: number
        }
        Returns: Quotation
      }
      is_admin: { Args: never; Returns: boolean }
      save_quotation_draft: {
        Args: {
          p_quotation_id: string | null
          p_expected_updated_at: string | null
          p_expected_revision: number | null
          p_supplier_id: string
          p_reference_number: string | null
          p_received_at: string
          p_valid_until: string | null
          p_notes: string | null
          p_items: Array<{
            id?: string
            catalog_item_id: string | null
            supplier_description: string | null
            supplier_item_code: string | null
            unit_price: string
            notes: string | null
          }>
        }
        Returns: Quotation
      }
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
      quotation_status: QuotationStatus
    }
    CompositeTypes: Record<string, never>
  }
}
