-- ==========================================================================
-- MICROGATE 03 — Operational Workflow
-- F-04: Cash/credit explicit creation
-- F-05: Append-only safe update
-- F-07: Full settled reversal
-- F-08: Centralized cache invalidation
-- F-09: Cancelled not in settled_amount/forecast
-- ==========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Schema: reversal relationship on journal entries
-- ---------------------------------------------------------------------------

ALTER TABLE public.financial_journal_entries
  ADD COLUMN IF NOT EXISTS reversal_of_entry_id uuid NULL,
  ADD COLUMN IF NOT EXISTS reversal_reason text NULL;

-- FK: reversal entry points to original entry
DO $$ BEGIN
  ALTER TABLE public.financial_journal_entries
    ADD CONSTRAINT fje_reversal_of_entry_fk
    FOREIGN KEY (reversal_of_entry_id)
    REFERENCES public.financial_journal_entries(id)
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Check: no self-reversal
DO $$ BEGIN
  ALTER TABLE public.financial_journal_entries
    ADD CONSTRAINT fje_no_self_reversal
    CHECK (reversal_of_entry_id IS NULL OR reversal_of_entry_id <> id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Check: only estorno entries can have reversal_of_entry_id
DO $$ BEGIN
  ALTER TABLE public.financial_journal_entries
    ADD CONSTRAINT fje_reversal_type_check
    CHECK (reversal_of_entry_id IS NULL OR entry_type = 'estorno');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unique: one reversal per original entry
CREATE UNIQUE INDEX IF NOT EXISTS idx_fje_one_reversal
  ON public.financial_journal_entries(reversal_of_entry_id)
  WHERE reversal_of_entry_id IS NOT NULL;

-- Trigger: validate same transaction
CREATE OR REPLACE FUNCTION public.validate_reversal_same_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY invoker
SET search_path = ''
AS $$
BEGIN
  IF NEW.reversal_of_entry_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_journal_entries orig
      WHERE orig.id = NEW.reversal_of_entry_id
        AND orig.transaction_id = NEW.transaction_id
    ) THEN
      RAISE EXCEPTION 'Reversal entry must reference an original entry in the same transaction';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fje_validate_reversal ON public.financial_journal_entries;
CREATE TRIGGER trg_fje_validate_reversal
  BEFORE INSERT ON public.financial_journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_reversal_same_transaction();

-- ---------------------------------------------------------------------------
-- 2. Helper: reverse_unreversed_journal_entries (COR-1, COR-10)
--    Copy-based: inverts each journal line exactly.
--    Detects unreversed via NOT EXISTS (not just reversal_of_entry_id IS NULL).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reverse_unreversed_journal_entries(
  p_transaction_id uuid,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer := 0;
  v_orig RECORD;
  v_new_entry_id uuid;
BEGIN
  FOR v_orig IN
    SELECT je.*
    FROM public.financial_journal_entries je
    WHERE je.transaction_id = p_transaction_id
      AND je.reversal_of_entry_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.financial_journal_entries rev
        WHERE rev.reversal_of_entry_id = je.id
      )
  LOOP
    INSERT INTO public.financial_journal_entries (
      transaction_id, entry_type, entry_date, competence_date,
      description, status, review_required,
      reversal_of_entry_id, reversal_reason
    ) VALUES (
      v_orig.transaction_id, 'estorno', v_orig.entry_date, v_orig.competence_date,
      v_orig.description || ' - Estorno', 'settled', false,
      v_orig.id, p_reason
    ) RETURNING id INTO v_new_entry_id;

    -- COR-10: copy lines inverting debit/credit exactly
    INSERT INTO public.financial_journal_lines (entry_id, chart_account_id, debit, credit, description)
    SELECT v_new_entry_id, jl.chart_account_id, jl.credit, jl.debit, jl.description
    FROM public.financial_journal_lines jl
    WHERE jl.entry_id = v_orig.id;

    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Nenhuma entrada contabil elegivel para estorno na transacao';
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_unreversed_journal_entries(uuid, text)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Rewrite cancel_financial_transaction (COR-9)
--    Unified: works for pending AND settled via copy-based reversal.
--    Frontend presents "Cancelar" for pending, "Estornar" for settled.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_financial_transaction(
  p_transaction_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.financial_transactions%rowtype;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem cancelar/estornar transacoes';
  end if;

  select * into v_tx
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transacao nao encontrada';
  end if;

  if v_tx.status = 'cancelled' then
    raise exception 'Transacao ja esta cancelada';
  end if;

  perform public.assert_period_unlocked(v_tx.competence_date);
  if v_tx.transaction_date <> v_tx.competence_date then
    perform public.assert_period_unlocked(v_tx.transaction_date);
  end if;

  -- COR-1: copy-based reversal of all unreversed entries
  perform public.reverse_unreversed_journal_entries(p_transaction_id, p_reason);

  update public.financial_transactions
  set status = 'cancelled',
      review_required = true,
      notes = case when p_reason is not null
                   then coalesce(notes, '') || E'\n[Cancelamento] ' || p_reason
                   else notes end,
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_transaction_id;
end;
$$;

revoke all on function public.cancel_financial_transaction(uuid, text)
  from public, anon, authenticated;
grant execute on function public.cancel_financial_transaction(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Rewrite update_financial_transaction (COR-6, COR-7, COR-8)
--    Append-only: reverse old entries, then generate new canonical entry.
--    CAS mandatory. payment_date rejected (use settle instead).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_financial_transaction(
  p_transaction_id uuid,
  p_expected_version integer,
  p_description text default null,
  p_transaction_date date default null,
  p_competence_date date default null,
  p_movement_type public.financial_movement_type default null,
  p_amount numeric(15,2) default null,
  p_category_id uuid default null,
  p_origin_account_id uuid default null,
  p_destination_account_id uuid default null,
  p_party_id uuid default null,
  p_cost_center_id uuid default null,
  p_service_line_id uuid default null,
  p_payment_method_id uuid default null,
  p_due_date date default null,
  p_notes text default null,
  p_principal_amount numeric default null,
  p_interest_amount numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.financial_transactions%rowtype;
  v_new_description text;
  v_new_transaction_date date;
  v_new_competence_date date;
  v_new_movement_type public.financial_movement_type;
  v_new_amount numeric(15,2);
  v_new_category_id uuid;
  v_new_origin_account_id uuid;
  v_new_destination_account_id uuid;
  v_new_party_id uuid;
  v_new_cost_center_id uuid;
  v_new_service_line_id uuid;
  v_new_payment_method_id uuid;
  v_new_due_date date;
  v_new_notes text;
begin
  -- COR-7: CAS mandatory
  if p_expected_version IS NULL then
    raise exception 'Versao esperada e obrigatoria para atualizacao (CAS)';
  end if;

  -- Authorization: only admin (skip when no auth context, e.g. CLI tests)
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem atualizar transacoes';
  end if;

  -- Fetch transaction
  select * into v_tx
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transacao nao encontrada';
  end if;

  if v_tx.status != 'pending' then
    raise exception 'Apenas transacoes pendentes podem ser editadas. Status atual: %', v_tx.status;
  end if;

  -- CAS: version check
  if v_tx.version != p_expected_version then
    raise exception 'Conflito de concorrencia. Versao esperada: %, atual: %', p_expected_version, v_tx.version;
  end if;

  -- Apply values (coalesce to keep existing)
  v_new_description := coalesce(p_description, v_tx.description);
  v_new_transaction_date := coalesce(p_transaction_date, v_tx.transaction_date);
  v_new_competence_date := coalesce(p_competence_date, v_tx.competence_date);
  v_new_movement_type := coalesce(p_movement_type, v_tx.movement_type);
  v_new_amount := coalesce(p_amount, v_tx.amount);
  v_new_category_id := coalesce(p_category_id, v_tx.category_id);
  v_new_origin_account_id := coalesce(p_origin_account_id, v_tx.origin_account_id);
  v_new_destination_account_id := coalesce(p_destination_account_id, v_tx.destination_account_id);
  v_new_party_id := p_party_id;
  v_new_cost_center_id := p_cost_center_id;
  v_new_service_line_id := p_service_line_id;
  v_new_payment_method_id := p_payment_method_id;
  v_new_due_date := p_due_date;
  v_new_notes := p_notes;

  -- Validation: period
  perform public.assert_period_unlocked(v_new_transaction_date);

  -- Validation: references
  perform public.validate_transaction_references(
    v_new_category_id, v_new_origin_account_id, v_new_destination_account_id,
    v_new_party_id, v_new_cost_center_id, v_new_service_line_id, v_new_payment_method_id
  );

  -- Validation: required fields per type
  perform public.validate_transaction_by_movement_type(
    v_new_movement_type, v_new_category_id, v_new_origin_account_id, v_new_destination_account_id,
    p_principal_amount, p_interest_amount
  );

  -- COR-6: reverse old entries before updating
  perform public.reverse_unreversed_journal_entries(p_transaction_id, 'Edicao append-only');

  -- Update transaction header
  update public.financial_transactions
  set description = v_new_description,
      transaction_date = v_new_transaction_date,
      competence_date = v_new_competence_date,
      movement_type = v_new_movement_type,
      amount = v_new_amount,
      category_id = v_new_category_id,
      origin_account_id = v_new_origin_account_id,
      destination_account_id = v_new_destination_account_id,
      party_id = v_new_party_id,
      cost_center_id = v_new_cost_center_id,
      service_line_id = v_new_service_line_id,
      payment_method_id = v_new_payment_method_id,
      due_date = v_new_due_date,
      notes = v_new_notes,
      review_required = case when v_new_movement_type = 'SALDO_INICIAL' then true else false end,
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_transaction_id;

  -- Generate new canonical entry
  perform public.generate_journal_entries(
    p_transaction_id, v_new_movement_type, v_new_amount, 'pending',
    v_new_category_id, v_new_origin_account_id, v_new_destination_account_id,
    v_new_competence_date, v_new_transaction_date, v_new_description,
    false, p_principal_amount, p_interest_amount
  );
end;
$$;

revoke all on function public.update_financial_transaction(
  uuid, integer, text, date, date, public.financial_movement_type, numeric,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric
) from public, anon, authenticated;
grant execute on function public.update_financial_transaction(
  uuid, integer, text, date, date, public.financial_movement_type, numeric,
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, numeric, numeric
) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Fix settle_financial_transaction (COR-3)
--    Require financial_account_id. Validate no existing cash entry.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.settle_financial_transaction(
  p_transaction_id uuid,
  p_payment_date date,
  p_financial_account_id uuid,
  p_payment_method_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.financial_transactions%rowtype;
  v_cash_account_id uuid;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Apenas administradores podem liquidar transacoes';
  end if;

  select * into v_tx
  from public.financial_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transacao nao encontrada';
  end if;

  if v_tx.status <> 'pending' then
    raise exception 'Apenas transacoes pendentes podem ser liquidadas. Status atual: %', v_tx.status;
  end if;

  if v_tx.movement_type not in ('RECEITA', 'DESPESA', 'IMOBILIZADO') then
    raise exception 'Liquidacao separada aplica-se somente a titulos AR/AP';
  end if;

  -- COR-3: financial_account_id is required
  if p_financial_account_id IS NULL then
    raise exception 'Conta financeira e obrigatoria para liquidacao';
  end if;

  -- Validate financial_account exists and has a valid cash chart account
  select fa.chart_account_id into v_cash_account_id
  from public.financial_accounts fa
  where fa.id = p_financial_account_id;

  if v_cash_account_id IS NULL then
    raise exception 'Conta financeira invalida';
  end if;

  -- Validate no existing unreversed cash entry (prevent double settlement)
  IF EXISTS (
    SELECT 1 FROM public.financial_journal_entries
    WHERE transaction_id = p_transaction_id
      AND entry_type = 'caixa'
      AND reversal_of_entry_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.financial_journal_entries rev
        WHERE rev.reversal_of_entry_id = public.financial_journal_entries.id
      )
  ) THEN
    RAISE EXCEPTION 'Transacao ja possui liquidacao vigente';
  END IF;

  perform public.assert_period_unlocked(p_payment_date);

  update public.financial_transactions
  set status = 'settled',
      payment_date = p_payment_date,
      origin_account_id = case
        when v_tx.movement_type = 'RECEITA' then p_financial_account_id
        else v_tx.origin_account_id
      end,
      destination_account_id = case
        when v_tx.movement_type in ('DESPESA', 'IMOBILIZADO') then p_financial_account_id
        else v_tx.destination_account_id
      end,
      payment_method_id = coalesce(p_payment_method_id, v_tx.payment_method_id),
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_transaction_id;

  perform public.generate_journal_entries(
    p_transaction_id, v_tx.movement_type, v_tx.amount, 'settled',
    v_tx.category_id,
    case when v_tx.movement_type = 'RECEITA' then p_financial_account_id else v_tx.origin_account_id end,
    case when v_tx.movement_type in ('DESPESA', 'IMOBILIZADO') then p_financial_account_id else v_tx.destination_account_id end,
    v_tx.competence_date, p_payment_date, v_tx.description,
    false, null, null
  );
end;
$$;

revoke all on function public.settle_financial_transaction(uuid, date, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.settle_financial_transaction(uuid, date, uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Fix AR/AP views: COR-2, COR-12
--    settled_amount = 0 for cancelled. Ledger-derived AR/AP balance.
--    Include reversal effects (do NOT filter them out).
-- ---------------------------------------------------------------------------

-- Receivables view
CREATE OR REPLACE VIEW public.financial_receivables_v
WITH (security_invoker = true) AS
WITH tx AS (
  SELECT
    t.id AS transaction_id,
    t.description,
    t.movement_type,
    t.status,
    t.amount AS original_amount,
    t.due_date,
    t.competence_date,
    t.transaction_date,
    t.created_at,
    t.party_id,
    t.cost_center_id,
    t.service_line_id,
    t.review_required,
    p.name AS party_name,
    (SELECT ca.name FROM public.financial_categories ca WHERE ca.id = t.category_id) AS category_name,
    (SELECT cc.name FROM public.financial_cost_centers cc WHERE cc.id = t.cost_center_id) AS cost_center_name,
    (SELECT sl.name FROM public.financial_service_lines sl WHERE sl.id = t.service_line_id) AS service_line_name,
    t.origin_account_id,
    t.payment_method_id,
    -- COR-2: AR balance from all journal lines (originals + reversals net out)
    COALESCE((
      SELECT SUM(jl.debit - jl.credit)
      FROM public.financial_journal_entries je
      JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
      JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
      WHERE je.transaction_id = t.id
        AND ca.code = '1.1.02.001'
    ), 0) AS ar_control_balance
  FROM public.financial_transactions t
  LEFT JOIN public.financial_parties p ON t.party_id = p.id
  WHERE t.movement_type = 'RECEITA'
    AND (
      t.payment_date IS NULL
      OR EXISTS (
        SELECT 1 FROM public.financial_journal_entries recognized
        WHERE recognized.transaction_id = t.id
          AND recognized.entry_type = 'competencia'
      )
    )
)
SELECT
  transaction_id, description, movement_type, status, original_amount,
  -- COR-12: cancelled = 0 for both
  CASE WHEN status = 'settled' THEN original_amount ELSE 0 END AS settled_amount,
  -- COR-2: open_amount from ledger control balance
  CASE WHEN status = 'pending' THEN GREATEST(ar_control_balance, 0) ELSE 0 END AS open_amount,
  transaction_date, competence_date, due_date,
  (status = 'pending' AND due_date < current_date) AS overdue,
  CASE WHEN status = 'pending' AND due_date < current_date
    THEN current_date - due_date ELSE 0 END AS days_overdue,
  party_name, category_name, cost_center_id,
  cost_center_name, service_line_id, service_line_name, origin_account_id,
  payment_method_id,
  (SELECT je.id FROM public.financial_journal_entries je
   WHERE je.transaction_id = tx.transaction_id AND je.entry_type = 'competencia'
   AND je.reversal_of_entry_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.financial_journal_entries r WHERE r.reversal_of_entry_id = je.id)
   ORDER BY je.created_at DESC LIMIT 1) AS competency_entry_id,
  (SELECT je.id FROM public.financial_journal_entries je
   WHERE je.transaction_id = tx.transaction_id AND je.entry_type = 'caixa'
   AND je.reversal_of_entry_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.financial_journal_entries r WHERE r.reversal_of_entry_id = je.id)
   ORDER BY je.created_at DESC LIMIT 1) AS settlement_entry_id
FROM tx;

-- Payables view
CREATE OR REPLACE VIEW public.financial_payables_v
WITH (security_invoker = true) AS
WITH tx AS (
  SELECT
    t.id AS transaction_id,
    t.description,
    t.movement_type,
    t.status,
    t.amount AS original_amount,
    t.due_date,
    t.competence_date,
    t.transaction_date,
    t.created_at,
    t.party_id,
    t.cost_center_id,
    t.service_line_id,
    t.review_required,
    p.name AS party_name,
    (SELECT ca.name FROM public.financial_categories ca WHERE ca.id = t.category_id) AS category_name,
    (SELECT cc.name FROM public.financial_cost_centers cc WHERE cc.id = t.cost_center_id) AS cost_center_name,
    (SELECT sl.name FROM public.financial_service_lines sl WHERE sl.id = t.service_line_id) AS service_line_name,
    t.origin_account_id,
    t.payment_method_id,
    -- COR-2: AP balance from all journal lines
    COALESCE((
      SELECT SUM(jl.credit - jl.debit)
      FROM public.financial_journal_entries je
      JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
      JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
      WHERE je.transaction_id = t.id
        AND ca.code = '2.1.01.001'
    ), 0) AS ap_control_balance
  FROM public.financial_transactions t
  LEFT JOIN public.financial_parties p ON t.party_id = p.id
  WHERE t.movement_type IN ('DESPESA', 'IMOBILIZADO')
    AND (
      t.payment_date IS NULL
      OR EXISTS (
        SELECT 1 FROM public.financial_journal_entries recognized
        WHERE recognized.transaction_id = t.id
          AND recognized.entry_type = 'competencia'
      )
    )
)
SELECT
  transaction_id, description, movement_type, status, original_amount,
  -- COR-12: cancelled = 0 for both
  CASE WHEN status = 'settled' THEN original_amount ELSE 0 END AS settled_amount,
  -- COR-2: open_amount from ledger control balance
  CASE WHEN status = 'pending' THEN GREATEST(ap_control_balance, 0) ELSE 0 END AS open_amount,
  transaction_date, competence_date, due_date,
  (status = 'pending' AND due_date < current_date) AS overdue,
  CASE WHEN status = 'pending' AND due_date < current_date
    THEN current_date - due_date ELSE 0 END AS days_overdue,
  party_name, category_name, cost_center_id,
  cost_center_name, service_line_id, service_line_name, origin_account_id,
  payment_method_id,
  (SELECT je.id FROM public.financial_journal_entries je
   WHERE je.transaction_id = tx.transaction_id AND je.entry_type = 'competencia'
   AND je.reversal_of_entry_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.financial_journal_entries r WHERE r.reversal_of_entry_id = je.id)
   ORDER BY je.created_at DESC LIMIT 1) AS competency_entry_id,
  (SELECT je.id FROM public.financial_journal_entries je
   WHERE je.transaction_id = tx.transaction_id AND je.entry_type = 'caixa'
   AND je.reversal_of_entry_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.financial_journal_entries r WHERE r.reversal_of_entry_id = je.id)
   ORDER BY je.created_at DESC LIMIT 1) AS settlement_entry_id
FROM tx;

-- ---------------------------------------------------------------------------
-- 7. Recreate forecast view (COR-13)
--    security_invoker = true. Only pending + open_amount > 0.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.financial_cashflow_forecast_v
WITH (security_invoker = true) AS
SELECT
  transaction_id, description, movement_type, status, due_date,
  original_amount, open_amount,
  CASE WHEN movement_type = 'RECEITA' THEN 'INFLOW' ELSE 'OUTFLOW' END AS direction,
  CASE WHEN movement_type = 'RECEITA' THEN open_amount ELSE 0 END AS projected_inflow,
  CASE WHEN movement_type IN ('DESPESA','IMOBILIZADO') THEN open_amount ELSE 0 END AS projected_outflow,
  party_name, category_name, cost_center_id, cost_center_name,
  service_line_id, service_line_name, overdue, days_overdue,
  CASE
    WHEN overdue THEN 'VENCIDO'::text
    WHEN due_date <= current_date + interval '7 days' THEN '7 dias'::text
    WHEN due_date <= current_date + interval '14 days' THEN '14 dias'::text
    WHEN due_date <= current_date + interval '30 days' THEN '30 dias'::text
    ELSE 'Posteriores'::text
  END AS due_bucket
FROM (
  SELECT rv.transaction_id, rv.description, rv.movement_type, rv.status,
    rv.due_date, rv.original_amount, rv.open_amount, rv.party_name,
    rv.category_name, rv.cost_center_id, rv.cost_center_name,
    rv.service_line_id, rv.service_line_name, rv.overdue, rv.days_overdue
  FROM public.financial_receivables_v rv
  WHERE rv.status = 'pending' AND rv.open_amount > 0

  UNION ALL

  SELECT pv.transaction_id, pv.description, pv.movement_type, pv.status,
    pv.due_date, pv.original_amount, pv.open_amount, pv.party_name,
    pv.category_name, pv.cost_center_id, pv.cost_center_name,
    pv.service_line_id, pv.service_line_name, pv.overdue, pv.days_overdue
  FROM public.financial_payables_v pv
  WHERE pv.status = 'pending' AND pv.open_amount > 0
) forecast
ORDER BY due_date NULLS LAST, description;

COMMENT ON VIEW public.financial_cashflow_forecast_v IS
  'Fluxo projetado: titulos pending com open_amount > 0. COR-13: excludes cancelled/reversed.';

-- ---------------------------------------------------------------------------
-- 8. Fix cashflow_summary: COR-4, COR-17
--    Accept p_financial_account_id, resolve internally to chart_account_id.
--    Add forecast date filtering.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cashflow_summary(
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL,
  p_financial_account_id uuid DEFAULT NULL,
  p_cost_center_id  uuid DEFAULT NULL,
  p_service_line_id uuid DEFAULT NULL
)
RETURNS TABLE (
  opening_balance    numeric(15,2),
  realized_inflows   numeric(15,2),
  realized_outflows  numeric(15,2),
  closing_balance    numeric(15,2),
  projected_inflows  numeric(15,2),
  projected_outflows numeric(15,2),
  projected_balance  numeric(15,2)
)
LANGUAGE sql STABLE
AS $$
  WITH period AS (
    SELECT
      COALESCE(p_from, '1900-01-01'::date) AS p_from,
      COALESCE(p_to, current_date)          AS p_to
  ),
  -- COR-4: resolve financial_account_id to chart_account_id
  resolved_account AS (
    SELECT fa.chart_account_id AS ca_id
    FROM public.financial_accounts fa
    WHERE fa.id = p_financial_account_id
  ),
  ob AS (
    SELECT public.cashflow_opening_balance(
      pb.p_from,
      (SELECT ca_id FROM resolved_account)
    ) AS v
    FROM period pb
  ),
  realized AS (
    SELECT
      SUM(CASE WHEN r.direction = 'INFLOW'  THEN r.amount ELSE 0 END) AS inflows,
      SUM(CASE WHEN r.direction = 'OUTFLOW' THEN r.amount ELSE 0 END) AS outflows
    FROM public.financial_cashflow_realized_v r, period pb
    WHERE r.entry_date >= pb.p_from
      AND r.entry_date <= pb.p_to
      AND ((SELECT ca_id FROM resolved_account) IS NULL OR (SELECT ca_id FROM resolved_account) = ANY(r.chart_account_ids))
      AND (p_cost_center_id IS NULL OR r.cost_center_id = p_cost_center_id)
      AND (p_service_line_id IS NULL OR r.service_line_id = p_service_line_id)
  ),
  proj AS (
    SELECT
      SUM(CASE WHEN f.direction = 'INFLOW'  THEN f.projected_inflow ELSE 0 END) AS inflows,
      SUM(CASE WHEN f.direction = 'OUTFLOW' THEN f.projected_outflow ELSE 0 END) AS outflows
    FROM public.financial_cashflow_forecast_v f, period pb
    WHERE (p_cost_center_id IS NULL OR f.cost_center_id = p_cost_center_id)
      AND (p_service_line_id IS NULL OR f.service_line_id = p_service_line_id)
      AND (f.due_date IS NULL OR f.due_date >= pb.p_from)
      AND (f.due_date IS NULL OR f.due_date <= pb.p_to)
  )
  SELECT
    ob.v AS opening_balance,
    COALESCE(r.inflows, 0)  AS realized_inflows,
    COALESCE(r.outflows, 0) AS realized_outflows,
    ob.v + COALESCE(r.inflows, 0) - COALESCE(r.outflows, 0) AS closing_balance,
    COALESCE(p.inflows, 0)  AS projected_inflows,
    COALESCE(p.outflows, 0) AS projected_outflows,
    ob.v + COALESCE(r.inflows, 0) - COALESCE(r.outflows, 0)
      + COALESCE(p.inflows, 0) - COALESCE(p.outflows, 0) AS projected_balance
  FROM ob, realized r, proj p;
$$;

COMMENT ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) IS
  'Resumo do fluxo de caixa. COR-4: accepts financial_account_id. COR-17: forecast date filter.';

GRANT EXECUTE ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) FROM PUBLIC;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION public.cashflow_summary(date, date, uuid, uuid, uuid) FROM anon; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 9. Grants on new columns (read-only for authenticated)
-- ---------------------------------------------------------------------------

-- The reversal_of_entry_id and reversal_reason are part of the journal entries
-- table which already has appropriate RLS and grants. No additional grants needed.

-- ---------------------------------------------------------------------------
-- 10. Refund views for settlement entry_id compatibility
--     The views now use subqueries for competency_entry_id and settlement_entry_id
--     that respect reversal_of_entry_id IS NULL + NOT EXISTS pattern.
-- ---------------------------------------------------------------------------

-- (Already handled in sections 6 above)

commit;
