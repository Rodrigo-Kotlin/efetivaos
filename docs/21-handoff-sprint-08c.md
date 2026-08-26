# Handoff Sprint 08C — Contas a Receber e Contas a Pagar

## Status de Entrada

`ETAPA 08C — INICIADA`

Baseline validada:

- `ETAPA 08B — COMPLETED` (MICROGATE 08B.1 PASSED)
- Commit final: `3ddd983`
- Deploy: `f014ce97.efetivaos.pages.dev` (HTTP 200)
- 206/206 frontend tests passing
- 78/78 SQL tests passing (remote, ROLLBACK)
- Build TypeScript limpo
- Ledger append-only consolidado
- Journal entries/lines protegidos contra UPDATE/DELETE via triggers
- Mutations financeiras exclusivamente por RPC Admin com `is_admin()` guard
- Equipe read-only via RLS
- `idempotency_key` com índice único
- Proteção contra double-submit no frontend
- 4 migrations financeiras aplicadas (08A foundation, 08B engine, hardening, idempotency)

## Princípio Central

Contas a Receber e Contas a Pagar NÃO são novos livros financeiros.

São visões operacionais de obrigações já representadas pela camada transacional e contábil (`financial_transactions` + `financial_journal_entries` + `financial_journal_lines`).

Fonte autoritativa: `financial_transactions` + views.

Apresentação: `financial_receivables_v` e `financial_payables_v`.

## Objetivo da 08C

Implementar as visões operacionais de:

1. Contas a Receber;
2. Contas a Pagar;
3. Vencidos derivados;
4. Próximos vencimentos;
5. Baixa/liquidação via motor 08B;
6. Cancelamento quando permitido;
7. Filtros;
8. Indicadores operacionais básicos;
9. Integração com clients/suppliers/parties;
10. Integração com contas financeiras;
11. Integração com journal;
12. RLS/read-only Team;
13. E2E;
14. Produção.

## Não Implementar (explicitamente)

- DFC;
- Fluxo de caixa consolidado;
- DRE;
- Balanço Patrimonial;
- Ativos/Bens completos;
- DMPL/DLPA;
- DVA;
- Dashboard Financeiro 360;
- Importação Excel;
- PDF;
- Contratos.

## Arquitetura — Views Preferenciais

- `financial_receivables_v` — `security_invoker=true`
- `financial_payables_v` — `security_invoker=true`

Campos sugeridos (usar nomes reais do schema 08B):

- transaction_id;
- description;
- movement_type;
- status;
- original_amount;
- settled_amount;
- open_amount;
- transaction_date;
- competence_date;
- due_date;
- overdue boolean;
- days_overdue;
- client_id;
- client_name;
- supplier_id;
- supplier_name;
- party_id;
- party_name;
- category_id;
- category_name;
- cost_center_id;
- cost_center_name;
- service_line_id;
- service_line_name;
- origin_account_id;
- origin_account_name;
- payment_method_id;
- document_number;
- review_required;
- created_at.

## RLS — Tabela Resumo

| Objeto | Admin | Equipe | Anon | Mutation |
|--------|-------|--------|------|----------|
| `financial_receivables_v` | SELECT | SELECT | ❌ | ❌ |
| `financial_payables_v` | SELECT | SELECT | ❌ | ❌ |
| `financial_transactions` | via RPC | via RPC | ❌ | ❌ |
| `financial_journal_entries` | via RPC | via RPC | ❌ | ❌ |
| `financial_journal_lines` | via RPC | via RPC | ❌ | ❌ |

## SQL Tests — Mínimo (08C)

Adicionar no mínimo 40 testes SQL novos (não substituir os 78 existentes). Cobrir:

1. receivables view existe;
2. payables view existe;
3. security_invoker;
4. receita a prazo aparece em receivables;
5. receita à vista não fica pendente;
6. despesa a prazo aparece em payables;
7. despesa à vista não fica pendente;
8. cancelled não aparece como open;
9. settled open_amount = 0;
10. pending open_amount = amount;
11. overdue true;
12. future due overdue false;
13. days_overdue correto;
14. client resolution;
15. supplier resolution;
16. party fallback;
17. category resolution;
18. cost center;
19. service line;
20. document;
21. Admin SELECT;
22. Equipe SELECT;
23. Anon reject;
24. inactive reject;
25. Admin settle receivable;
26. Team settle rejected;
27. Admin settle payable;
28. Team pay rejected;
29. double settle rejected;
30. original journal preserved;
31. settlement journal appended;
32. receipt does not duplicate revenue;
33. payment does not duplicate expense;
34. cancel pending reversal;
35. cancelled title no open balance;
36. period lock respected;
37. inactive account rejected;
38. views no duplicate transactions;
39. integrity zero orphan;
40. zero duplicate receivable rows;
40. zero duplicate payable rows.

## Frontend Tests — Baseline

- 206/206 (manter).
- Adicionar testes para:
  - receivables list;
  - payables list;
  - overdue;
  - counters;
  - settle form;
  - Team read-only;
  - detail journal history;
  - filters.

## E2E — Mínimo

- Receivables Admin: login → criar receipt a prazo → abrir Receber → liquidar → validar status → conferir journal → cleanup;
- Payables Admin: criar expense a prazo → abrir Pagar → liquidar → confirmar journal → cleanup;
- Overdue: badge, days, filtro;
- Equipe: visualiza, não muta;
- Mobile: 390x844, sem overflow;
- Double Submit: tentativa duplicada resulta em um settlement.

## Build e Quality

- `npm run build` → ✅ TypeScript clean ✅
- `npm test` → ✅ 206/206 ✅
- `npm run lint` → ✅ zero erros novos ✅
- `supabase db lint --linked` → ✅ zero erros ✅

## Git

- SHA inicial (baseline): `3ddd983`
- Branch: `main`
- `main = origin/main`
- working tree clean

## Cloudflare

- Deploy ID: `f014ce97`
- Source SHA: `3ddd983`
- Production URL: `https://f014ce97.efetivaos.pages.dev`
- Rotas válidas: `/finance`, `/finance/receivables`, `/finance/payables`

## Smoke Produção

- Admin: lista receivables/payables, detail, settle controlada, cleanup;
- Equipe: read-only, abre detail, sem ação de mutação.

## Documentação

- `docs/21-handoff-sprint-08c.md` — este arquivo;
- `docs/05-roadmap.md` — status atualizado (ETAPA 08C);
- `docs/04-decision-register.md` — registrar DEC-039/040/041 se houver decisão técnica nova;
- `docs/06-learning-log.md` — registrar LL-040/041/042 se houver aprendizado novo.

## Findings Aceitáveis (podem permanecer)

- bundle >500kB (pre-existente);
- limitações conhecidas de headless Chromium;
- partial settlement deferred (explicitamente);
- RHF warnings preexistentes.

## Conclusão Provisória

`ETAPA 08C — Contas a Receber e Contas a Pagar — INICIADA`

Baseline preservada: ledger append-only, journal hardening, idempotency, RPC guards, 206 frontend tests, 78 SQL tests, deploy produção.

Próximo passo: Implementar views `financial_receivables_v` e `financial_payables_v`, RPCs de settle para recibíveis/pagáveis, UI de listagem e forms de liquidação, RLS validation, e SQL/frontofnt tests.

---

*Baseline: ETAPA 08B MICROGATE 08B.1 PASSED — commit 3ddd983 — deploy f014ce97.efetivaos.pages.dev*