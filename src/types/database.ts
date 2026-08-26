export type AppRole = 'admin' | 'equipe'

type AuditFields = {
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

type FinanceAuditFields = AuditFields

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

export type FinancialAccountClass = 'ATIVO' | 'PASSIVO' | 'PL' | 'RECEITA' | 'CUSTO' | 'DESPESA'
export type FinancialNature = 'DEBITO' | 'CREDITO'
export type FinancialCurrentClass = 'CIRCULANTE' | 'NAO_CIRCULANTE'
export type FinancialDfcClass = 'OPERACIONAL' | 'INVESTIMENTO' | 'FINANCIAMENTO' | 'NAO_CAIXA' | 'TRANSFERENCIA'
export type FinancialMovementType = 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA' | 'EMPRESTIMO_RECEBIDO' | 'EMPRESTIMO_PAGO' | 'APORTE' | 'RETIRADA' | 'IMOBILIZADO' | 'SALDO_INICIAL' | 'AJUSTE'
export type FinancialAccountType = 'CAIXA' | 'CONTA_CORRENTE' | 'POUPANCA' | 'CARTAO' | 'INVESTIMENTO' | 'OUTRO'

export type ChartAccount = FinanceAuditFields & {
  id: string; code: string; name: string; class: FinancialAccountClass; nature: FinancialNature; posting: boolean; active: boolean; current_class: FinancialCurrentClass | null; bp_group: string; dre_class: string; dfc_default: FinancialDfcClass; dva_class: string; is_cash: boolean; presentation_sign: number
}
export type CostCenter = FinanceAuditFields & {
  id: string; code: string | null; name: string; active: boolean; description: string | null
}
export type ServiceLine = FinanceAuditFields & {
  id: string; name: string; active: boolean; description: string | null
}
export type FinancialCategory = FinanceAuditFields & {
  id: string; name: string; movement_type: FinancialMovementType; counter_account_id: string | null; cost_center_id: string | null; service_line_id: string | null; cash_flow_class: FinancialDfcClass; active: boolean
}
export type FinancialCategoryList = FinancialCategory & {
  counter_account_code: string | null; counter_account_name: string | null; cost_center_name: string | null; service_line_name: string | null
}
export type FinancialAccount = FinanceAuditFields & {
  id: string; name: string; chart_account_id: string; institution: string | null; account_type: FinancialAccountType; active: boolean; opening_date: string | null; notes: string | null
}
export type FinancialAccountList = FinancialAccount & {
  chart_account_code: string | null; chart_account_name: string | null
}
export type PaymentMethod = FinanceAuditFields & {
  id: string; name: string; active: boolean
}
export type FinancialParty = FinanceAuditFields & {
  id: string; name: string; party_type: string; document: string | null; email: string | null; phone: string | null; client_id: string | null; supplier_id: string | null; active: boolean; notes: string | null
}
export type PeriodLock = {
  id: string; period_start: string; period_end: string; locked_at: string; locked_by: string | null; reason: string | null; created_at: string
}

export type FinancialTransactionStatus = 'pending' | 'settled' | 'cancelled'

export type FinancialTransaction = FinanceAuditFields & {
  id: string; description: string; transaction_date: string; competence_date: string; movement_type: FinancialMovementType; amount: string; status: FinancialTransactionStatus; category_id: string | null; origin_account_id: string | null; destination_account_id: string | null; party_id: string | null; cost_center_id: string | null; service_line_id: string | null; payment_method_id: string | null; due_date: string | null; payment_date: string | null; notes: string | null; review_required: boolean; version: number; idempotency_key: string | null
}
export type FinancialTransactionList = FinancialTransaction & {
  category_name: string | null; origin_account_name: string | null; destination_account_name: string | null; party_name: string | null; cost_center_name: string | null; service_line_name: string | null; payment_method_name: string | null; journal_entry_count: number; total_debit: string; total_credit: string
}

export type FinancialJournalEntry = {
  id: string; transaction_id: string; entry_type: string; entry_date: string; competence_date: string; description: string; status: FinancialTransactionStatus; review_required: boolean; created_at: string; created_by: string | null
}
export type FinancialJournalEntryList = FinancialJournalEntry & {
  total_debit: string; total_credit: string
}

export type FinancialJournalLine = {
  id: string; entry_id: string; chart_account_id: string; debit: string; credit: string; description: string | null; created_at: string
}
export type FinancialJournalLineList = FinancialJournalLine & {
  chart_account_code: string | null; chart_account_name: string | null; chart_account_class: FinancialAccountClass | null
}

// ---------------------------------------------------------------------------
// Cash Flow / DFC view types (ETAPA 08D)
// ---------------------------------------------------------------------------

export type CashflowRealizedRow = {
  entry_id: string; transaction_id: string; entry_date: string; entry_description: string
  competence_date: string; status: FinancialTransactionStatus; created_at: string
  transaction_description: string; movement_type: FinancialMovementType; transaction_amount: string
  category_id: string | null; category_name: string | null
  cost_center_id: string | null; cost_center_name: string | null
  service_line_id: string | null; service_line_name: string | null
  party_id: string | null; party_name: string | null
  payment_method_id: string | null; payment_method_name: string | null
  cash_accounts: string; cash_effect: string
  direction: 'INFLOW' | 'OUTFLOW'; dfc_class: FinancialDfcClass; amount: string
}

export type CashflowForecastRow = {
  transaction_id: string; description: string; movement_type: FinancialMovementType
  status: FinancialTransactionStatus; due_date: string | null
  original_amount: string; open_amount: string
  direction: 'INFLOW' | 'OUTFLOW'
  projected_inflow: string; projected_outflow: string
  party_name: string | null; category_name: string | null
  cost_center_id: string | null; cost_center_name: string | null
  service_line_id: string | null; service_line_name: string | null
  overdue: boolean; days_overdue: number | null
  due_bucket: string
}

export type CashflowStatementRow = {
  dfc_class: string; dfc_class_label: string
  inflows: string; outflows: string; net_amount: string
  opening_balance: string; sort_order: number
}

export type Cashflow13WeekRow = {
  week_number: number; week_start: string; week_end: string
  week_label: string; opening_balance: string
  inflows: string; outflows: string; closing_balance: string
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
      financial_chart_accounts: {
        Row: ChartAccount
        Insert: {
          id?: string
          code: string
          name: string
          class: FinancialAccountClass
          nature: FinancialNature
          posting?: boolean
          active?: boolean
          current_class?: FinancialCurrentClass | null
          bp_group: string
          dre_class: string
          dfc_default?: FinancialDfcClass
          dva_class: string
          is_cash?: boolean
          presentation_sign?: number
        }
        Update: Partial<Omit<ChartAccount, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>
        Relationships: []
      }
      financial_cost_centers: {
        Row: CostCenter
        Insert: {
          id?: string
          code?: string | null
          name: string
          active?: boolean
          description?: string | null
        }
        Update: Partial<Omit<CostCenter, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>
        Relationships: []
      }
      financial_service_lines: {
        Row: ServiceLine
        Insert: {
          id?: string
          name: string
          active?: boolean
          description?: string | null
        }
        Update: Partial<Omit<ServiceLine, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>
        Relationships: []
      }
      financial_categories: {
        Row: FinancialCategory
        Insert: {
          id?: string
          name: string
          movement_type: FinancialMovementType
          counter_account_id?: string | null
          cost_center_id?: string | null
          service_line_id?: string | null
          cash_flow_class?: FinancialDfcClass
          active?: boolean
        }
        Update: Partial<Omit<FinancialCategory, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>
        Relationships: [
          {
            foreignKeyName: 'financial_categories_counter_account_id_fkey'
            columns: ['counter_account_id']
            isOneToOne: false
            referencedRelation: 'financial_chart_accounts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'financial_categories_cost_center_id_fkey'
            columns: ['cost_center_id']
            isOneToOne: false
            referencedRelation: 'financial_cost_centers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'financial_categories_service_line_id_fkey'
            columns: ['service_line_id']
            isOneToOne: false
            referencedRelation: 'financial_service_lines'
            referencedColumns: ['id']
          },
        ]
      }
      financial_accounts: {
        Row: FinancialAccount
        Insert: {
          id?: string
          name: string
          chart_account_id: string
          institution?: string | null
          account_type?: FinancialAccountType
          active?: boolean
          opening_date?: string | null
          notes?: string | null
        }
        Update: Partial<Omit<FinancialAccount, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>
        Relationships: [
          {
            foreignKeyName: 'financial_accounts_chart_account_id_fkey'
            columns: ['chart_account_id']
            isOneToOne: false
            referencedRelation: 'financial_chart_accounts'
            referencedColumns: ['id']
          },
        ]
      }
      financial_payment_methods: {
        Row: PaymentMethod
        Insert: {
          id?: string
          name: string
          active?: boolean
        }
        Update: Partial<Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>
        Relationships: []
      }
      financial_parties: {
        Row: FinancialParty
        Insert: {
          id?: string
          name: string
          party_type: string
          document?: string | null
          email?: string | null
          phone?: string | null
          client_id?: string | null
          supplier_id?: string | null
          active?: boolean
          notes?: string | null
        }
        Update: Partial<Omit<FinancialParty, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>
        Relationships: [
          {
            foreignKeyName: 'financial_parties_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'financial_parties_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
        ]
      }
      financial_period_locks: {
        Row: PeriodLock
        Insert: {
          id?: string
          period_start: string
          period_end: string
          reason?: string | null
        }
        Update: never
        Relationships: []
      }
      financial_transactions: {
        Row: FinancialTransaction
        Insert: {
          id?: string
          description: string
          transaction_date?: string
          competence_date?: string
          movement_type: FinancialMovementType
          amount: number | string
          status?: FinancialTransactionStatus
          category_id?: string | null
          origin_account_id?: string | null
          destination_account_id?: string | null
          party_id?: string | null
          cost_center_id?: string | null
          service_line_id?: string | null
          payment_method_id?: string | null
          due_date?: string | null
          payment_date?: string | null
          notes?: string | null
          review_required?: boolean
          version?: number
          idempotency_key?: string | null
        }
        Update: Partial<Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'>>
        Relationships: [
          { foreignKeyName: 'ft_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'financial_categories'; referencedColumns: ['id'] },
          { foreignKeyName: 'ft_origin_account_id_fkey'; columns: ['origin_account_id']; isOneToOne: false; referencedRelation: 'financial_accounts'; referencedColumns: ['id'] },
          { foreignKeyName: 'ft_destination_account_id_fkey'; columns: ['destination_account_id']; isOneToOne: false; referencedRelation: 'financial_accounts'; referencedColumns: ['id'] },
          { foreignKeyName: 'ft_party_id_fkey'; columns: ['party_id']; isOneToOne: false; referencedRelation: 'financial_parties'; referencedColumns: ['id'] },
          { foreignKeyName: 'ft_cost_center_id_fkey'; columns: ['cost_center_id']; isOneToOne: false; referencedRelation: 'financial_cost_centers'; referencedColumns: ['id'] },
          { foreignKeyName: 'ft_service_line_id_fkey'; columns: ['service_line_id']; isOneToOne: false; referencedRelation: 'financial_service_lines'; referencedColumns: ['id'] },
          { foreignKeyName: 'ft_payment_method_id_fkey'; columns: ['payment_method_id']; isOneToOne: false; referencedRelation: 'financial_payment_methods'; referencedColumns: ['id'] },
        ]
      }
      financial_journal_entries: {
        Row: FinancialJournalEntry
        Insert: {
          id?: string
          transaction_id: string
          entry_type?: string
          entry_date?: string
          competence_date?: string
          description: string
          status?: FinancialTransactionStatus
          review_required?: boolean
        }
        Update: Partial<Omit<FinancialJournalEntry, 'id' | 'created_at' | 'created_by'>>
        Relationships: [
          { foreignKeyName: 'fje_transaction_id_fkey'; columns: ['transaction_id']; isOneToOne: false; referencedRelation: 'financial_transactions'; referencedColumns: ['id'] },
        ]
      }
      financial_journal_lines: {
        Row: FinancialJournalLine
        Insert: {
          id?: string
          entry_id: string
          chart_account_id: string
          debit?: number | string
          credit?: number | string
          description?: string | null
        }
        Update: Partial<Omit<FinancialJournalLine, 'id' | 'created_at'>>
        Relationships: [
          { foreignKeyName: 'fjl_entry_id_fkey'; columns: ['entry_id']; isOneToOne: false; referencedRelation: 'financial_journal_entries'; referencedColumns: ['id'] },
          { foreignKeyName: 'fjl_chart_account_id_fkey'; columns: ['chart_account_id']; isOneToOne: false; referencedRelation: 'financial_chart_accounts'; referencedColumns: ['id'] },
        ]
      }
    }
    Views: {
      financial_chart_accounts_list_v: {
        Row: ChartAccount
        Relationships: []
      }
      financial_categories_list_v: {
        Row: FinancialCategoryList
        Relationships: []
      }
      financial_accounts_list_v: {
        Row: FinancialAccountList
        Relationships: []
      }
      financial_transactions_list_v: {
        Row: FinancialTransactionList
        Relationships: []
      }
      financial_journal_entries_list_v: {
        Row: FinancialJournalEntryList
        Relationships: []
      }
      financial_journal_lines_list_v: {
        Row: FinancialJournalLineList
        Relationships: []
      }
      financial_cashflow_realized_v: {
        Row: CashflowRealizedRow
        Relationships: []
      }
      financial_cashflow_forecast_v: {
        Row: CashflowForecastRow
        Relationships: []
      }
      financial_cashflow_statement_v: {
        Row: CashflowStatementRow
        Relationships: []
      }
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
      create_financial_transaction: {
        Args: {
          p_description: string; p_transaction_date: string; p_competence_date: string
          p_movement_type: FinancialMovementType; p_amount: number | string
          p_category_id?: string | null; p_origin_account_id?: string | null
          p_destination_account_id?: string | null; p_party_id?: string | null
          p_cost_center_id?: string | null; p_service_line_id?: string | null
          p_payment_method_id?: string | null; p_due_date?: string | null
          p_payment_date?: string | null; p_notes?: string | null
          p_principal_amount?: number | string | null; p_interest_amount?: number | string | null
          p_idempotency_key?: string | null
        }
        Returns: string
      }
      settle_financial_transaction: {
        Args: { p_transaction_id: string; p_payment_date: string; p_payment_method_id?: string | null }
        Returns: undefined
      }
      cancel_financial_transaction: {
        Args: { p_transaction_id: string; p_reason?: string | null }
        Returns: undefined
      }
      update_financial_transaction: {
        Args: {
          p_transaction_id: string; p_description?: string | null
          p_transaction_date?: string | null; p_competence_date?: string | null
          p_movement_type?: FinancialMovementType | null; p_amount?: number | string | null
          p_category_id?: string | null; p_origin_account_id?: string | null
          p_destination_account_id?: string | null; p_party_id?: string | null
          p_cost_center_id?: string | null; p_service_line_id?: string | null
          p_payment_method_id?: string | null; p_due_date?: string | null
          p_payment_date?: string | null; p_notes?: string | null
          p_principal_amount?: number | string | null; p_interest_amount?: number | string | null
          p_expected_version?: number | null
        }
        Returns: undefined
      }
      cashflow_13_week_projection: {
        Args: { p_from?: string | null }
        Returns: Cashflow13WeekRow[]
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
      financial_account_class: FinancialAccountClass
      financial_nature: FinancialNature
      financial_current_class: FinancialCurrentClass
      financial_dfc_class: FinancialDfcClass
      financial_movement_type: FinancialMovementType
      financial_account_type: FinancialAccountType
      financial_transaction_status: FinancialTransactionStatus
    }
    CompositeTypes: Record<string, never>
  }
}
