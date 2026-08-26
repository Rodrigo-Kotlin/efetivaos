# Handoff Sprint 08A — Fundação Contábil-Gerencial

## Status Final

`ETAPA 08A — COMPLETED`

---

## 1. Objetivo

Implementar a fundação contábil-gerencial do módulo Financeiro 360, portando as regras canônicas do app local `Efetiva Financeiro 360 v2.0.0` para a arquitetura Supabase/React/TypeScript do Efetiva OS.

Escopo:
- Plano de Contas (6 classes, ~80 contas semente)
- Centros de Custo (8 centros semente)
- Linhas de Serviço (7 linhas semente)
- Categorias Financeiras (30+ categorias com mapeamento contábil)
- Contas Financeiras (caixa/banco)
- Formas de Pagamento (8 meios semente)
- UI completa: launcher + 6 páginas CRUD com drawer, busca e filtros

---

## 2. Schema

### Enums (6)

- `financial_account_class`: ATIVO, PASSIVO, PL, RECEITA, CUSTO, DESPESA
- `financial_nature`: DEBITO, CREDITO
- `financial_current_class`: CIRCULANTE, NAO_CIRCULANTE
- `financial_dfc_class`: OPERACIONAL, INVESTIMENTO, FINANCIAMENTO, NAO_CAIXA, TRANSFERENCIA
- `financial_movement_type`: RECEITA, DESPESA, TRANSFERENCIA, EMPRESTIMO_RECEBIDO, EMPRESTIMO_PAGO, APORTE, RETIRADA, IMOBILIZADO, SALDO_INICIAL, AJUSTE
- `financial_account_type`: CAIXA, CONTA_CORRENTE, POUPANCA, CARTAO, INVESTIMENTO, OUTRO

### Tabelas (8)

#### `financial_chart_accounts`
~80 registros semente. Campos: code, name, class, nature, posting, active, current_class, bp_group, dre_class, dfc_default, dva_class, is_cash, presentation_sign.

#### `financial_cost_centers`
8 registros semente. Campos: code, name, active, description.

#### `financial_service_lines`
7 registros semente. Campos: name, active, description.

#### `financial_categories`
~30 registros semente com mapeamento: name, movement_type, counter_account_id (FK→chart_accounts), cost_center_id (FK→cost_centers), service_line_id (FK→service_lines), cash_flow_class, active.

#### `financial_accounts`
Caixa/banco. Campos: name, chart_account_id (FK→chart_accounts), institution, account_type, active, opening_date, notes.

#### `financial_payment_methods`
8 registros semente. Campos: name, active.

#### `financial_parties`
Pessoas/entidades. Campos: name, party_type, document, email, phone, client_id (FK→clients), supplier_id (FK→suppliers), active, notes.

#### `financial_period_locks`
Bloqueios de período. Campos: period_start, period_end, locked_at, locked_by, reason.

### Índices

- `idx_financial_chart_accounts_code` — code
- `idx_financial_chart_accounts_class` — class WHERE active = true
- `idx_financial_chart_accounts_cash` — is_cash WHERE active = true
- `idx_financial_cost_centers_code` — code WHERE code IS NOT NULL
- `idx_financial_categories_movement` — movement_type
- `idx_financial_accounts_chart` — chart_account_id WHERE active = true
- `idx_financial_parties_document` — document WHERE document IS NOT NULL
- `idx_financial_parties_client` — client_id WHERE client_id IS NOT NULL
- `idx_financial_parties_supplier` — supplier_id WHERE supplier_id IS NOT NULL
- `idx_financial_period_locks_period` — period_start, period_end

### Views (3)

- `financial_chart_accounts_list_v` — security_invoker, select *
- `financial_categories_list_v` — join com chart_accounts, cost_centers, service_lines
- `financial_accounts_list_v` — join com chart_accounts

### Triggers

- `set_audit_fields()` — pre-existing, reutilizado
- `set_financial_chart_accounts_audit` — BEFORE INSERT/UPDATE
- `set_financial_cost_centers_audit` — BEFORE INSERT/UPDATE
- `set_financial_service_lines_audit` — BEFORE INSERT/UPDATE
- `set_financial_categories_audit` — BEFORE INSERT/UPDATE
- `set_financial_accounts_audit` — BEFORE INSERT/UPDATE
- `set_financial_payment_methods_audit` — BEFORE INSERT/UPDATE
- `set_financial_parties_audit` — BEFORE INSERT/UPDATE
- `set_financial_period_locks_created` — BEFORE INSERT (locked_at)
- `normalize_financial_chart_accounts_code` — BEFORE INSERT/UPDATE (trim, uppercase)
- `normalize_financial_cost_centers_code` — BEFORE INSERT/UPDATE
- `validate_financial_period_lock_no_overlap` — BEFORE INSERT/UPDATE (application-level overlap prevention deferred)
- `validate_financial_categories_fk` — BEFORE INSERT/UPDATE
- `validate_financial_accounts_fk` — BEFORE INSERT/UPDATE

---

## 3. RLS

| Recurso | Admin | Equipe | Anônimo |
|---------|-------|--------|---------|
| financial_chart_accounts | CRUD | RU | ❌ |
| financial_cost_centers | CRUD | RU | ❌ |
| financial_service_lines | CRUD | RU | ❌ |
| financial_categories | CRUD | RU | ❌ |
| financial_accounts | CRUD | RU | ❌ |
| financial_payment_methods | CRUD | RU | ❌ |
| financial_parties | CRUD | RU | ❌ |
| financial_period_locks | CRUD | ❌ | ❌ |
| *_list_v | RU | RU | ❌ |

- CRUD = SELECT, INSERT, UPDATE
- RU = SELECT, UPDATE (no DELETE grants)
- DELETE revogado de todos (hard delete bloqueado)
- Admin pode criar/editar; Equipe pode apenas visualizar e atualizar

---

## 4. Frontend

### Rotas

| Path | Componente | Lazy |
|------|-----------|------|
| `/finance` | FinancePage | ✅ |
| `/finance/chart-accounts` | ChartAccountsPage | ✅ |
| `/finance/cost-centers` | CostCentersPage | ✅ |
| `/finance/service-lines` | ServiceLinesPage | ✅ |
| `/finance/categories` | CategoriesPage | ✅ |
| `/finance/accounts` | AccountsPage | ✅ |

### Sidebar

6 itens adicionados: Financeiro (launcher), Plano de Contas, Centros de Custo, Linhas de Serviço, Categorias, Contas.

### Home Page

Card "Financeiro" ativado com link e status "ETAPA 08A".

### Features

- `src/features/finance/types/finance-types.ts` — re-export de tipos de `database.ts`
- `src/features/finance/schemas/finance-schemas.ts` — 6 schemas Zod
- `src/features/finance/api/finance-api.ts` — CRUD para 6 entidades
- `src/features/finance/queries/finance-queries.ts` — TanStack Query hooks + mutations
- `src/features/finance/pages/*.tsx` — 6 páginas com tabela, drawer, busca

---

## 5. Testes

### Build

- `npm run build` → ✅ OK
- TypeScript: 0 erros
- Vite build: 9.49s

### Lint

- `npm run lint` → ✅ 0 erros (1 warning pre-existente: React Hook Form incompatible-library)

### SQL Tests (remote, transactional ROLLBACK)

- `supabase db query --linked --file 08a_microgate_tests.sql` → ✅ **50/50 PASS**
- Seed counts: chart_accounts=98, cost_centers=8, service_lines=7, categories=42, payment_methods=8
- Class distribution: ATIVO=22, PASSIVO=20, PL=7, RECEITA=11, CUSTO=12, DESPESA=26
- Category distribution: RECEITA=6, DESPESA=32, IMOBILIZADO=4
- RLS: 24 policies (8 tables × 3 ops), period_locks uses is_admin() for INSERT/UPDATE
- Grants: authenticated SELECT/INSERT/UPDATE only, no anon/public grants
- Triggers: 8 audit + 2 normalize + 1 protect + 1 validate_cash
- Views: 3 views with security_invoker=true
- Unique constraints: all active names unique
- Referential integrity: all FKs valid
- No journal_entries/financial_transactions tables

### DB Lint

- `supabase db lint --linked --schema public --level warning` → ✅ 0 new warnings
- Pre-existing: `is_valid_brazilian_tax_id` shadowed variable warnings

### Frontend Tests

- `npm test` → ✅ **147/147 PASS** (21 test files)
- Finance-specific: **48/48 PASS** (schemas + API tests)

### TanStack Table Audit

- N/A — finance pages use plain HTML tables, not useReactTable
- No memoization violations possible

### Cloudflare Deploy

- SHA 77a3239 → https://efetivaos.pages.dev ✅
- Production smoke: /finance, /finance/chart-accounts, /finance/cost-centers all serve SPA shell

### Cleanup

- financial_accounts: 0 rows (no seed)
- financial_parties: 0 rows (no seed)
- financial_period_locks: 0 rows (no seed)
- No test fixtures persisted

---

## 6. Decisões

- **Tipos em database.ts**: finance types definidos inline em `database.ts` e re-exportados via `finance-types.ts`. Abordagem escolhida para evitar circular import que quebrava inferência do Supabase client.
- **presentation_sign como number**: DB usa `int4` (number), app usa `1 | -1`. Cast explícito no `fetchChartAccounts`.
- **Period locks sem overlap constraint**: `btree_gist` removido por segurança. Prevenção de sobreposição delegada à lógica de aplicação (ETAPA 08B).
- **Navegação Financeiro**: 6 itens na sidebar (launcher + 5 sub-menus), seguindo padrão CRM.

---

## 7. Findings

| # | Severidade | Finding |
|---|-----------|---------|
| F-01 | LOW | Warning: chunk principal > 500 kB (conhecido, não bloqueante) |
| F-02 | LOW | TanStack Table incompatible-library warning (pre-existente) |
| F-03 | LOW | Supabase types regenerados substituem tipos manuais — necessário manter ambos |
| F-04 | INFO | Database.ts import de módulos externos quebra inferência TS — manter tipos inline |

---

## 8. Arquivos Principais Alterados

### Novos

- `supabase/migrations/20260826000100_create_finance_foundation_schema.sql`
- `supabase/migrations/20260826000100_08a_microgate_tests.sql`
- `src/features/finance/types/finance-types.ts`
- `src/features/finance/schemas/finance-schemas.ts`
- `src/features/finance/api/finance-api.ts`
- `src/features/finance/queries/finance-queries.ts`
- `src/features/finance/pages/finance-page.tsx`
- `src/features/finance/pages/chart-accounts-page.tsx`
- `src/features/finance/pages/cost-centers-page.tsx`
- `src/features/finance/pages/service-lines-page.tsx`
- `src/features/finance/pages/categories-page.tsx`
- `src/features/finance/pages/accounts-page.tsx`
- `src/features/finance/finance-schemas.test.ts`
- `src/features/finance/finance-api.test.ts`

### Modificados

- `src/types/database.ts` — adicionados finance types, tables, views, enums
- `src/app/router.tsx` — rotas finance lazy-loaded
- `src/app/app-shell.tsx` — sidebar nav items
- `src/routes/home-page.tsx` — card Financeiro ativado

---

## 9. Próximo Passo Recomendado

**ETAPA 08B — Motor de Partidas Dobradas**: Implementar o lançamento contábil com débito/crédito, validação de saldos, conciliação e integração com o plano de contas estabelecido na 08A.

(Não iniciado — aguardando aprovação)
