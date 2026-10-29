# DFC audit — FIN-IMPORT-8.5R2

Read-only DEV audit. No import, batch, ledger, auth, grant, RLS, or schema changes were executed.

## Finding

`CLASSIFICATION_PENDING_SUPPORTED_BY_OFFICIAL_DFC = NO`

The official enum contains OPERACIONAL, INVESTIMENTO, FINANCIAMENTO, NAO_CAIXA, and TRANSFERENCIA. The official realized-cash view has no CLASSIFICATION_PENDING branch. After movement-type special cases and category lookup, a null category classification falls back explicitly to OPERACIONAL. The four migration-audit facts have category_id NULL, so their signed net R$ 8.236,53 is absorbed into OPERACIONAL.

`CLASSIFICATION_PENDING = MIGRATION_AUDIT_BUCKET`

Pending facts: FLX-2026-0621 (-173,34), FLX-2026-0652 (-490,13), FLX-2026-0653 (-3.100,00), and FLX-2026-0659 (+12.000,00), net R$ 8.236,53. Their provisional metadata remains persisted and no facts were changed.

## Official DFC

- OPERACIONAL: R$ 7.389,28
- INVESTIMENTO: R$ 0,00
- FINANCIAMENTO: R$ -752,65
- Total: R$ 6.636,63
- Difference to cash variation: R$ 0,00

Decision: `DFC_PRESENTATION_DECISION = ACCEPT_OFFICIAL_DFC_WITH_AUXILIARY_PENDING_DISCLOSURE` (SCENARIO_B).
