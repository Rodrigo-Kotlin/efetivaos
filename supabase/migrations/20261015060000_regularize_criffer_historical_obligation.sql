-- FIN-FIX-5.1 — minimum historical Criffer obligation regularization.
-- This records only the documented February installments total and does not
-- create an asset record or any February cash movement.

BEGIN;

DO $migration$
DECLARE
  v_asset_account_id uuid;
  v_liability_account_id uuid;
  v_transaction_id uuid;
  v_entry_id uuid;
  v_existing_entry_id uuid;
  v_correction_id text := 'FIN-FIX-5::CRIFFER::2026-02::SOURCE-ROWS-101-102::282.18-284.66';
  v_metadata text := $metadata$source=FLUXO_CAIXA_2026.xlsx
source_sheet=FEVEREIRO
source_rows=101,102
supplier=Criffer
reason=historical obligation reconstructed from confirmed installment payments
documentation_status=incomplete
original_purchase_date=unknown
original_asset_value=unknown
installment_count=unknown
reconstructed_amount=566.84
asset_identification=UNKNOWN_DOCUMENTED_ASSET
regularization_date=2026-02-01$metadata$;
BEGIN
  SELECT id
  INTO v_asset_account_id
  FROM public.financial_chart_accounts
  WHERE code = '1.2.99.001';

  IF v_asset_account_id IS NULL THEN
    INSERT INTO public.financial_chart_accounts (
      code, name, class, nature, posting, active, current_class, bp_group,
      dre_class, dfc_default, dva_class, is_cash, presentation_sign
    ) VALUES (
      '1.2.99.001',
      'Ativo Historico a Identificar',
      'ATIVO',
      'DEBITO',
      true,
      true,
      'NAO_CIRCULANTE',
      'Imobilizado a Identificar',
      '',
      'NAO_CAIXA',
      '',
      false,
      1
    )
    RETURNING id INTO v_asset_account_id;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.financial_chart_accounts
      WHERE id = v_asset_account_id
        AND name = 'Ativo Historico a Identificar'
        AND class = 'ATIVO'
        AND nature = 'DEBITO'
        AND posting = true
        AND active = true
        AND is_cash = false
        AND dfc_default = 'NAO_CAIXA'
    ) THEN
      RAISE EXCEPTION 'Conta 1.2.99.001 existe com configuração incompatível';
    END IF;
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
    RAISE EXCEPTION 'Conta passiva 2.1.09.001 não está disponível';
  END IF;

  SELECT id
  INTO v_existing_entry_id
  FROM public.financial_journal_entries
  WHERE idempotency_key = v_correction_id;

  IF v_existing_entry_id IS NULL THEN
    INSERT INTO public.financial_transactions (
      description,
      transaction_date,
      competence_date,
      movement_type,
      amount,
      status,
      notes,
      review_required
    ) VALUES (
      'FIN-FIX-5.1 - Regularizacao historica Criffer',
      date '2026-02-01',
      date '2026-02-01',
      'AJUSTE',
      566.84,
      'settled',
      v_metadata,
      true
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
      date '2026-02-01',
      date '2026-02-01',
      'FIN-FIX-5.1 - Regularizacao historica Criffer',
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
        566.84,
        0,
        'Regularizacao documental de ativo historico Criffer; identificacao original desconhecida'
      ),
      (
        v_entry_id,
        v_liability_account_id,
        0,
        566.84,
        'Obrigacao historica Criffer reconstruida somente pelas parcelas comprovadas'
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
      'FIN-FIX-5.1 - Conta transitória de ativo histórico',
      'Conta transitória destinada exclusivamente à regularização documental de ativos históricos ainda não identificados de forma suficiente para classificação definitiva.'
        || E'\n\n' || v_metadata
        || E'\ncorrection_id=' || v_correction_id,
      date '2026-02-01',
      v_asset_account_id,
      v_transaction_id,
      v_entry_id,
      'AJUSTE'
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.financial_journal_lines
      WHERE entry_id = v_existing_entry_id
        AND chart_account_id = v_asset_account_id
        AND debit = 566.84
        AND credit = 0
    ) OR NOT EXISTS (
      SELECT 1
      FROM public.financial_journal_lines
      WHERE entry_id = v_existing_entry_id
        AND chart_account_id = v_liability_account_id
        AND debit = 0
        AND credit = 566.84
    ) THEN
      RAISE EXCEPTION 'FIN-FIX-5.1 já existe, mas está inconsistente';
    END IF;
  END IF;
END;
$migration$;

COMMIT;
