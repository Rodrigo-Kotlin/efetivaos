# FIN-IMPORT-5.3A — Auditoria do executor atômico Abril/2026

## Status

**COMPLETED_WITH_FINDINGS** — infraestrutura criada e aplicada somente em DEV. O manifesto
real de Abril não foi executado.

## Ambiente

- Target: `DEV`
- Supabase project: `bxviuzluxcijbqqbpyzb`
- PROD touched: **NO**
- Manifest SHA-256 autorizado:
  `6605a548fdb031d83e95e84945cb5853bbd816485eab17ed2b7bdc42749af662`

## Arquitetura auditada

- Fevereiro: `public.execute_authoritative_financial_import`, migration
  `20261016145204_add_authoritative_financial_import_rpc.sql`.
- Março: `public.execute_authoritative_financial_import_march_2026`, migration
  `20261017120000_add_authoritative_march_2026_import_rpc.sql`.
- Padrão reutilizado: RPC mensal restrita, `SECURITY DEFINER`, `search_path`
  explícito, hash/batch fixos, validação completa antes do primeiro insert,
  escrita direta atomizada em batch + transaction + journal + import row,
  `settled` e grants restritos.
- Generic refactor: **NO**.

## Executor

- Function: `public.execute_authoritative_financial_import_april_2026(text,text,text)`
- Migration:
  `supabase/migrations/20261021150000_add_april_2026_authoritative_import_executor.sql`
- Target period: `2026-04`
- Batch key: `APRIL_2026_AUTHORITATIVE`
- Expected facts: 92 (35 inflows, 57 outflows)
- Atomic execution: **YES** — one PostgreSQL function transaction; exceptions
  abort the function transaction and no cleanup is required.
- Idempotency: **YES** — transaction/import-row/journal keys, batch lock and
  advisory transaction lock.
- Partial import detection: **YES** — raises `PARTIAL_IMPORT_DETECTED`.
- Complete rerun: returns `ALREADY_IMPORTED` only after 92 transactions, 92
  import rows and 92 journals are confirmed.
- Closed-month protection: **YES** — every supplied date must be in April;
  January–March cannot be written by this executor, and period locks are
  checked before persistence.
- Source traceability: source row, raw/mapped JSON, idempotency key, journal
  key, batch, manifest hash and disclosure are retained.

## Validation and accounting safeguards

Before any insert, the function validates:

- exact manifest hash, schema, source file/sheet and period;
- 92 rows, 92 distinct source rows and 92 distinct idempotency keys;
- manifest validation counters and approved totals;
- inflows R$ 56.185,87, outflows R$ 62.733,49, net -R$ 6.547,62;
- opening R$ 18.187,58 and closing R$ 11.639,96;
- active chart accounts and Banco Cora account;
- date, movement, DRE, DFC, AR/AP and account-side coherence;
- two balanced journal lines per row;
- approved special mappings (Valdilene, Janderson/Endrew, Bombeiro Civil,
  EPI, Cartão Caixa, Rodrigo partial payment and legacy disclosures).

After persistence it validates 92 journals, zero journal imbalances and 92
imported source rows before marking the batch `completed`.

## Security

- `SECURITY DEFINER`: **YES**
- Hardened search path: `pg_catalog, public, extensions`
- Caller: authenticated Admin required
- Anonymous execute: **NO**
- Public execute: **NO**
- Authenticated execute: **YES**
- RLS changed: **NO**
- Default privileges changed: **NO**
- Dynamic SQL: **NO**

## Tests

File: `supabase/tests/fin_import_april_2026_executor.sql`

Remote DEV execution result: **PASS** (`FIN-IMPORT-5.3A executor tests passed`).

Covered assertions:

- function signature, security and grants;
- fixed hash, batch, period, 92-row and totals contracts;
- pre-write validation ordering;
- duplicate/partial/already-imported branches;
- journal-balance validation;
- closed-month/date protection;
- approved special-row guardrails;
- isolated forced-error fixture rollback for transaction, journal and journal
  line persistence;
- read-only proof that no real April authoritative data existed.

The test never loads or calls the real April manifest. Local Supabase execution
was unavailable because Docker was not running; the migration and test were
validated directly against the linked DEV database. The migration DDL was
applied through the linked SQL channel and its migration history was repaired
to `applied` for version `20261021150000`; no other pending migration was
applied.

## DEV post-migration check

- Executor exists: **YES**
- `SECURITY DEFINER`: **YES**
- April authoritative transactions: **0**
- April authoritative journals: **0**
- April authoritative import rows: **0**
- April authoritative batches: **0**
- Real April manifest executed: **NO**
- January changed: **NO**
- February changed: **NO**
- March changed: **NO**

## Safety

- Financial data writes: **0**
- Journal writes: **0**
- Import batch writes from executor: **0**
- Destructive updates: **0**
- Deletes: **0**
- Frontend/Financeiro 360 changes: **0**
- PROD: **NO**
- Commit: **NO**
- Push: **NO**

## Readiness

- `ATOMIC_EXECUTION_GAP_RESOLVED`: **YES**
- `EXECUTOR_TESTED`: **YES**
- `EXECUTOR_DEPLOYED_DEV`: **YES**
- `APRIL_REAL_DATA_IMPORTED`: **NO**
- `READY_FOR_FIN_IMPORT_5_3B_EXECUTION`: **YES**

This gate stops here. Do not execute April, touch PROD, start closing, or start
May without the separately authorized next gate.
