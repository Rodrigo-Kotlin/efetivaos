# FIN-IMPORT-3C — February 2026 Import Acceptance

## Status

COMPLETED_WITH_FINDINGS

The persisted DEV batch is accepted as the authoritative February 2026 import
candidate. No new import, reversal, cancellation, correction, or cleanup was
executed in this gate.

## Batch

- Key: `FIN-IMPORT-3::2026-02::79aeef88bf7c1561c230d1aa9bdcda383ee8b351be6a8bf1fe795d682ea280e9`
- Manifest hash: `79aeef88bf7c1561c230d1aa9bdcda383ee8b351be6a8bf1fe795d682ea280e9`
- Rows: 79
- Transactions: 79
- Journal entries: 79
- Journal lines: 158
- Row-level matches: 79/79
- Unbalanced journals: 0

## Accounting Interpretation

`dre_effect = RECEITA` means a positive effect recognized in the income
statement. It does not require the detailed report to classify the amount as
`RECEITA_BRUTA`.

Row 38, `Negociacao Recupera Almeida`, remains unchanged at `3.4.01.001 -
Outras Receitas e Ganhos`. The official February report therefore presents:

- Receita Bruta: `R$ 16.501,06`
- Outros Resultados: `R$ 2.636,62`
- Total positive income effect: `R$ 19.137,68`
- Result: `-R$ 13.270,58`

No accounting correction is required.

## Reconciliation

- Banco Cora: `R$ 2.070,12`
- DFC operating: `-R$ 18.120,58`
- DFC investing: `-R$ 2.122,54`
- DFC financing: `R$ 20.000,00`
- Criffer liability: `R$ 0,00`
- Criffer historical asset: `R$ 566,84`
- Employee advances: `R$ 2.850,00`
- Partner/admin advances: `R$ 2.000,00`
- Fixed-asset ledger additions: `R$ 1.555,70`
- Loan increase: `R$ 20.000,00`
- BP difference: `R$ 0,00`
- January preserved: yes

## Incident Classification

- Type: `UNINTENDED_TEST_COMMIT_WITH_CORRECT_AUTHORITATIVE_DATA`
- Data corruption: no
- Row-level corruption: no
- Accounting correction required: no
- Rollback required: no
- Candidate for acceptance as final import: yes

DEV was the only environment accessed. PROD was not accessed.
