# Handoff — Sprint 4 / ETAPA 04

## ETAPA 04 — STATUS

COMPLETED_WITH_FINDINGS

## Escopo executado

- Tela `/pricing/rules` (Admin-only) com lista table-first, busca, filtros por Escopo e Status, formulário em drawer com escopo condicional, e ações de criar/editar/inativar/reativar.
- Aplicação da hierarquia canônica `item > categoria > global` por meio da função `resolve_margin_rule` (SECURITY DEFINER, `search_path = ''`, `is_internal_user()`, `limit 1`).
- Cálculo autoritativo do preço sugerido em `pricing_comparison_v` via `round(unit_price * (1 + value / 100), 2)` (percentual) ou `round(unit_price + value, 2)` (fixo), com arredondamento determinístico.
- Tela `/pricing/comparison` ampliada com colunas Regra, Preço sugerido e Origem; filtro `Regra` (Com regra / Sem regra); ordenação por `Preço sugerido`; drawer de revisão do cálculo (sem aprovação).
- Invalidação automática das queries de comparação e de regras a cada mutation relevante via TanStack Query.
- Equipe visualiza o cálculo aplicado na comparação (campo seguro da view) e vê a página de regras com mensagem de acesso restrito; mutações via RLS continuam bloqueadas para Equipe.
- Nenhuma migration nova foi aplicada: o schema da Etapa 02 já entregava `margin_rules`, índices parciais `uq_margin_rules_*_active`, função `resolve_margin_rule` e view `pricing_comparison_v` (DEC-023, DEC-027).

## Git

Branch: `main`

Commits técnicos (a serem registrados no fechamento):

- `feat: implement pricing adjustment rules`
- `feat: add authoritative suggested price calculation`
- `feat: integrate pricing rules into comparison`
- `test: cover pricing rule precedence and calculations`
- `test: cover rules admin lifecycle`
- `test: add authenticated pricing rules e2e`
- `docs: close Sprint 4 comparison`

## Banco/Supabase

Nenhuma migration nova foi aplicada.

Histórico remoto permanece:

- `20260823000100_create_profiles_and_roles.sql`
- `20260823000200_create_pricing_schema.sql`
- `20260823000300_add_save_quotation_draft_rpc.sql`
- `20260823000400_create_comparison_current_view.sql`
- `20260823000410_revoke_anon_from_comparison_view.sql`

Pós-flight:

- 7 tabelas funcionais preservadas com RLS habilitada e forçada;
- 5 views de comparação preservadas (4 da Etapa 02 + 1 da Etapa 03);
- `resolve_margin_rule`, `approve_price`, `inactivate_price` permanecem SECURITY DEFINER e auditadas;
- Lint remoto do schema (`supabase db lint --linked --schema public --level warning`) sem erros;
- Pós-flight confirmou zero fixtures remanescentes.

## Fonte autoritativa

- **Listagem e cálculo**: `public.pricing_comparison_v` (DEC-028) — após auditoria explícita que confirmou `security_invoker = true`, grants apenas para `authenticated`, e ausência de acoplamento com Etapa 05;
- **Resolução da regra**: `public.resolve_margin_rule(p_catalog_item_id uuid)` — `SECURITY DEFINER`, `set search_path = ''`, filtra por `is_internal_user()` e retorna a regra de maior prioridade (item > categoria > global) com `limit 1`;
- **Cálculo do preço sugerido**: campo `suggested_price` da view, derivado por `case` no `select` da `pricing_comparison_v`;
- **Detalhe de ofertas**: `public.quotation_item_candidates_v` filtrado por `catalog_item_id`.

A regra central permanece no PostgreSQL. O frontend consome `pricing_comparison_v` para a tabela e o drawer de revisão, sem reimplementar critérios de cálculo no TypeScript.

## Regras de acréscimo

| Escopo | Quando | Persistência | RLS |
| --- | --- | --- | --- |
| Global | Sem regra específica | `margin_rules.scope_type = 'global'`, alvos nulos | Admin: SELECT/INSERT/UPDATE |
| Categoria | Sem regra de item | `scope_type = 'category'`, `category_id` obrigatório | Admin: SELECT/INSERT/UPDATE |
| Item | Sempre que existir | `scope_type = 'item'`, `catalog_item_id` obrigatório | Admin: SELECT/INSERT/UPDATE |

- Tipos: `percentage` (sobre custo) ou `fixed` (acréscimo monetário). Sem mistura semântica.
- `value numeric(14,4) not null check (value >= 0)`.
- Conflito de regra ativa bloqueado por índices parciais únicos: `uq_margin_rules_global_active`, `uq_margin_rules_category_active`, `uq_margin_rules_item_active`.
- Inativação preserva o histórico (`active = false`); a próxima regra válida na hierarquia assume automaticamente.
- RLS mantém Equipe sem mutação; admin-only.

## Hierarquia

Resultado canônico para `item = Hemograma` (categoria Exames):

| Configuração | Resultado |
| --- | --- |
| Item 35% + Categoria 30% + Global 20% | 35% (item) |
| Categoria 30% + Global 20% (item inativada) | 30% (categoria) |
| Global 20% (categoria e item inativadas) | 20% (global) |
| Nenhuma regra | `Sem regra` (preço sugerido = `—`) |
| Regra 0% | 0% (preço = custo) |
| Regra R$ 0,00 | fixo 0 (preço = custo) |

## Fórmulas

- **Percentual**: `Preço sugerido = round(custo × (1 + valor / 100), 2)`. Exemplo: R$ 100,00 × 1,30 = R$ 130,00.
- **Fixo**: `Preço sugerido = round(custo + valor, 2)`. Exemplo: R$ 100,00 + R$ 25,00 = R$ 125,00.
- **Arredondamento**: `round(..., 2)` PostgreSQL (half away from zero para `numeric`). Determinístico e validado para 6,70 + 30% = 8,71.
- **Margem bruta sobre venda** (Preço = Custo / (1 − margem)) continua fora do MVP.

## Comparação

Integração com a tela existente:

- Coluna `Menor custo` (existente) — `best_cost` de `pricing_comparison_v`;
- Coluna `Fornecedor` (existente) — `best_supplier_name`;
- **Nova coluna `Regra`** — `resolved_adjustment_value` + `formatRuleScope(resolved_rule_scope)` exibindo `30% · Categoria — Exames` ou `Sem regra`;
- **Nova coluna `Preço sugerido`** — `suggested_price`; clicar abre o drawer de revisão;
- Coluna `Validade` (existente);
- Coluna `Status` atualizada para `Sugestão disponível` quando há regra, `Sem oferta vigente` quando não há oferta, `Sem regra` quando oferta sem regra;
- Coluna `Outras ofertas` (existente).

Drawer de revisão mostra: item, fornecedor fonte, custo, validade, regra aplicada (origem, tipo, valor), fórmula explícita (`Preço sugerido = R$ X × (1 + Y% / 100) = R$ Z`) e preço sugerido destacado. Botão `Configurar regra` (Admin) leva a `/pricing/rules`; CTA só aparece para Admin.

Filtro adicional: `Situação da oferta` ganhou `Com regra` e `Sem regra`.

## Banco e Segurança

- Migrations aplicadas: nenhuma nesta Etapa.
- Funções SECURITY DEFINER auditadas: `resolve_margin_rule`, `approve_price`, `inactivate_price`. `search_path = ''` em todas; `is_internal_user()` em `resolve_margin_rule`; `is_admin()` em `approve_price` e `inactivate_price`.
- Views com `security_invoker = true`: `quotation_item_candidates_v`, `ranked_quotation_items_v`, `best_quote_per_item_v`, `pricing_comparison_v`, `comparison_current_v`. Grants apenas para `authenticated`; `anon` sem acesso efetivo.
- Tabelas com RLS: `suppliers`, `catalog_categories`, `catalog_items`, `quotations`, `quotation_items`, `margin_rules`, `price_list` — todas com RLS habilitada e forçada.
- Cenários RLS cobertos pela suíte remota: Admin consegue SELECT/INSERT/UPDATE em `margin_rules`; Equipe bloqueada por RLS; anônimo sem grant em nenhuma view de comparação.
- `approve_price` e `inactivate_price` não foram consumidos na Etapa 04 (preço comercial continua fora do escopo).

## Testes

SQL remoto (`supabase/tests/sprint_04_rules.test.sql`):

- 28 testes pgTAP em transação com rollback;
- 16 cenários da Etapa 04: somente global, global + categoria (categoria vence), global + categoria + item (item vence), item inativada, categoria inativada, nenhuma regra, 0% percentual, R$ 0,00 fixo, 30% em 100, fixo R$ 25 em 100, 6,70 + 30% = 8,71, alteração do menor custo recalcula, item substitui categoria, conflito de regra ativa, Equipe sem mutação, anônimo bloqueado;
- Lint remoto do schema sem erros;
- Pós-flight confirmou zero fixtures e zero extensão pgTAP remanescentes.

Frontend (`vitest run`):

- 123 testes aprovados em 18 arquivos (eram 102 na Sprint 3, +21);
- `comparison-helpers.test.ts` (9) cobre formatação BRL, `formatRuleValue`, `formatRuleScope`, filtros de oferta e regra;
- `comparison-api.test.ts` (8) cobre `listComparison` (agora em `pricing_comparison_v`), `listOffersForItem` e `translateError`;
- `comparison-page.test.tsx` (7) cobre loading, erro/retry, empty states, drawer, busca, filtros, ordenação;
- `rules-types.test.ts` (7) cobre `parseRuleValue`, `formatRuleValue`, labels canônicos e `validateRuleValue` (0% e R$ 0,00 válidos);
- `rules-api.test.ts` (6) cobre `listRules`, `createRule`, `updateRule`, `setRuleActive` e normalização de payload (limpa alvo quando global, valor 4 casas decimais);
- `rules-page.test.tsx` (6) cobre loading, empty, Equipe restrito, Admin com tabela, filtros e inativação.

E2E (`playwright test`):

- 1 cenário novo em `e2e/pricing-rules-flow.spec.ts` (Desktop Chrome): Admin cria cotação ativa, cria regra global de 20%, valida preço sugerido R$ 120,00 na comparação, cria regra de item de 35%, valida promoção para R$ 135,00, inativa regra de item via `/pricing/rules`, valida fallback para global (R$ 120,00). Limpeza final remove regras criadas durante o teste.

## UI/UX

- Identidade visual mantida (cor `#0B6B3A`, tipografia serif, badges com ícone).
- Página de regras: table-first com colunas Escopo (badge textual), Aplicada a, Tipo, Valor, Status, Atualizado em, Ações. Ações fixas à direita com Editar/Inativar (ou Reativar). Botão "Nova regra" no header (Admin) e CTA no empty state.
- Drawer de regras: Escopo e Tipo como radio groups; campos condicionais (categoria só para escopo `category`, item só para escopo `item`); validação Zod com mensagens em pt-BR; valor com `inputMode="decimal"`; observação opcional.
- Página de comparação: colunas adicionais `Regra` e `Preço sugerido` (esta com `Revisar cálculo` como ação secundária); status `Sugestão disponível` (em substituição a `Melhor custo` para destacar a calculabilidade); badge `Sem regra` clicável para Admin (configura regra) ou informativo para Equipe.
- Drawer de revisão: três seções claras (Custo, Regra aplicada, Fórmula e Preço sugerido) com nota explícita de que o valor ainda NÃO é preço comercial aprovado.
- Mobile: cards empilhados com código, item, menor custo, fornecedor, validade, regra, preço sugerido e outras ofertas.
- Skeleton, empty state contextual, erro com retry, banner de offline, bloqueio de mutações offline.

## Bundle

| Métrica | Sprint 3 | Sprint 4 | Delta |
| --- | --- | --- | --- |
| Chunk principal | 562,66 kB / 164,49 kB gzip | 563,00 kB / 164,60 kB gzip | +0,34 kB / +0,11 kB gzip |
| Regras de preço lazy (novo) | — | 20,07 kB / 6,09 kB gzip | — |
| Comparação lazy | 23,85 kB / 6,04 kB gzip | 32,31 kB / 7,30 kB gzip | +8,46 kB / +1,26 kB gzip |
| Cotações listagem | 9,90 kB / 3,02 kB gzip | 9,94 kB / 3,03 kB gzip | +0,04 kB |
| Editor de cotação | 30,90 kB / 8,73 kB gzip | 30,81 kB / 8,69 kB gzip | −0,09 kB |
| Catálogo lazy | 19,37 kB / 5,28 kB gzip | 19,28 kB / 5,23 kB gzip | −0,09 kB |
| Fornecedores lazy | 13,10 kB / 4,25 kB gzip | 13,10 kB / 4,25 kB gzip | 0 |

O aviso de chunk > 500 kB do Vite permanece não bloqueante.

## Deploy

- Integração: GitHub `main` → Cloudflare Pages;
- URL canônica: https://efetivaos.pages.dev;
- Rotas publicadas: `/pricing` (launcher), `/pricing/comparison`, `/pricing/rules` (novo), `/pricing/suppliers`, `/pricing/catalog`, `/pricing/quotations`, `/pricing/quotations/new`, `/pricing/quotations/:id`;
- Deploy deve ser confirmado após o merge dos commits técnicos desta sprint; o hash de fechamento entra no relatório final do agente.

## Arquivos principais alterados / criados

- Sem migrations novas;
- Testes SQL: `supabase/tests/sprint_04_rules.test.sql`;
- Frontend: `src/features/pricing/rules/` (rules-page, rule-form, rules-api, rules-queries, rules-schema, rules-types, rule-scope-badge + 3 testes);
- `src/features/pricing/comparison/` (comparison-page, comparison-table, comparison-api, comparison-types, comparison-helpers, review-drawer atualizados para incluir Regra, Preço sugerido e drawer de revisão);
- `src/types/database.ts` com `PricingComparisonRow` e `MarginRule`;
- `src/app/router.tsx` com a nova rota `/pricing/rules`;
- `src/app/app-shell.tsx` com item de menu "Regras de preço" e badge "Sprint 4";
- E2E: `e2e/pricing-rules-flow.spec.ts` e ajuste em `playwright.config.ts`;
- Documentação: `docs/04-decision-register.md`, `docs/05-roadmap.md`, `docs/06-learning-log.md` e este handoff.

## Decisões registradas

- `DEC-028` (nova): `pricing_comparison_v` reusada como fonte autoritativa da Etapa 04 após auditoria explícita (em vez de criar nova view dedicada).

## Findings

- Chunk principal cresceu 0,34 kB no principal; o novo chunk `rules-page` (20,07 kB / 6,09 kB gzip) e o `comparison-page` (32,31 kB / 7,30 kB gzip) ficaram isolados via code-splitting por rota. A Etapa 05 deve reusar `/pricing/rules` e o drawer de revisão para evitar novo crescimento de bundle.
- `pricing_comparison_v` foi reusada com auditoria prévia em vez de criar nova view, preservando o agrupamento canônico por `catalog_item_id` e evitando duplicação da lógica de menor custo e cálculo.
- Nenhum teste real de duas sessões concorrentes foi executado; concorrência simultânea continua como finding conhecido de DEC-024.
- Snapshot físico do banco remoto não habilitado; ponto de retorno continua sendo o snapshot lógico externo da Etapa 00.2.

## Próximo passo recomendado

ETAPA 05 — Seleção de fonte, aprovação comercial e Tabela de Preços Efetiva.
