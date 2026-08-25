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

export type ComparisonCurrentRow = {
  catalog_item_id: string
  code: string
  item_name: string
  unit: string
  category_id: string
  category_name: string
  best_quotation_item_id: string | null
  best_supplier_id: string | null
  best_supplier_name: string | null
  best_unit_price: string | null
  best_valid_until: string | null
  best_received_at: string | null
  best_validity_not_informed: boolean | null
  eligible_offer_count: number
}

export type PricingComparisonRow = {
  catalog_item_id: string
  catalog_item_active: boolean
  code: string
  item_name: string
  unit: string
  category_id: string
  category_name: string
  best_quotation_item_id: string | null
  best_cost: string | null
  best_supplier_id: string | null
  best_supplier_name: string | null
  best_valid_until: string | null
  best_validity_not_informed: boolean | null
  eligible_offer_count: number
  resolved_margin_rule_id: string | null
  resolved_rule_scope: 'global' | 'category' | 'item' | null
  resolved_adjustment_type: 'percentage' | 'fixed' | null
  resolved_adjustment_value: string | null
  suggested_price: string | null
  price_list_id: string | null
  approved_cost_price: string | null
  approved_final_price: string | null
  approved_adjustment_type: AdjustmentType | null
  approved_adjustment_value: string | null
  manual_source: boolean | null
  approved_at: string | null
  approved_by: string | null
  approved_source_quotation_item_id: string | null
  approved_quotation_id: string | null
  approved_quotation_reference: string | null
  approved_supplier_id: string | null
  approved_supplier_name: string | null
  approved_source_valid_until: string | null
  effective_status: PriceEffectiveStatus
  review_reason: PriceReviewReason | null
  persisted_status: PriceStatus | null
  approved_margin_rule_id: string | null
  best_quotation_item_id_at_approval: string | null
  best_cost_at_approval: string | null
  decision_token: string
}

export type MarginScope = 'global' | 'category' | 'item'
export type AdjustmentType = 'percentage' | 'fixed'
export type PriceStatus = 'approved' | 'review_required' | 'inactive'
export type PriceEffectiveStatus = 'no_cost' | 'no_rule' | 'suggestion_available' | PriceStatus
export type PriceReviewReason = 'manual_review_required' | 'approved_source_ineligible' | 'best_cost_reference_changed' | 'no_active_rule' | 'pricing_rule_changed'

export type MarginRule = AuditFields & {
  id: string
  scope_type: MarginScope
  category_id: string | null
  catalog_item_id: string | null
  calculation_type: AdjustmentType
  value: string
  active: boolean
  notes: string | null
}

export type PriceList = AuditFields & {
  id: string
  catalog_item_id: string
  source_quotation_item_id: string
  margin_rule_id: string
  cost_price: string
  adjustment_type: AdjustmentType
  adjustment_value: string
  final_price: string
  source_valid_until: string | null
  best_quotation_item_id_at_approval: string | null
  best_cost_at_approval: string | null
  manual_source: boolean
  status: PriceStatus
  approved_at: string
  approved_by: string
}

export type QuotationOfferCandidateRow = {
  quotation_item_id: string
  quotation_id: string
  catalog_item_id: string | null
  unit_price: string
  supplier_description: string | null
  supplier_item_code: string | null
  supplier_id: string
  supplier_name: string
  reference_number: string | null
  received_at: string
  valid_until: string | null
  quotation_status: QuotationStatus
  is_expired: boolean
  validity_not_informed: boolean
  is_eligible: boolean
}

export type ClientType = 'company' | 'individual'
export type ClientStatus = 'active' | 'inactive'

export type Client = AuditFields & {
  id: string
  legal_name: string
  trade_name: string | null
  tax_id: string
  client_type: ClientType
  status: ClientStatus
  email: string | null
  phone: string | null
  website: string | null
  zip_code: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  country: string
  notes: string | null
}

export type ClientContact = AuditFields & {
  id: string
  client_id: string
  name: string
  role: string | null
  department: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  is_primary: boolean
  notes: string | null
  status: ClientStatus
}

export type ClientListRow = Client & {
  primary_contact_id: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
  contact_count: number
  active_contact_count: number
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
          updated_by?: string | null
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
      margin_rules: {
        Row: MarginRule
        Insert: {
          id?: string
          scope_type: MarginScope
          category_id?: string | null
          catalog_item_id?: string | null
          calculation_type: AdjustmentType
          value: string | number
          active?: boolean
          notes?: string | null
        }
        Update: Partial<{
          scope_type: MarginScope
          category_id: string | null
          catalog_item_id: string | null
          calculation_type: AdjustmentType
          value: string | number
          active: boolean
          notes: string | null
        }>
        Relationships: []
      }
      price_list: {
        Row: PriceList
        Insert: never
        Update: never
        Relationships: []
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
      clients: {
        Row: Client
        Insert: {
          id?: string
          legal_name: string
          trade_name?: string | null
          tax_id: string
          client_type: ClientType
          status?: ClientStatus
          email?: string | null
          phone?: string | null
          website?: string | null
          zip_code?: string | null
          street?: string | null
          number?: string | null
          complement?: string | null
          district?: string | null
          city?: string | null
          state?: string | null
          country?: string
          notes?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: Partial<{
          legal_name: string
          trade_name: string | null
          tax_id: string
          client_type: ClientType
          status: ClientStatus
          email: string | null
          phone: string | null
          website: string | null
          zip_code: string | null
          street: string | null
          number: string | null
          complement: string | null
          district: string | null
          city: string | null
          state: string | null
          country: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }>
        Relationships: []
      }
      client_contacts: {
        Row: ClientContact
        Insert: {
          id?: string
          client_id: string
          name: string
          role?: string | null
          department?: string | null
          email?: string | null
          phone?: string | null
          whatsapp?: string | null
          is_primary?: boolean
          notes?: string | null
          status?: ClientStatus
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: Partial<{
          client_id: string
          name: string
          role: string | null
          department: string | null
          email: string | null
          phone: string | null
          whatsapp: string | null
          is_primary: boolean
          notes: string | null
          status: ClientStatus
          updated_at: string
          updated_by: string | null
        }>
        Relationships: [
          {
            foreignKeyName: 'client_contacts_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      client_list_v: {
        Row: ClientListRow
        Relationships: []
      }
      comparison_current_v: {
        Row: ComparisonCurrentRow
        Relationships: []
      }
      pricing_comparison_v: {
        Row: PricingComparisonRow
        Relationships: []
      }
      quotation_item_candidates_v: {
        Row: QuotationOfferCandidateRow
        Relationships: []
      }
      best_quote_per_item_v: {
        Row: QuotationOfferCandidateRow
        Relationships: []
      }
      ranked_quotation_items_v: {
        Row: QuotationOfferCandidateRow & { offer_rank: number; eligible_offer_count: number }
        Relationships: []
      }
    }
    Functions: {
      save_client_contact: {
        Args: {
          p_contact_id: string | null
          p_client_id: string
          p_name: string
          p_role: string | null
          p_department: string | null
          p_email: string | null
          p_phone: string | null
          p_whatsapp: string | null
          p_is_primary: boolean
          p_notes: string | null
          p_status: ClientStatus
        }
        Returns: ClientContact
      }
      discard_pending_quotation_attachment: {
        Args: {
          p_quotation_id: string
          p_expected_revision: number
        }
        Returns: Quotation
      }
      is_admin: { Args: never; Returns: boolean }
      approve_price: {
        Args: {
          p_catalog_item_id: string
          p_expected_decision_token: string
          p_source_quotation_item_id?: string | null
        }
        Returns: PriceList
      }
      inactivate_price: {
        Args: {
          p_catalog_item_id: string
          p_expected_decision_token: string
        }
        Returns: PriceList
      }
      price_decision_token: { Args: { p_catalog_item_id: string }; Returns: string }
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
      client_status: ClientStatus
      client_type: ClientType
      adjustment_type: 'percentage' | 'fixed'
      margin_scope_type: 'global' | 'category' | 'item'
      price_status: PriceStatus
      quotation_status: QuotationStatus
    }
    CompositeTypes: Record<string, never>
  }
}
