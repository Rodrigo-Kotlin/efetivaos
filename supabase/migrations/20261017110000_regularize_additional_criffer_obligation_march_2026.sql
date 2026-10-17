-- FIN-FIX-6 — additional historical Criffer obligation for March 2026.
-- Non-cash, append-only regularization. It does not import March transactions
-- and does not create a financial asset record.

BEGIN;

DO $migration$
DECLARE
  v_asset_account_id uuid;
  v_liability_account_id uuid;
  v_transaction_id uuid;
  v_entry_id uuid;
  v_existing_entry_id uuid;
  v_correction_id constant text := 'FIN-FIX-6::CRIFFER::2026-03::SOURCE-ROWS-118-119::282.51-274.64';
  v_amount constant numeric(15,2) := 557.15;
  v_metadata text := $metadata$source=FLUXO_CAIXA_2026.xlsx
source_sheet=MARÇO
source_rows=118,119
supplier=Criffer
reason=Reconhecimento adicional da obrigação histórica Criffer referente às parcelas pagas em março/2026, sem documentação suficiente para reclassificação definitiva do ativo.
documentation_status=incomplete
original_purchase_date=unknown
original_asset_value=unknown
installment_count=unknown
reconstructed_amount=557.15
asset_identification=UNKNOWN_DOCUMENTED_ASSET
regularization_date=2026-03-01$metadata$;
BEGIN
  SELECT id
  INTO v_asset_account_id
  FROM public.financial_chart_accounts
  WHERE code = '1.2.99.001'
    AND name = 'Ativo Historico a Identificar'
    AND class = 'ATIVO'
    AND nature = 'DEBITO'
    AND posting = true
    AND active = true
    AND is_cash = false
    AND dfc_default = 'NAO_CAIXA';

  IF v_asset_account_id IS NULL THEN
    RAISE EXCEPTION 'Conta 1.2.99.001 não está disponível com a configuração esperada';
  END IF;

  SELECT id
  INTO v_liability_account_id
  FROM public.financial_chart_accounts
  WHERE code = '2.1.09.001'
    AND name = 'Outras Obrigacoes a Pagar'
    AND class = 'PASSIVO'
    AND nature = 'CREDITO'
    AND active = true;

  IF v_liability_account_id IS NULL THEN
    RAISE EXCEPTION 'Conta 2.1.09.001 não está disponível com a configuração esperada';
  END IF;

  SELECT id
  INTO v_existing_entry_id
  FROM public.financial_journal_entries
  WHERE idempotency_key = v_correction_id;

  IF v_existing_entry_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.financial_transactions
      WHERE idempotency_key = v_correction_id
    ) THEN
      RAISE EXCEPTION 'FIN-FIX-6 transaction existe sem journal correspondente';
    END IF;

    INSERT INTO public.financial_transactions (
      description,
      transaction_date,
      competence_date,
      movement_type,
      amount,
      status,
      notes,
      review_required,
      idempotency_key
    ) VALUES (
      'FIN-FIX-6 - Regularizacao adicional historica Criffer',
      date '2026-03-01',
      date '2026-03-01',
      'AJUSTE',
      v_amount,
      'settled',
      v_metadata,
      true,
      v_correction_id
    )
    RETURNING id INTO v_transaction_id;

    INSERT INTO public.financial_journal_entries (
      transaction_id,
      entry_type,
      entry_date,
      competence_date,
      description,
      status,
      review_required,
      idempotency_key
    ) VALUES (
      v_transaction_id,
      'ajuste',
      date '2026-03-01',
      date '2026-03-01',
      'FIN-FIX-6 - Regularizacao adicional historica Criffer',
      'settled',
      true,
      v_correction_id
    )
    RETURNING id INTO v_entry_id;

    INSERT INTO public.financial_journal_lines (
      entry_id, chart_account_id, debit, credit, description
    ) VALUES
      (
        v_entry_id,
        v_asset_account_id,
        v_amount,
        0,
        'Reconhecimento adicional de ativo histórico Criffer ainda não identificado'
      ),
      (
        v_entry_id,
        v_liability_account_id,
        0,
        v_amount,
        'Obrigação histórica Criffer referente às parcelas de março/2026'
      );

    INSERT INTO public.financial_notes (
      note_type,
      title,
      body,
      reference_date,
      chart_account_id,
      transaction_id,
      journal_entry_id,
      report_type
    ) VALUES (
      'AJUSTE',
      'FIN-FIX-6 - Obrigacao historica adicional Criffer',
      v_metadata || E'\ncorrection_id=' || v_correction_id,
      date '2026-03-01',
      v_asset_account_id,
      v_transaction_id,
      v_entry_id,
      'AJUSTE'
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.financial_journal_entries
      WHERE id = v_existing_entry_id
        AND transaction_id = (
          SELECT id
          FROM public.financial_transactions
          WHERE idempotency_key = v_correction_id
        )
        AND entry_type = 'ajuste'
        AND entry_date = date '2026-03-01'
        AND competence_date = date '2026-03-01'
        AND status = 'settled'
        AND review_required = true
    )
    OR (SELECT count(*) FROM public.financial_journal_lines WHERE entry_id = v_existing_entry_id) <> 2
    OR NOT EXISTS (
      SELECT 1
      FROM public.financial_journal_lines
      WHERE entry_id = v_existing_entry_id
        AND chart_account_id = v_asset_account_id
        AND debit = v_amount
        AND credit = 0
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.financial_journal_lines
      WHERE entry_id = v_existing_entry_id
        AND chart_account_id = v_liability_account_id
        AND debit = 0
        AND credit = v_amount
    ) THEN
      RAISE EXCEPTION 'FIN-FIX-6 já existe, mas está inconsistente';
    END IF;
  END IF;
END;
$migration$;

COMMIT;
