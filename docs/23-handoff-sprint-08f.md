# Handoff Sprint 08F — Ativos/Bens + Balanço Patrimonial

**Data**: 2026-08-27
**SHA entrada**: `5fb13b7`
**SHA saida**: pendente

---

## O que foi feito

### Migration 08F (original)
- **Arquivo**: `20260827000100_create_assets_and_balance_sheet.sql`
- **Tabelas**: `financial_assets`, `financial_asset_depreciation_postings`
- **Enums**: `financial_asset_status`, `financial_asset_depreciation_method`
- **Movement type**: `DEPRECIACAO`
- **RPCs**: `create_asset`, `update_asset`, `dispose_asset`, `post_asset_depreciation`, `get_balance_sheet`
- **View**: `financial_assets_list_v`
- **RLS**: SELECT para authenticated

### Migration 08F.1 (corretiva)
- **Arquivo**: `20260827000110_harden_assets_and_balance_sheet.sql`
- **Constraint**: `chk_residual_lte_acquisition` (residual_value <= acquisition_value)
- **Validator**: `validate_asset_accounts()` — verifica classe contábil das 3 contas
- **RPCs atualizadas**: `create_asset` e `update_asset` validam contas
- **Competência normalizada**: `date_trunc('month', p_competence_period)::date` em `post_asset_depreciation`
- **Security**: REVOKE anon/public de views e tabelas; RLS usa `is_internal_user()`
- **BP fix**: fallback `NAO_CLASSIFICADO` em vez de `'Ativo'` genérico

### Frontend
- **Página Ativos**: `assets-page.tsx` — warning de baixa operacional
- **Página BP**: `balance-sheet-page.tsx` — indicadores CCL, Liquidez Corrente, Endividamento, Capital de Terceiros

### SQL Tests
- **Arquivo original**: `08f_assets_balance_sheet_tests.sql` — 15/15 PASS
- **Arquivo novo**: `08f1_microgate_tests.sql` — 65 checks
- **Total 08F**: 80 checks

### Frontend Tests
- **Novo**: `assets-page.test.tsx` — 7 testes
- **Novo**: `balance-sheet-page.test.tsx` — 11 testes
- **Total frontend**: 236/236 PASS (baseline 218 + 18 novos)

---

## Arquitetura Patrimonial

```
financial_assets (cadastro operacional)
         │
         │ post_asset_depreciation()
         ▼
financial_transactions → financial_journal_entries → financial_journal_lines
                                                          │
                                          get_balance_sheet() ◄── BP
                                          get_income_statement() ◄── DRE
```

- `financial_assets` **não** alimenta BP nem DRE diretamente
- Depreciação gerencial é calculada na view para referência
- Depreciação contábil é feita via journal entry (D Despesa / C Dep. Acumulada)
- BP e DRE derivam exclusivamente do ledger (journal)

---

## Segurança

| Objeto | Admin | Equipe | Inativo | Anon | PUBLIC |
|--------|-------|--------|---------|------|--------|
| create_asset | EXECUTE | DENY | DENY | DENY | NONE |
| update_asset | EXECUTE | DENY | DENY | DENY | NONE |
| dispose_asset | EXECUTE | DENY | DENY | DENY | NONE |
| post_asset_depreciation | EXECUTE | DENY | DENY | DENY | NONE |
| get_balance_sheet | EXECUTE | EXECUTE | DENY | DENY | NONE |
| validate_asset_accounts | EXECUTE | DENY | DENY | DENY | NONE |
| financial_assets (SELECT) | via is_internal_user | via is_internal_user | DENY | DENY | NONE |
| financial_assets_list_v | via is_internal_user | via is_internal_user | DENY | DENY | NONE |

---

## Depreciação

- Método: linha reta (STRAIGHT_LINE)
- Fórmula: `(acquisition_value - residual_value) / useful_life_months`
- Competência: normalizada para primeiro dia do mês
- Idempotência: unique constraint `uq_depreciation_postings_asset_period` + check na RPC
- Contabilização: D Despesa de Depreciação / C Depreciação Acumulada
- Status: `FULLY_DEPRECIATED` quando acumulado >= base depreciável

---

## Balanço Patrimonial

- Deriva do journal via `get_balance_sheet(p_as_of_date)`
- Inclui resultado do exercício calculado dinamicamente (Modelo B)
- Equação: ATIVO = PASSIVO + PL verificada no frontend
- Indicadores: CCL, Liquidez Corrente, Endividamento Geral, Capital de Terceiros

---

## Conciliação Caixa

- BP Cash: somatório de contas ATIVO com `is_cash = true`
- Cashflow: `cashflow_summary()` fecha com saldo consolidado
- Teste SQL T38-T39 verificam existência de contas de caixa

---

## Disposal

- `dispose_asset` é **apenas baixa operacional**
- Status muda para `DISPOSED`, sem journal entry
- Baixa contábil (ganho/perda) permanece deferred
- UI exibe warning quando há ativos baixados

---

## Findings

| ID | Descrição | Severidade |
|----|-----------|------------|
| F1 | Cash reconciliation completa requer fixtures reais de caixa | Deferred |
| F2 | Reversão de depreciação não implementada | Deferred |
| F3 | Disposal contábil (ganho/perda) deferred | Deferred |
| F4 | bundle > 500kB (pre-existing) | Aceitável |
| F5 | lint 8 errors pre-existing (08B/08E) | Aceitável |

---

## Próximo passo

Aguardar autorização para iniciar a ETAPA 08G — DMPL/DLPA + DVA + Ajustes + Notas.
