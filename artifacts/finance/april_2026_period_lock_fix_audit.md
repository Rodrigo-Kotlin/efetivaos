# FIN-IMPORT-5.5 — Correção do period lock e fechamento de Abril/2026

## Status

**COMPLETED_WITH_FINDINGS** — correção aplicada no DEV, lock real persistido e
enforcement comprovado. PROD não foi tocado.

## Root cause

Tabela: `public.financial_period_locks`.

- Colunas: `id uuid`, `period_start date`, `period_end date`,
  `locked_at timestamptz`, `locked_by uuid`, `reason text`, `created_at timestamptz`.
- Primary key: `financial_period_locks_pkey` (`id`).
- `locked_by`: FK para `auth.users(id)`, representa o `auth.uid()` do operador.
- Trigger: `trg_financial_period_locks_audit`.
- Trigger function: `public.set_audit_fields()`.
- Root cause: **CONFIRMED**. A função compartilhada atribuía `NEW.created_by`,
  `NEW.updated_at` e `NEW.updated_by`, mas period locks não possuem essas colunas.

O problema era específico do branch de `financial_period_locks`; as referências
`created_by` em outras tabelas são legítimas e não foram alteradas.

## Migration

`supabase/migrations/20261021190000_fix_financial_period_locks_locked_by.sql`

A função agora trata exclusivamente esse nome de tabela com `created_at`,
`locked_at` e `locked_by`, preenchendo `locked_by` com `auth.uid()` quando
necessário. Para todas as outras tabelas, o comportamento anterior foi
preservado.

- Historical migrations edited: **NO**
- Signature changed: **NO**
- Security/search path preserved: **YES** (`search_path = ''`)
- RLS changed: **NO**
- Grants changed: **NO**
- Financial data changed: **NO**

## Tests

`supabase/tests/fin_import_april_2026_period_lock.sql`: **PASS**

- Valid fixture insert: PASS
- `locked_by`/timestamps: PASS
- Invalid unguarded `NEW.created_by`: PASS (0)
- Locked-period enforcement: PASS
- Open-period behavior: PASS
- Fixture rollback: YES

Additional DEV tests:

- Hash contract: PASS
- DRE totals/presentation: PASS
- Executor contract/security: PASS
- DFC: 70/70 PASS
- BP: PASS
- `git diff --check`: PASS

Legacy findings from 5.4 remain classified as **TEST_STALE / OUT_OF_SCOPE**:
`08e` test 009, `08m` tests 8 and 15, and `08l` test 14. They were not modified.

## April pre-lock and lock

- Batch: `e9a91c8c-c4dd-4f90-8486-72aa0b96c638`
- Import: COMPLETE
- Rows: 92/92
- Journals: 92 balanced
- Cash closing: R$ 11.639,96
- DRE: -R$ 2.197,62
- DFC: -R$ 6.547,62
- BP movement: balanced
- AR/AP: validated
- Existing April locks before: 0
- Lock inserted: **YES**
- Lock ID: `1c7a5ea8-db31-47db-9a41-c1070205ef00`
- Period: `2026-04-01` through `2026-04-30`
- `locked_by`: `51000000-0000-0000-0000-000000000001`
- Lock count after: 1
- Duplicate locks: 0
- `APRIL_LOCK_ENFORCED`: **YES**

## Data safety

- April financial data changed: **NO**
- Additional transactions: 0
- Additional journals: 0
- Period-lock writes: 1
- Manifest reexecuted: **NO**
- January changed: **NO**
- February changed: **NO**
- March changed: **NO**
- PROD: **NO**
- May started: **NO**

## Readiness

- `APRIL_RECONCILED`: YES
- `APRIL_DATABASE_LOCKED`: YES
- `APRIL_FORMALLY_CLOSED`: YES
- `APRIL_VERSIONED`: pending commit/push
- `READY_TO_START_MAY`: NO automatic start
- `READY_FOR_PROD`: NO
