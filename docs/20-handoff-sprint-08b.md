# Handoff Sprint 08B — Motor de Lancamentos e Partidas Dobradas

## Status Final

`ETAPA 08B — COMPLETED`

---

## 1. Objetivo

Implementar o motor de lancamentos contabeis e partidas dobradas do modulo Financeiro 360, criando a camada transacional que alimenta todos os futuros demonstrativos (DRE, BP, DFC, etc).

---

## 2. Schema

### Novo Enum

- `financial_transaction_status`: pending, settled, cancelled

### Novas Tabelas (3)

#### `financial_transactions`
Campos: description, transaction_date, competence_date, movement_type, amount, status, category_id (FK), origin_account_id (FK), destination_account_id (FK), party_id (FK), cost_center_id (FK), service_line_id (FK), payment_method_id (FK), due_date, payment_date, notes, review_required, version.

#### `financial_journal_entries`
Campos: transaction_id (FK), entry_type, entry_date, competence_date, description, status, review_required.

#### `financial_journal_lines`
Campos: entry_id (FK), chart_account_id (FK), debit, credit, description.

### Novas Views (3)

- `financial_transactions_list_v` — join com accounts, categories, parties, cost_centers, service_lines, payment_methods; inclui journal_entry_count, total_debit, total_credit
- `financial_journal_entries_list_v` — join com transactions; inclui total_debit, total_credit
- `financial_journal_lines_list_v` — join com chart_accounts; inclui code, name, class

### Novas RPCs (4)

1. `create_financial_transaction(...)` — atomico, retorna UUID
2. `settle_financial_transaction(p_transaction_id, p_payment_date, p_payment_method_id)` — substitui entries com status settled
3. `cancel_financial_transaction(p_transaction_id, p_reason)` — substitui entries com estorno, status cancelled
4. `update_financial_transaction(...)` — upsert com version/CAS

### Funcoes Helper

- `get_chart_account_id_by_code(code)` — busca chart_account por codigo
- `assert_period_unlocked(date)` — valida periodo nao bloqueado
- `validate_transaction_references(...)` — FKs existem e estao ativos
- `validate_transaction_by_movement_type(...)` — campos obrigatorios por tipo
- `generate_journal_entries(...)` — motor de lancamentos (10 tipos)
- `_insert_journal_pair(...)` — insere par com suporte a reversal
- `_insert_journal_triple(...)` — insere triplo (EMPRESTIMO_PAGO)
- `validate_journal_entry_balance(...)` — AFTER trigger, SUM(debit)=SUM(credit)
- `validate_category_movement_type(...)` — AFTER trigger, categoria compativeis

### Triggers Novos

- `validate_journal_balance` — AFTER INSERT/UPDATE/DELETE on financial_journal_lines
- `validate_category_movement` — BEFORE INSERT/UPDATE on financial_transactions

### Mapeamento Contabil por Tipo de Movimento

| Tipo | Conta Fixa Debito | Conta Fixa Credito |
|------|-------------------|---------------------|
| RECEITA (pending) | 1.1.02.001 Clientes a Receber | categoria.counter_account |
| DESPESA (pending) | categoria.counter_account | 2.1.01.001 Fornecedores |
| TRANSFERENCIA | conta destino | conta origem |
| EMPRESTIMO_RECEBIDO | 1.1.01.x Banco | 2.1.06.001 Emprestimos |
| EMPRESTIMO_PAGO | 2.1.06.001 + 6.1.01.001 Juros | 1.1.01.x Banco |
| APORTE | 1.1.01.x Banco | 2.3.01.001 Capital Social |
| RETIRADA | 2.3.04.001 Distribuicoes PL | 1.1.01.x Banco |
| SALDO_INICIAL | 1.1.01.x Banco | 2.3.99.001 Contrapartida |
| IMOBILIZADO | categoria.counter_account | 2.1.01.001 Fornecedores |
| AJUSTE | (sem auto-journal) | (sem auto-journal) |

---

## 3. RLS

| Recurso | Admin | Equipe | Anonimo |
|---------|-------|--------|---------|
| financial_transactions | SIU | SIU | ❌ |
| financial_journal_entries | SIU | SIU | ❌ |
| financial_journal_lines | SIU | SIU | ❌ |
| *_list_v | RU | RU | ❌ |

- SIU = SELECT, INSERT, UPDATE (sem DELETE)
- DELETE revogado de todas as tabelas transacionais
- OperacoesAtomicas exclusivamente via RPC SECURITY DEFINER

---

## 4. Frontend

### Rotas

| Path | Componente | Lazy |
|------|-----------|------|
| `/finance/transactions` | TransactionsPage | ✅ |

### Sidebar

1 item adicionado: Transacoes (icone ArrowLeftRight).

### Home Page

Card "Transacoes" ativado com link e status "ETAPA 08B".

### Features

- `src/features/finance/schemas/finance-schemas.ts` — transactionBaseSchema + transactionSchema (refinement por tipo)
- `src/features/finance/api/finance-api.ts` — createTransaction, settleTransaction, cancelTransaction, updateTransaction, fetchTransactions, fetchJournalEntries, fetchJournalLines, fetchParties
- `src/features/finance/queries/finance-queries.ts` — useTransactions, useTransactionDetail, useJournalEntries, useJournalLines, useCreateTransaction, useSettleTransaction, useCancelTransaction, useParties
- `src/features/finance/pages/transactions-page.tsx` — lista com busca, create drawer com formulario dinamico por tipo, detail drawer com journal entries + lines

---

## 5. Testes

### Build

- `npm run build` → ✅ OK
- TypeScript: 0 erros
- Vite build: ~7s

### SQL Tests (remote, transactional ROLLBACK)

- `supabase db query --linked --file 08b_microgate_tests.sql` → ✅ **55/55 PASS**
- 8 transacoes criadas (1 por tipo)
- Settle + Cancel testados
- 3 edge cases (valor negativo, cancelar liquidado, cancelar ja cancelado)
- 7 view assertions
- 8 schema assertions
- 5 RLS/Grant assertions
- 2 column assertions

### Frontend Tests

- `npm test` → ✅ **48/48 PASS** (finance-specific)
- Test 08A do 08A atualizado com campos obrigatorios

### Cleanup

- Dados de teste removidos apos cada execucao (ROLLBACK)

---

## 6. Decisões

- **Reversal por swap (nao negativo)**: CHECK constraint `debit >= 0, credit >= 0` impede valores negativos. Reversao inverte as posicoes via helper functions `_insert_journal_pair` e `_insert_journal_triple`.
- **Settle/Cancel substituem entries**: delete + regenerate. Mantem ledger limpo (1 entry por status), nao acumula entries.
- **APORTE/RETIRADA com fallback de equity**: quando categoria nao fornece counter_account_id, usa `2.3.01.001` (Capital Social) ou `2.3.04.001` (Distribuicoes PL).
- **Trigger AFTER + balance**: como AFTER trigger ja inclui a linha atual na soma, NAO somar novamente `new.debit`.
- **auth.uid() em testes SQL**: retorna NULL via CLI. Coluna `created_by` permite NULL.
- **DB push impossivel para 08A**: CLI `supabase db push` nao re-aplica migrations ja aplicadas via dashboard. Usar `supabase db query --linked --file` para testes e inserts diretos.

---

## 7. Findings

| # | Severidade | Finding |
|---|-----------|---------|
| F-01 | LOW | balance trigger corrigido 3x (double-count, reversal negativo, equity fallback) |
| F-02 | INFO | settle cancel substituem entries por design (1 entry por status) |
| F-03 | INFO | test 50 do 08A (No journal tables) agora FALHA — esperado, 08B criou as tabelas |
| F-04 | LOW | warning chunk > 500kB continua (pre-existente) |

---

## 8. Arquivos Principais Alterados

### Novos

- `supabase/migrations/20260826000200_create_finance_transaction_engine.sql`
- `supabase/migrations/20260826000210_fix_journal_balance_trigger.sql`
- `supabase/migrations/20260826000220_fix_reversal_journal_engine.sql`
- `supabase/migrations/20260826000230_08b_microgate_tests.sql`
- `src/features/finance/pages/transactions-page.tsx`

### Modificados

- `src/types/database.ts` — adicionados tipos transacionais, tabelas, views, funcoes
- `src/features/finance/types/finance-types.ts` — re-exports dos novos tipos
- `src/features/finance/schemas/finance-schemas.ts` — transactionBaseSchema + refinement
- `src/features/finance/api/finance-api.ts` — transaction + journal APIs, fetchParties
- `src/features/finance/queries/finance-queries.ts` — transaction + journal hooks, useParties
- `src/app/router.tsx` — rota /finance/transactions
- `src/app/app-shell.tsx` — sidebar item Transacoes
- `src/routes/home-page.tsx` — card Transacoes

---

## 9. Proximo Passo Recomendado

**ETAPA 08C — Financeiro Avancado**: DRE, BP, DFC, Dashboard, validacoes de periodo, relatorios PDF/Excel.

(Nao iniciado — aguardando aprovacao)
