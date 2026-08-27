# Handoff Sprint 08E — DRE Gerencial

**Data**: 2026-08-26
**SHA entrada**: `bf9ec10`
**SHA saida**: `a7d759f` (pending commit)

---

## O que foi feito

### Migration SQL
- **Arquivo**: `supabase/migrations/20260826000500_create_income_statement.sql`
- **Objeto**: `get_income_statement(p_from, p_to, p_cost_center_id, p_service_line_id)`
- **Linguagem**: `plpgsql STABLE`
- **Aplicada**: remoto via `supabase db query --linked`

### DRE Structure — 14 linhas

| row_code | label | row_type | sort_order |
|---|---|---|---|
| RECEITA_BRUTA | Receita Bruta | SUBTOTAL | 10 |
| DEDUCOES | (-) Deduções da Receita | DETAIL | 20 |
| RECEITA_LIQUIDA | Receita Líquida | SUBTOTAL | 30 |
| CUSTOS | (-) Custos dos Serviços Prestados | DETAIL | 40 |
| LUCRO_BRUTO | Lucro Bruto / Margem de Contribuição | SUBTOTAL | 50 |
| DESPESAS_OPERACIONAIS | (-) Despesas Operacionais | DETAIL | 60 |
| EBITDA | EBITDA Gerencial | SUBTOTAL | 70 |
| DEPRECIACAO | (-) Depreciação e Amortização | DETAIL | 80 |
| EBIT | Resultado Operacional (EBIT) | SUBTOTAL | 90 |
| RESULTADO_FINANCEIRO | Resultado Financeiro | DETAIL | 100 |
| OUTROS_RESULTADOS | Outros Resultados | DETAIL | 110 |
| ANTES_IMPOSTOS | Resultado antes dos Tributos sobre Lucro | SUBTOTAL | 120 |
| IMPOSTOS | (-) Tributos sobre Resultado | DETAIL | 130 |
| RESULTADO_LIQUIDO | RESULTADO LÍQUIDO | TOTAL | 140 |

### Fórmulas implementadas

- Receita Líquida = Receita Bruta − Deduções
- Lucro Bruto = Receita Líquida − CSP
- EBITDA = Lucro Bruto − Despesas Operacionais
- EBIT = EBITDA − Depreciação e Amortização
- Resultado antes dos Tributos = EBIT + Resultado Financeiro + Outros Resultados
- Resultado Líquido = Resultado antes dos Tributos − Tributos

### dre_class utilizadas (10 valores)

`RECEITA_BRUTA`, `DEDUCAO_RECEITA`, `RECEITA_FINANCEIRA`, `OUTRAS_RECEITAS`, `CUSTO_SERVICO`, `DESPESA_OPERACIONAL`, `DEPRECIACAO_AMORTIZACAO`, `DESPESA_FINANCEIRA`, `OUTRAS_DESPESAS`, `IMPOSTO_RESULTADO`

### Frontend

- **Página**: `src/features/finance/pages/dre-page.tsx`
- **Rota**: `/finance/dre`
- **Sidebar**: DRE (FileText icon)
- **API**: `fetchIncomeStatement(filters)` em `finance-api.ts`
- **Query**: `useIncomeStatement(filters)` em `finance-queries.ts`
- **Cache invalidation**: `DRE_KEYS.all` invalidated on create/settle/cancel transaction mutations
- **Types**: `IncomeStatementRow` em `database.ts` + `finance-types.ts`
- **KPI cards**: Receita Líquida, EBITDA, Resultado Líquido, Margem EBITDA, Margem Líquida
- **Filtros**: De, Até, Centro de Custo, Linha de Serviço
- **Layout**: Tabela vertical de demonstrativo, com indentação, destaque para subtotais e total
- **Finance page card**: DRE adicionado como card ativo

### SQL Tests

- **Arquivo 08E**: `supabase/tests/08e_income_statement_tests.sql` — 50/50 PASS
- **Arquivo 08E.1**: `supabase/tests/08e1_microgate_tests.sql` — 15/15 PASS
- **Total**: 65/65 PASS
- **Cobertura**: grants, anon/public reject, security definer, search_path, structure, formulas, competence date, filters, integrity, labels, is_internal_user guard

### Integrity Checks

| Check | Count |
|---|---|
| Journals desbalanceados | 0 |
| Orphan lines | 0 |
| Result accounts without dre_class | 0 |
| Invalid dre_class | 0 |
| STAGE08E fixtures | 0 |

### Quality Gates

| Gate | Result |
|---|---|
| npm test | 218/218 PASS |
| npm run lint | 8 errors (all pre-existing), 1 warning (pre-existing) |
| npm run build | SUCCESS (8.96s) |

### Security (after MICROGATE 08E.1)

| Objeto | Admin | Equipe | Inativo | Anon | PUBLIC |
|---|---|---|---|---|---|
| get_income_statement() | EXECUTE | EXECUTE | DENY | DENY | NONE |

- SECURITY DEFINER
- search_path = 'public, pg_temp'
- Guard: `is_internal_user()` (active + role IN admin/equipe)

---

## Decisões

| ID | Decisão | Razão |
|---|---|---|
| DEC-08E-01 | DRE usa `LANGUAGE plpgsql STABLE` | Necessário para `RAISE EXCEPTION` no admin guard |
| DEC-08E-02 | COALESCE(..., 0) nos totals | Evita NULL quando não há journal entries no período |
| DEC-08E-03 | Apresentação segue referência Financeiro 360 | Termos: "Lucro Bruto / Margem de Contribuição", "EBITDA Gerencial" |
| DEC-08E-04 | Deduções apresentadas como negativo | UI exibe `(-) Deduções` com valor negativo, mantendo coerência visual |
| DEC-08E-05 | SECURITY DEFINER + search_path | Previne search_path hijacking em função que executa queries internas |
| DEC-08E-06 | Guard usa `is_internal_user()` | Relatório read-only: admin + equipe ativa (DEC-043) |

## Aprendizados

| ID | Aprendizado |
|---|---|
| LL-08E-01 | `DO $$ ... $$` não pode ser usado dentro de corpo de função PL/pgSQL — usar `BEGIN ... EXCEPTION WHEN` |
| LL-08E-02 | PL/pgSQL output variables conflitam com nomes de colunas em subquery — qualificar com alias |
| LL-08E-03 | `supabase db query --linked --file` só retorna o último result set — usar UNION ALL para múltiplos checks |
| LL-08E-04 | `REVOKE ALL ON FUNCTION ... FROM PUBLIC` falha com `undefined_object` quando função não existe ainda — aplicar REVOKE depois do CREATE |
| LL-08E-05 | `type="date"` inputs não têm role ARIA em jsdom — usar `container.querySelector` em testes |
| LL-08E-06 | Mocks parciais de TanStack Query precisam de `as unknown as` para satisfazer TypeScript |

---

## Próximo passo

Aguardar autorização para iniciar a ETAPA 08F — Ativos/Bens + Balanço Patrimonial.
