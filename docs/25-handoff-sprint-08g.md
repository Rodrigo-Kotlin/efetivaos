# Handoff Sprint 08G — DMPL/DLPA + DVA + Ajustes + Notas

**Data**: 2026-08-27
**SHA entrada**: `b6a253a`
**SHA saida**: `781d147`

---

## O que foi feito

### Migration 08G
- **Arquivo**: `20260827000200_create_dmpl_dlpa_dva_adjustments_notes.sql`
- **Tabelas**: `financial_notes`
- **Enums**: `financial_note_type`, `financial_adjustment_status`
- **RPCs**: `get_statement_of_changes_in_equity`, `get_retained_earnings_statement`, `get_value_added_statement`, `create_manual_journal_adjustment`
- **Trigger**: `set_updated_at` para `financial_notes`
- **RLS**: `financial_notes` com policies para admin (INSERT/UPDATE/DELETE) e internal_user (SELECT)

### Frontend
- **DMPL Page**: `/finance/dmpl` — tabela matricial com colunas Capital/Reservas/LP/Resultado/Outros/Total
- **DLPA Page**: `/finance/dlpa` — layout vertical com saldos e movimentações
- **DVA Page**: `/finance/dva` — estrutura hierárquica de valor adicionado
- **Adjustments Page**: `/finance/adjustments` — form de ajuste com partidas dobradas (admin-only)
- **Notes Page**: `/finance/notes` — CRUD de notas gerenciais
- **Sidebar**: Links adicionados para DMPL, DLPA, DVA, Ajustes, Notas
- **Router**: Rotas adicionadas com lazy loading
- **Finance Page**: Cards atualizados com novas demonstrações

### SQL Tests
- **Arquivo**: `08g_microgate_tests.sql` — 50 checks
- **Schema**: 3 checks (tabelas e enums)
- **RPCs**: 4 checks (funções existem)
- **Security**: 7 checks (RLS, grants, anon denied)
- **Adjustment**: 8 checks (validação, idempotência, append-only)
- **Notes**: 5 checks (CRUD, trigger, validação)
- **DMPL**: 5 checks (rows, estrutura, equação, reconciliação BP)
- **DLPA**: 4 checks (rows, estrutura, reconciliação DRE)
- **DVA**: 6 checks (rows, estrutura, equação, depreciação)
- **Integrity**: 8 checks (unbalanced, orphan, append-only, PL accounts, DVA class)

### Frontend Tests
- **Baseline**: 236/236 preservados
- **Novos**: pendentes de criação (08G.1)

### Types
- **Database**: Tipos adicionados para `DmplRow`, `DlpaRow`, `DvaRow`, `FinancialNote`
- **RPCs**: Tipos adicionados para novas funções

---

## Arquitetura

```
ledger (journal_entries + journal_lines)
         │
         ├── get_balance_sheet() ◄── BP
         ├── get_income_statement() ◄── DRE
         ├── get_statement_of_changes_in_equity() ◄── DMPL
         ├── get_retained_earnings_statement() ◄── DLPA
         └── get_value_added_statement() ◄── DVA

create_manual_journal_adjustment() ◄── Ajustes (admin-only)
financial_notes ◄── Notas (camada explicativa)
```

- Todas as demonstrações derivam do ledger
- Ajustes criam novos journal entries (append-only)
- Notas não afetam o ledger

---

## Segurança

| Objeto | Admin | Equipe | Inativo | Anon | PUBLIC |
|--------|-------|--------|---------|------|--------|
| get_statement_of_changes_in_equity | EXECUTE | EXECUTE | DENY | DENY | NONE |
| get_retained_earnings_statement | EXECUTE | EXECUTE | DENY | DENY | NONE |
| get_value_added_statement | EXECUTE | EXECUTE | DENY | DENY | NONE |
| create_manual_journal_adjustment | EXECUTE | DENY | DENY | DENY | NONE |
| financial_notes (SELECT) | via is_internal_user | via is_internal_user | DENY | DENY | NONE |
| financial_notes (INSERT/UPDATE/DELETE) | is_admin | DENY | DENY | DENY | NONE |

---

## DMPL

- **Estrutura**: Saldo Inicial → Aportes → Ajustes → Resultado → Distribuições → Transferências → Saldo Final
- **Colunas**: Capital Social, Reservas, Lucros/Prejuízos Acumulados, Resultado do Exercício, Outros Componentes, Total PL
- **Equação**: Saldo Inicial + Movimentos = Saldo Final
- **Reconciliação**: Total PL Final = PL do BP (diferença < 0.01)

---

## DLPA

- **Estrutura**: Saldo Inicial → Ajustes Exercícios Anteriores → Resultado Líquido → Distribuições → Ajustes Período → Saldo Final
- **Reconciliação**: Resultado DLPA = Resultado DRE

---

## DVA

- **Estrutura**: Receitas → Insumos → Valor Bruto → Retenções → Valor Líquido → Transferências → Total Distribuir → Distribuições → Total Distribuído
- **Distribuições**: Pessoal, Governo/Tributos, Capital de Terceiros, Capital Próprio
- **Equação**: Total a Distribuir = Total Distribuído

---

## Ajustes Contábeis

- **Append-only**: Journal entries não podem ser editadas
- **Partidas dobradas**: Débitos = Créditos obrigatório
- **Idempotency**: Chave de idempotência previne duplicatas
- **Period locks**: Respeita `financial_period_locks`
- **Notes**: Justificativa opcional cria nota automaticamente

---

## Notas Gerenciais

- **Tipos**: GERAL, DRE, BP, DFC, DMPL, DLPA, DVA, AJUSTE, CONTA, ATIVO
- **Camada explicativa**: Não altera ledger
- **Permissões**: Admin cria/edita/inativa, Equipe lê

---

## Findings

| ID | Descrição | Severidade |
|----|-----------|------------|
| F1 | Frontend tests 08G não criados ainda | Pendente |
| F2 | Migration não aplicada no banco remoto | Pendente |
| F3 | bundle > 500kB (pre-existing) | Aceitável |
| F4 | lint 8 errors pre-existing (08B/08E) | Aceitável |

---

## Próximo passo

1. Aplicar migration no Supabase DEV
2. Executar testes SQL remotamente
3. Criar frontend tests para 08G
4. Executar smoke test nas novas páginas
5. Microgate 08G.1 (se necessário)

---

## Git

```
SHA entrada: b6a253a
SHA saida: 781d147
Commits:
  - feat(finance): add DMPL DLPA and DVA
Branch: main (synchronized with origin)
Working tree: clean
```