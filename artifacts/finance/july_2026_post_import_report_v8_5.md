# FIN-IMPORT-8.5 — Importação abortada antes da escrita

## Status

`FIN-IMPORT-8.5 = FAIL`  
`READY_FOR_FIN_IMPORT_8_6 = NO`  
`READY_FOR_IMPORT = NO`

A execução foi interrompida antes de qualquer INSERT. PROD não foi acessado.

## Precheck

- Project ref DEV: `bxviuzluxcijbqqbpyzb`
- Julho transactions: **0**
- Julho journals: **0**
- Julho batches: **0**
- Julho locks: **0**
- Manifest hash recalculado: `1cb56b8942a54bde2a6c17aa35a569bcf876d09bc6c7e1b4abc474d975013862`
- Hash esperado: `1cb56b8942a54bde2a6c17aa35a569bcf876d09bc6c7e1b4abc474d975013862`
- Hash: **PASS**
- `IMPORT_PRECHECK = FAIL`
- `IDEMPOTENCY_PRECHECK = PASS`

## Bloqueio

O schema exige `financial_transactions.transaction_date NOT NULL`, mas o manifesto contém fatos sem data:

- FLX-2026-0659 — Entrada NU — linha 184
- FLX-2026-0660 — Empréstimo (S) — linha 185
- FLX-2026-0661 — Empréstimo (E) — linha 186

O manifesto não contém política técnica aprovada para atribuir datas a esses fatos. Não foi usado 31/07/2026 nem qualquer outra data inventada.

## Escrita

- Batch criado: **NO**
- Fatos escritos: **0**
- Journals escritos: **0**
- Lines escritas: **0**
- Rollback necessário: **NO**, pois a transação de importação não foi iniciada.

## Ação recomendada

Fornecer as três datas reais ou aprovar explicitamente uma política de data técnica, regenerar o manifesto e o SHA-256, e então repetir o FIN-IMPORT-8.5. Não reconstruir o manifesto silenciosamente.
