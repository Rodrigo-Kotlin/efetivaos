-- FIN-FIX-4: append-only January 2026 historical reconciliation.
-- This migration is intentionally limited to the explicit audited IDs below.

CREATE OR REPLACE FUNCTION public.correct_settled_transaction_to_operational_expense(
  p_original_transaction_id uuid,
  p_category_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_original public.financial_transactions%rowtype;
  v_replacement public.financial_transactions%rowtype;
  v_replacement_id uuid;
  v_category public.financial_categories%rowtype;
  v_destination_chart_account_id uuid;
  v_counter_account_id uuid;
  v_payables_account_id uuid;
  v_reason text;
  v_idempotency_key text := 'FIN-FIX-4::' || p_original_transaction_id::text;
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Apenas administradores podem corrigir transacoes financeiras';
  END IF;

  SELECT * INTO v_category
  FROM public.financial_categories
  WHERE id = p_category_id
    AND active = true
  FOR SHARE;

  IF NOT FOUND OR v_category.movement_type <> 'DESPESA' THEN
    RAISE EXCEPTION 'Categoria de replacement invalida para despesa operacional';
  END IF;

  SELECT * INTO v_original
  FROM public.financial_transactions
  WHERE id = p_original_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transacao original nao encontrada';
  END IF;

  SELECT * INTO v_replacement
  FROM public.financial_transactions
  WHERE idempotency_key = v_idempotency_key;

  IF v_original.status = 'cancelled' AND v_replacement.id IS NOT NULL THEN
    RETURN v_replacement.id;
  END IF;

  IF v_original.status <> 'settled' THEN
    RAISE EXCEPTION 'Apenas transacoes liquidadas podem ser saneadas';
  END IF;

  IF v_original.movement_type <> 'DESPESA'
     OR v_original.payment_date IS NULL
     OR v_original.destination_account_id IS NULL THEN
    RAISE EXCEPTION 'Precondicao de despesa liquidada invalida';
  END IF;

  v_reason := COALESCE(NULLIF(BTRIM(p_reason), ''), 'Saneamento historico FIN-FIX-4');

  PERFORM public.cancel_financial_transaction(
    p_original_transaction_id,
    v_reason || ' | replacement append-only FIN-FIX-4'
  );

  v_replacement_id := public.create_financial_transaction(
    p_description => v_original.description,
    p_transaction_date => v_original.transaction_date,
    p_competence_date => v_original.competence_date,
    p_movement_type => 'DESPESA'::public.financial_movement_type,
    p_amount => v_original.amount,
    p_category_id => p_category_id,
    p_origin_account_id => v_original.origin_account_id,
    p_destination_account_id => v_original.destination_account_id,
    p_party_id => v_original.party_id,
    p_cost_center_id => v_original.cost_center_id,
    p_service_line_id => v_original.service_line_id,
    p_payment_method_id => v_original.payment_method_id,
    p_due_date => COALESCE(v_original.due_date, v_original.payment_date),
    p_notes => 'Origem da reclassificacao: ' || p_original_transaction_id::text || E'\n' || v_reason,
    p_idempotency_key => v_idempotency_key
  );

  -- Recreate the historical two-step posting: competence first, settlement
  -- second. This keeps the expense out of cash while preserving the real cash
  -- movement and its reversal relationship.
  PERFORM public.settle_financial_transaction(
    v_replacement_id,
    v_original.payment_date,
    v_original.destination_account_id,
    NULL
  );

  SELECT * INTO v_replacement
  FROM public.financial_transactions
  WHERE id = v_replacement_id;

  SELECT fa.chart_account_id INTO v_destination_chart_account_id
  FROM public.financial_accounts fa
  WHERE fa.id = v_original.destination_account_id;

  v_counter_account_id := v_category.counter_account_id;
  v_payables_account_id := public.get_chart_account_id_by_code('2.1.01.001');

  IF v_replacement.movement_type <> 'DESPESA'
     OR v_replacement.status <> 'settled'
     OR v_replacement.amount <> v_original.amount
     OR v_replacement.category_id <> p_category_id
     OR v_replacement.destination_account_id <> v_original.destination_account_id
     OR POSITION(p_original_transaction_id::text IN COALESCE(v_replacement.notes, '')) = 0 THEN
    RAISE EXCEPTION 'Replacement FIN-FIX-4 inconsistente';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financial_journal_entries je
    JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
    WHERE je.transaction_id = v_replacement_id
      AND je.entry_type = 'competencia'
      AND jl.chart_account_id = v_destination_chart_account_id
  ) THEN
    RAISE EXCEPTION 'Competencia do replacement ainda debita Banco Cora';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.financial_journal_entries je
    JOIN public.financial_journal_lines debit_line ON debit_line.entry_id = je.id
    JOIN public.financial_journal_lines credit_line ON credit_line.entry_id = je.id
    WHERE je.transaction_id = v_replacement_id
      AND je.entry_type = 'competencia'
      AND debit_line.chart_account_id = v_counter_account_id
      AND debit_line.debit = v_original.amount
      AND debit_line.credit = 0
      AND credit_line.chart_account_id = v_payables_account_id
      AND credit_line.credit = v_original.amount
      AND credit_line.debit = 0
  ) THEN
    RAISE EXCEPTION 'Competencia do replacement nao corresponde ao mapping atual';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.financial_journal_entries je
    JOIN public.financial_journal_lines debit_line ON debit_line.entry_id = je.id
    JOIN public.financial_journal_lines credit_line ON credit_line.entry_id = je.id
    WHERE je.transaction_id = v_replacement_id
      AND je.entry_type = 'caixa'
      AND debit_line.chart_account_id = v_payables_account_id
      AND debit_line.debit = v_original.amount
      AND debit_line.credit = 0
      AND credit_line.chart_account_id = v_destination_chart_account_id
      AND credit_line.credit = v_original.amount
      AND credit_line.debit = 0
  ) THEN
    RAISE EXCEPTION 'Liquidacao do replacement nao corresponde a Banco Cora';
  END IF;

  RETURN v_replacement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.correct_settled_transaction_to_operational_expense(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.correct_settled_transaction_to_operational_expense(uuid, uuid, text)
  TO authenticated;

DO $$
DECLARE
  v_cora uuid;
  v_rt_category uuid;
  v_material_category uuid;
  v_advance_category uuid;
  v_replacement_id uuid;
  v_expected record;
BEGIN
  SELECT id INTO v_cora
  FROM public.financial_accounts
  WHERE name = 'Cora' AND active = true;

  SELECT c.id INTO v_rt_category
  FROM public.financial_categories c
  JOIN public.financial_chart_accounts ca ON ca.id = c.counter_account_id
  WHERE c.name = 'Prestadores tecnicos SST'
    AND c.active = true AND c.movement_type = 'DESPESA'
    AND ca.code = '4.2.01.001' AND ca.is_cash = false;

  SELECT c.id INTO v_material_category
  FROM public.financial_categories c
  JOIN public.financial_chart_accounts ca ON ca.id = c.counter_account_id
  WHERE c.name = 'Material Escritorio / Limpeza / Copa'
    AND c.active = true AND c.movement_type = 'DESPESA'
    AND ca.code = '5.6.01.001' AND ca.is_cash = false;

  SELECT c.id INTO v_advance_category
  FROM public.financial_categories c
  JOIN public.financial_chart_accounts ca ON ca.id = c.counter_account_id
  WHERE c.name = 'Adiantamento de Pró-labore'
    AND c.active = true AND c.movement_type = 'DESPESA'
    AND ca.code = '1.1.02.006' AND ca.is_cash = false;

  IF v_cora IS NULL OR v_rt_category IS NULL OR v_material_category IS NULL OR v_advance_category IS NULL THEN
    RAISE EXCEPTION 'Precondicoes FIN-FIX-4 ausentes';
  END IF;

  FOR v_expected IN
    SELECT * FROM (VALUES
      ('f4633f24-69cf-45fd-a398-10e59ef88c0e'::uuid, 'Pagamento RT Médico'::text, 1500.00::numeric),
      ('6070253f-0cd7-4a25-984a-15f428d0923a'::uuid, 'Compras de Insumos Informática'::text, 135.00::numeric),
      ('9ec9b924-7556-45e2-919c-352714675eee'::uuid, 'Aquisição de Impressora'::text, 989.00::numeric),
      ('6783c950-fc48-47bf-a00d-842e91c52dab'::uuid, 'Aquisição de Suporte TV'::text, 25.00::numeric),
      ('16b8d7b1-66c1-4019-8d33-f92dc472f4cc'::uuid, 'Aquisição de papel A4'::text, 240.00::numeric),
      ('d8465486-8cd9-4e7b-9fd3-7bd274fdca8f'::uuid, 'Adiantamento de Pró-labore - Lene'::text, 1000.00::numeric)
    ) AS target(id, description, amount)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_transactions t
      WHERE t.id = v_expected.id
        AND t.description = v_expected.description
        AND t.amount = v_expected.amount
        AND t.status = 'settled'
        AND t.movement_type = 'DESPESA'
        AND t.destination_account_id = v_cora
    ) THEN
      IF EXISTS (SELECT 1 FROM public.financial_transactions WHERE idempotency_key = 'FIN-FIX-4::' || v_expected.id::text) THEN
        CONTINUE;
      END IF;
      RAISE EXCEPTION 'Precondicao de alvo FIN-FIX-4 inesperada: %', v_expected.id;
    END IF;

    v_replacement_id := public.correct_settled_transaction_to_operational_expense(
      v_expected.id,
      CASE
        WHEN v_expected.id = 'f4633f24-69cf-45fd-a398-10e59ef88c0e'::uuid THEN v_rt_category
        WHEN v_expected.id = 'd8465486-8cd9-4e7b-9fd3-7bd274fdca8f'::uuid THEN v_advance_category
        ELSE v_material_category
      END,
      'FIN-FIX-4 janeiro/2026: saneamento historico auditado'
    );
    IF v_replacement_id IS NULL THEN
      RAISE EXCEPTION 'Replacement FIN-FIX-4 nao criado: %', v_expected.id;
    END IF;
  END LOOP;

  -- Facts already corrected in the previous gate are validation-only here.
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_transactions t
    JOIN public.financial_categories c ON c.id = t.category_id
    JOIN public.financial_chart_accounts ca ON ca.id = c.counter_account_id
    WHERE t.id = '77375ffb-5b49-41a1-b9db-6b1d15e467bb'::uuid
      AND t.status = 'settled' AND ca.code = '1.1.02.003'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.financial_transactions t
    JOIN public.financial_categories c ON c.id = t.category_id
    JOIN public.financial_chart_accounts ca ON ca.id = c.counter_account_id
    WHERE t.id = 'f17692a2-e1af-402c-ae08-38c422cabe96'::uuid
      AND t.status = 'settled' AND ca.code = '1.1.02.003'
  ) THEN
    RAISE EXCEPTION 'Precondicao de adiantamentos de empregados inesperada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_transactions t
    JOIN public.financial_journal_entries je ON je.transaction_id = t.id
    JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
    JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
    WHERE t.id = '19af3ca4-6571-4cce-bd03-3f8260f6fd6f'::uuid
      AND t.movement_type = 'SALDO_INICIAL' AND t.status = 'settled'
      AND ca.code = '2.3.99.001' AND jl.credit = 4386.45
  ) THEN
    RAISE EXCEPTION 'Saldo inicial corrigido nao esta preservado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_transactions t
    JOIN public.financial_journal_entries je ON je.transaction_id = t.id
    JOIN public.financial_journal_lines jl ON jl.entry_id = je.id
    JOIN public.financial_chart_accounts ca ON ca.id = jl.chart_account_id
    WHERE t.movement_type = 'EMPRESTIMO_PAGO' AND t.amount = 10000
      AND t.competence_date = '2026-01-01' AND t.status = 'settled'
      AND ca.code = '2.1.06.001' AND jl.debit = 10000
  ) THEN
    RAISE EXCEPTION 'Amortizacao de emprestimo nao esta preservada';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.correct_settled_transaction_to_operational_expense(uuid, uuid, text)
  IS 'FIN-FIX-4: atomically reverses an audited settled expense and creates an append-only replacement using the current category mapping.';
