-- ============================================================================
-- ETAPA 08G — DMPL/DLPA + DVA + Ajustes Contábeis + Notas Gerenciais
-- Migration: 20260827000200_create_dmpl_dlpa_dva_adjustments_notes.sql
--
-- Princípio: DMPL, DLPA e DVA derivam exclusivamente do ledger.
-- Não criar segundo livro contábil.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUM: note_type
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.financial_note_type AS ENUM (
    'GERAL', 'DRE', 'BP', 'DFC', 'DMPL', 'DLPA', 'DVA', 'AJUSTE', 'CONTA', 'ATIVO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. ENUM: adjustment_status
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.financial_adjustment_status AS ENUM (
    'PENDING', 'APPLIED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 3. TABLE: financial_notes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.financial_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_type public.financial_note_type NOT NULL,
  title text NOT NULL,
  body text,
  reference_date date,
  period_start date,
  period_end date,
  chart_account_id uuid REFERENCES public.financial_chart_accounts(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  journal_entry_id uuid REFERENCES public.financial_journal_entries(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.financial_assets(id) ON DELETE SET NULL,
  report_type text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_notes_title_length_chk CHECK (char_length(title) between 1 and 200)
);

CREATE INDEX IF NOT EXISTS idx_financial_notes_type ON public.financial_notes (note_type, active);
CREATE INDEX IF NOT EXISTS idx_financial_notes_period ON public.financial_notes (period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_financial_notes_report ON public.financial_notes (report_type) WHERE report_type <> '';

-- ---------------------------------------------------------------------------
-- 4. RLS: financial_notes
-- ---------------------------------------------------------------------------

ALTER TABLE public.financial_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_select_internal ON public.financial_notes;
CREATE POLICY notes_select_internal ON public.financial_notes
  FOR SELECT USING (public.is_internal_user());

DROP POLICY IF EXISTS notes_insert_admin ON public.financial_notes;
CREATE POLICY notes_insert_admin ON public.financial_notes
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS notes_update_admin ON public.financial_notes;
CREATE POLICY notes_update_admin ON public.financial_notes
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS notes_delete_admin ON public.financial_notes;
CREATE POLICY notes_delete_admin ON public.financial_notes
  FOR DELETE USING (public.is_admin());

-- Grants
GRANT SELECT ON public.financial_notes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.financial_notes TO authenticated;

-- Revoke anon/public
DO $$ BEGIN REVOKE ALL ON public.financial_notes FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.financial_notes FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 5. TRIGGER: updated_at for financial_notes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_notes_updated_at ON public.financial_notes;
CREATE TRIGGER trg_financial_notes_updated_at
  BEFORE UPDATE ON public.financial_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. RPC: create_manual_journal_adjustment
--    Cria journal entry de ajuste com partidas dobradas.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_manual_journal_adjustment(
  p_entry_date date,
  p_competence_date date,
  p_description text,
  p_lines jsonb,
  p_reference text DEFAULT null,
  p_cost_center_id uuid DEFAULT null,
  p_service_line_id uuid DEFAULT null,
  p_idempotency_key uuid DEFAULT null,
  p_justification text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_entry_id uuid;
  v_transaction_id uuid;
  v_line jsonb;
  v_total_debit numeric(15,2) := 0;
  v_total_credit numeric(15,2) := 0;
  v_line_count integer := 0;
  v_idempotency uuid;
BEGIN
  -- Guard: admin only
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem criar ajustes contabeis';
  END IF;

  -- Idempotency
  v_idempotency := COALESCE(p_idempotency_key, gen_random_uuid());

  IF EXISTS (
    SELECT 1 FROM public.financial_journal_entries
    WHERE idempotency_key = v_idempotency::text
  ) THEN
    SELECT id INTO v_entry_id FROM public.financial_journal_entries
    WHERE idempotency_key = v_idempotency::text;
    RETURN v_entry_id;
  END IF;

  -- Validate lines
  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Ajuste deve ter pelo menos 2 linhas';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_total_debit := v_total_debit + COALESCE((v_line->>'debit')::numeric, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::numeric, 0);
    v_line_count := v_line_count + 1;
  END LOOP;

  IF ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Ajuste desbalanceado: debitos (%) != creditos (%)', v_total_debit, v_total_credit;
  END IF;

  -- Create transaction (AJUSTE type)
  INSERT INTO public.financial_transactions (
    description, transaction_date, competence_date, movement_type, amount, status
  ) VALUES (
    p_description, p_entry_date, p_competence_date, 'AJUSTE', v_total_debit, 'settled'
  ) RETURNING id INTO v_transaction_id;

  -- Create journal entry
  INSERT INTO public.financial_journal_entries (
    transaction_id, entry_type, entry_date, competence_date, description, status, idempotency_key
  ) VALUES (
    v_transaction_id, 'ajuste', p_entry_date, p_competence_date, p_description, 'settled', v_idempotency::text
  ) RETURNING id INTO v_entry_id;

  -- Create journal lines (single INSERT to avoid per-line trigger)
  INSERT INTO public.financial_journal_lines (
    entry_id, chart_account_id, debit, credit, description
  )
  SELECT
    v_entry_id,
    (elem->>'chart_account_id')::uuid,
    COALESCE((elem->>'debit')::numeric, 0),
    COALESCE((elem->>'credit')::numeric, 0),
    COALESCE(elem->>'description', '')
  FROM jsonb_array_elements(p_lines) AS elem;

  -- Create note if justification provided
  IF p_justification IS NOT NULL AND p_justification <> '' THEN
    INSERT INTO public.financial_notes (
      note_type, title, body, reference_date, journal_entry_id, report_type
    ) VALUES (
      'AJUSTE', 'Ajuste: ' || p_description, p_justification, p_entry_date, v_entry_id, 'AJUSTE'
    );
  END IF;

  RETURN v_entry_id;
END;
$$;

-- Grants for adjustment
GRANT EXECUTE ON FUNCTION public.create_manual_journal_adjustment(
  date, date, text, jsonb, text, uuid, uuid, uuid, text
) TO authenticated;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.create_manual_journal_adjustment(
  date, date, text, jsonb, text, uuid, uuid, uuid, text
) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.create_manual_journal_adjustment(
  date, date, text, jsonb, text, uuid, uuid, uuid, text
) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 7. RPC: get_statement_of_changes_in_equity (DMPL)
--    Demonstra as mutações do Patrimônio Líquido.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_statement_of_changes_in_equity(
  p_from date DEFAULT NULL,
  p_to date DEFAULT current_date
)
RETURNS TABLE (
  row_label text,
  capital_social numeric(15,2),
  reservas numeric(15,2),
  lucros_prejuizos_acumulados numeric(15,2),
  resultado_exercicio numeric(15,2),
  outros_componentes numeric(15,2),
  total_pl numeric(15,2),
  sort_order int
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_from date;
  v_capital_open numeric(15,2);
  v_reservas_open numeric(15,2);
  v_lp_open numeric(15,2);
  v_result_open numeric(15,2);
  v_outros_open numeric(15,2);
  v_capital_mov numeric(15,2);
  v_reservas_mov numeric(15,2);
  v_lp_mov numeric(15,2);
  v_result_mov numeric(15,2);
  v_outros_mov numeric(15,2);
BEGIN
  -- Guard
  IF auth.uid() IS NOT NULL AND NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_from := COALESCE(p_from, '2026-01-01');

  -- Calculate opening balances (before v_from)
  -- Capital Social
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_capital_open
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Capital Social'
    AND ca.active = true
    AND je.competence_date < v_from
    AND je.status <> 'cancelled';

  -- Reservas
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_reservas_open
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Reservas'
    AND ca.active = true
    AND je.competence_date < v_from
    AND je.status <> 'cancelled';

  -- Lucros/Prejuizos Acumulados
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_lp_open
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name NOT LIKE '%Ajustes%'
    AND ca.active = true
    AND je.competence_date < v_from
    AND je.status <> 'cancelled';

  -- Resultado do Exercício (DRE result before v_from)
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_result_open
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA') AND ca.dre_class <> ''
    AND ca.active = true
    AND je.competence_date < v_from
    AND je.status <> 'cancelled';

  -- Outros componentes (Ajustes de Exercícios Anteriores + Distribuições + Saldos Iniciais)
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_outros_open
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL'
    AND ca.bp_group IN ('Resultados Acumulados', 'Distribuicoes', 'Saldos Iniciais')
    AND ca.name LIKE '%Ajustes%'
    AND ca.active = true
    AND je.competence_date < v_from
    AND je.status <> 'cancelled';

  -- Calculate movements during period (v_from to p_to)
  -- Capital Social movements
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_capital_mov
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Capital Social'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Reservas movements
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_reservas_mov
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Reservas'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Lucros/Prejuizos Acumulados movements
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_lp_mov
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name NOT LIKE '%Ajustes%'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Resultado do Exercício during period
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_result_mov
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA') AND ca.dre_class <> ''
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Outros componentes movements
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_outros_mov
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL'
    AND ca.bp_group IN ('Resultados Acumulados', 'Distribuicoes', 'Saldos Iniciais')
    AND ca.name LIKE '%Ajustes%'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Return DMPL structure
  row_label := 'Saldo Inicial';
  capital_social := v_capital_open;
  reservas := v_reservas_open;
  lucros_prejuizos_acumulados := v_lp_open;
  resultado_exercicio := v_result_open;
  outros_componentes := v_outros_open;
  total_pl := v_capital_open + v_reservas_open + v_lp_open + v_result_open + v_outros_open;
  sort_order := 1;
  RETURN NEXT;

  row_label := 'Aportes de Capital';
  capital_social := v_capital_mov;
  reservas := 0;
  lucros_prejuizos_acumulados := 0;
  resultado_exercicio := 0;
  outros_componentes := 0;
  total_pl := v_capital_mov;
  sort_order := 2;
  RETURN NEXT;

  row_label := 'Ajustes de Exercicios Anteriores';
  capital_social := 0;
  reservas := 0;
  lucros_prejuizos_acumulados := 0;
  resultado_exercicio := 0;
  outros_componentes := v_outros_mov;
  total_pl := v_outros_mov;
  sort_order := 3;
  RETURN NEXT;

  row_label := 'Resultado do Periodo';
  capital_social := 0;
  reservas := 0;
  lucros_prejuizos_acumulados := 0;
  resultado_exercicio := v_result_mov;
  outros_componentes := 0;
  total_pl := v_result_mov;
  sort_order := 4;
  RETURN NEXT;

  row_label := 'Distribuicoes / Retiradas';
  capital_social := 0;
  reservas := 0;
  lucros_prejuizos_acumulados := 0;
  resultado_exercicio := 0;
  outros_componentes := -v_lp_mov;
  total_pl := -v_lp_mov;
  sort_order := 5;
  RETURN NEXT;

  row_label := 'Transferencias Internas do PL';
  capital_social := 0;
  reservas := v_reservas_mov;
  lucros_prejuizos_acumulados := 0;
  resultado_exercicio := 0;
  outros_componentes := 0;
  total_pl := v_reservas_mov;
  sort_order := 6;
  RETURN NEXT;

  row_label := 'Saldo Final';
  capital_social := v_capital_open + v_capital_mov;
  reservas := v_reservas_open + v_reservas_mov;
  lucros_prejuizos_acumulados := v_lp_open + v_lp_mov;
  resultado_exercicio := v_result_open + v_result_mov;
  outros_componentes := v_outros_open + v_outros_mov;
  total_pl := (v_capital_open + v_capital_mov) + (v_reservas_open + v_reservas_mov) +
              (v_lp_open + v_lp_mov) + (v_result_open + v_result_mov) + (v_outros_open + v_outros_mov);
  sort_order := 7;
  RETURN NEXT;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_statement_of_changes_in_equity(date, date) TO authenticated;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.get_statement_of_changes_in_equity(date, date) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_statement_of_changes_in_equity(date, date) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 8. RPC: get_retained_earnings_statement (DLPA)
--    Demonstra Lucros ou Prejuízos Acumulados.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_retained_earnings_statement(
  p_from date DEFAULT NULL,
  p_to date DEFAULT current_date
)
RETURNS TABLE (
  row_label text,
  amount numeric(15,2),
  sort_order int
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_from date;
  v_open_lp numeric(15,2);
  v_open_aje numeric(15,2);
  v_mov_lp numeric(15,2);
  v_mov_aje numeric(15,2);
  v_dre_result numeric(15,2);
  v_distribuicoes numeric(15,2);
BEGIN
  -- Guard
  IF auth.uid() IS NOT NULL AND NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_from := COALESCE(p_from, '2026-01-01');

  -- Opening LP
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_open_lp
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name NOT LIKE '%Ajustes%'
    AND ca.active = true
    AND je.competence_date < v_from
    AND je.status <> 'cancelled';

  -- Opening AJE
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_open_aje
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name LIKE '%Ajustes%'
    AND ca.active = true
    AND je.competence_date < v_from
    AND je.status <> 'cancelled';

  -- Movements LP
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_mov_lp
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name NOT LIKE '%Ajustes%'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Movements AJE
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_mov_aje
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Resultados Acumulados'
    AND ca.name LIKE '%Ajustes%'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- DRE Result
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_dre_result
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA') AND ca.dre_class <> ''
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Distribuições
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_distribuicoes
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class = 'PL' AND ca.bp_group = 'Distribuicoes'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Return DLPA
  row_label := 'Saldo Inicial de Lucros/Prejuizos Acumulados';
  amount := v_open_lp;
  sort_order := 1;
  RETURN NEXT;

  row_label := '(+) Ajustes de Exercicios Anteriores';
  amount := v_open_aje;
  sort_order := 2;
  RETURN NEXT;

  row_label := '(+) Resultado Liquido do Periodo';
  amount := v_dre_result;
  sort_order := 3;
  RETURN NEXT;

  row_label := '(-) Dividendos / Distribuicoes / Retiradas';
  amount := -v_distribuicoes;
  sort_order := 4;
  RETURN NEXT;

  row_label := '(+) Ajustes do Periodo';
  amount := v_mov_aje;
  sort_order := 5;
  RETURN NEXT;

  row_label := '= Saldo Final';
  amount := v_open_lp + v_open_aje + v_dre_result - v_distribuicoes + v_mov_aje + v_mov_lp;
  sort_order := 6;
  RETURN NEXT;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_retained_earnings_statement(date, date) TO authenticated;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.get_retained_earnings_statement(date, date) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_retained_earnings_statement(date, date) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 9. RPC: get_value_added_statement (DVA)
--    Demonstra a geração e distribuição do valor adicionado.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_value_added_statement(
  p_from date DEFAULT NULL,
  p_to date DEFAULT current_date
)
RETURNS TABLE (
  row_label text,
  amount numeric(15,2),
  sort_order int
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO 'public', pg_temp
AS $$
DECLARE
  v_from date;
  v_receitas numeric(15,2);
  v_insumos numeric(15,2);
  v_bruto numeric(15,2);
  v_retencoes numeric(15,2);
  v_liquido numeric(15,2);
  v_transferencias numeric(15,2);
  v_total_distribuir numeric(15,2);
  v_pessoal numeric(15,2);
  v_governo numeric(15,2);
  v_capital_terceiros numeric(15,2);
  v_capital_proprio numeric(15,2);
  v_outros numeric(15,2);
  v_total_distribuido numeric(15,2);
BEGIN
  -- Guard
  IF auth.uid() IS NOT NULL AND NOT public.is_internal_user() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_from := COALESCE(p_from, '2026-01-01');

  -- Receitas (dva_class = 'RECEITAS')
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_receitas
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'RECEITAS'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Insumos adquiridos de terceiros (dva_class = 'INSUMOS_TERCEIROS')
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_insumos
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'INSUMOS_TERCEIROS'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Valor Adicionado Bruto
  v_bruto := v_receitas - v_insumos;

  -- Retenções (dva_class = 'RETENCOES' - depreciação/amortização)
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_retencoes
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'RETENCOES'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Valor Adicionado Líquido
  v_liquido := v_bruto - v_retencoes;

  -- Transferências (dva_class = 'VALOR_RECEBIDO_TRANSFERENCIA')
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_transferencias
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'VALOR_RECEBIDO_TRANSFERENCIA'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Total a Distribuir
  v_total_distribuir := v_liquido + v_transferencias;

  -- Distribuição: Pessoal
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_pessoal
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'PESSOAL'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Distribuição: Governo / Tributos
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_governo
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'TRIBUTOS'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Distribuição: Capital de Terceiros
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_capital_terceiros
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'CAPITAL_TERCEIROS'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Distribuição: Capital Próprio
  SELECT COALESCE(SUM(
    CASE WHEN ca.nature = 'CREDITO' THEN jl.debit - jl.credit
         WHEN ca.nature = 'DEBITO' THEN jl.credit - jl.debit
         ELSE 0 END
  ), 0)
  INTO v_capital_proprio
  FROM public.financial_journal_lines jl
  JOIN public.financial_journal_entries je ON je.id = jl.entry_id
  JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
  WHERE ca.class IN ('RECEITA', 'CUSTO', 'DESPESA')
    AND ca.dva_class = 'CAPITAL_PROPRIO'
    AND ca.active = true
    AND je.competence_date BETWEEN v_from AND p_to
    AND je.status <> 'cancelled';

  -- Total Distribuído
  v_total_distribuido := v_pessoal + v_governo + v_capital_terceiros + v_capital_proprio;

  -- Return DVA
  row_label := 'Receitas';
  amount := v_receitas;
  sort_order := 1;
  RETURN NEXT;

  row_label := '(-) Insumos Adquiridos de Terceiros';
  amount := -v_insumos;
  sort_order := 2;
  RETURN NEXT;

  row_label := '= Valor Adicionado Bruto';
  amount := v_bruto;
  sort_order := 3;
  RETURN NEXT;

  row_label := '(-) Retencoes (Depreciacao/Amortizacao)';
  amount := -v_retencoes;
  sort_order := 4;
  RETURN NEXT;

  row_label := '= Valor Adicionado Liquido Produzido';
  amount := v_liquido;
  sort_order := 5;
  RETURN NEXT;

  row_label := '(+) Valor Adicionado Recebido em Transferencia';
  amount := v_transferencias;
  sort_order := 6;
  RETURN NEXT;

  row_label := '= Valor Adicionado Total a Distribuir';
  amount := v_total_distribuir;
  sort_order := 7;
  RETURN NEXT;

  row_label := 'Distribuicao - Pessoal';
  amount := v_pessoal;
  sort_order := 8;
  RETURN NEXT;

  row_label := 'Distribuicao - Governo / Tributos';
  amount := v_governo;
  sort_order := 9;
  RETURN NEXT;

  row_label := 'Distribuicao - Capital de Terceiros';
  amount := v_capital_terceiros;
  sort_order := 10;
  RETURN NEXT;

  row_label := 'Distribuicao - Capital Proprio / Lucros';
  amount := v_capital_proprio;
  sort_order := 11;
  RETURN NEXT;

  row_label := '= Total Distribuido';
  amount := v_total_distribuido;
  sort_order := 12;
  RETURN NEXT;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.get_value_added_statement(date, date) TO authenticated;

DO $$ BEGIN REVOKE ALL ON FUNCTION public.get_value_added_statement(date, date) FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.get_value_added_statement(date, date) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 10. RLS: financial_notes hardening
-- ---------------------------------------------------------------------------

-- Revoke from anon/public
DO $$ BEGIN REVOKE ALL ON public.financial_notes FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN REVOKE ALL ON public.financial_notes FROM PUBLIC; EXCEPTION WHEN undefined_object THEN NULL; END $$;