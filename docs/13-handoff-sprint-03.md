# Handoff — Sprint 3 / ETAPA 03

## ETAPA 03 — STATUS

COMPLETED_WITH_FINDINGS

## Escopo executado

- View autoritativa `public.comparison_current_v` (migration 004) para a tela de comparação, com `LEFT JOIN` em `best_quote_per_item_v`, `security_invoker = true` e revogação explícita de `anon`/`public` (migration 00410);
- Tela `/pricing/comparison` table-first, mobile-first cards no celular, busca por código/item/fornecedor, filtros por categoria, fornecedor e situação da oferta, ordenação por item/menor custo/categoria/validade, indicador permanente de "Validade não informada", drawer lateral de ofertas elegíveis e históricas;
- Hub `/pricing` atualizado como launcher operacional com cards de indicadores (Itens com oferta, Itens sem oferta, Cotações vencendo 7 dias) e atalho primário para a comparação;
- Invalidação automática das queries da comparação sempre que o usuário cria/ativa/cancela cotações via TanStack Query;
- Comparação puramente derivada: nenhum estado novo persistido; o menor custo e os desempates continuam sendo responsabilidade das views `quotation_item_candidates_v` / `ranked_quotation_items_v` / `best_quote_per_item_v`;
- Nenhuma implementação de acréscimo, preço sugerido, seleção manual de fonte, aprovação comercial, `price_list` na interface, CRM, Financeiro ou Dashboard avançado.

## Git

Branch: `main`

Commits técnicos (a serem registrados no fechamento):

- `chore: prepare sprint 3 comparison view migration`
- `feat: add pricing comparison query`
- `feat: implement lowest-cost comparison UI`
- `feat: harden comparison view grants`
- `test: cover quotation eligibility and tie-breakers`
- `test: cover comparison view and lifecycle`
- `test: add authenticated comparison e2e`
- `docs: close Sprint 3 comparison`

## Banco/Supabase

Migrations aplicadas no projeto DEV `efetivaos` (`bxviuzluxcijbqqbpyzb`):

- `20260823000400_create_comparison_current_view.sql`
- `20260823000410_revoke_anon_from_comparison_view.sql`

Histórico remoto após o gate:

- `20260823000100_create_profiles_and_roles.sql`
- `20260823000200_create_pricing_schema.sql`
- `20260823000300_add_save_quotation_draft_rpc.sql`
- `20260823000400_create_comparison_current_view.sql`
- `20260823000410_revoke_anon_from_comparison_view.sql`

Pós-flight:

- 1 view adicional `comparison_current_v`, com `security_invoker = true`;
- `GRANT SELECT` apenas para `authenticated`; `anon` e `public` revogados explicitamente;
- views pré-existentes (`quotation_item_candidates_v`, `ranked_quotation_items_v`, `best_quote_per_item_v`, `pricing_comparison_v`) preservadas sem alteração;
- nenhuma tabela nova criada;
- nenhum trigger/função nova criada;
- RLS e Storage inalterados.

## Fonte autoritativa

- Listagem: `public.comparison_current_v` (criada na Etapa 03);
- Elegibilidade e desempate: `public.quotation_item_candidates_v` (flag `is_eligible`) e `public.ranked_quotation_items_v` (ordenação por `unit_price asc, valid_until desc nulls last, received_at desc, quotation_item_id`);
- Detalhe por item: `public.best_quote_per_item_v` (uma linha por item elegível).

A regra central permanece no PostgreSQL. O frontend consome `comparison_current_v` para a tabela e `quotation_item_candidates_v` filtrado por `catalog_item_id` para o drawer, sem reimplementar critérios no TypeScript.

## Elegibilidade

| Estado | Resultado | Origem da regra |
| --- | --- | --- |
| Cotação `active` + `catalog_item_id` mapeado + `valid_until` futura | Elegível | `is_eligible = true` em `quotation_item_candidates_v` |
| Cotação `active` sem `valid_until` | Elegível com alerta | Mesma flag, mais `validity_not_informed` derivado |
| Cotação `draft` | Inelegível (não disputa) | `is_eligible = false` |
| Cotação `cancelled` | Inelegível (mantida no histórico) | `is_eligible = false` |
| Cotação `active` com `valid_until < current_date` | Inelegível automaticamente | `is_eligible = false`, exibida como "Vencida" no histórico |
| Item do catálogo `active = false` | Não listado por padrão em `comparison_current_v` | Filtro `where ci.active = true` na view |

## Menor custo

Ordem de classificação implementada no banco:

1. `unit_price asc` — menor valor unitário;
2. `valid_until desc nulls last` — empate favorece a oferta com maior validade conhecida (validade `NULL` perde frente a `2026-12-31`);
3. `received_at desc` — empate favorece a cotação recebida mais recentemente;
4. `quotation_item_id` — desempate estável para manter a ordem determinística entre execuções.

A Etapa 03 validou os 10 cenários do enunciado (dois preços, três preços, vencida que era a melhor, sem validade mais barata, cancelada, rascunho, empate por valor, empate completo, sem oferta, descrições distintas do mesmo item).

## Outras ofertas

- Coluna "Outras ofertas" na tabela exibe a contagem `eligible_offer_count - 1` quando há mais de uma oferta elegível (ou o total quando há zero/uma).
- Clique abre drawer lateral com:
  - Ofertas vigentes (ordenadas do menor para o maior custo, com validade, status e referência da cotação);
  - Histórico (separado, com vencidas, canceladas e rascunhos, marcadas com badge específico e descrição original);
  - Validade real destacada: "Vigente", "Vencida" ou "Validade não informada";
  - Fornecedor, valor unitário, referência da cotação, data recebida, código do fornecedor e descrição original.
- O drawer desabilita o scroll do body enquanto está aberto via Radix Dialog.

## Banco e Segurança

- Migrations incrementais (00400 e 00410) sem recriar objetos existentes; nenhuma dependência removida.
- 7 tabelas funcionais permanecem com RLS habilitada e forçada.
- 4 views de comparação preservadas + 1 nova view dedicada à Etapa 03.
- Grants:
  - `comparison_current_v`: `SELECT` apenas para `authenticated`; `anon`/`public` revogados;
  - Outras 3 views de comparação e `pricing_comparison_v` permanecem com `SELECT` apenas para `authenticated`.
- Cenários RLS cobertos pela suíte remota: Admin (30xx-...001) enxerga todos os itens ativos; Equipe (30xx-...002) idem; anônimo continua sem grant.
- Função `resolve_margin_rule` continua SECURITY DEFINER, com `search_path = ''` e `is_internal_user()` no filtro — sem alteração.

## Testes

SQL remoto (`supabase/tests/sprint_03_comparison.test.sql`):

- 33 testes pgTAP em transação com rollback;
- 10 cenários da Etapa 03 + RLS Admin/Equipe + grants + estrutura da view;
- lint remoto do schema (`supabase db lint --linked --schema public --level warning`) sem erros;
- pós-flight confirmou zero fixtures e zero extensão pgTAP remanescentes.

Frontend (`vitest run`):

- 102 testes aprovados em 15 arquivos (eram 80 na Sprint 2, +22);
- `comparison-helpers.test.ts` cobre formatação pt-BR, busca, filtros, ordenação numérica e regra de validade;
- `comparison-api.test.ts` cobre `listComparison`, `listOffersForItem`, `translateError` e a propagação para TanStack Query;
- `comparison-page.test.tsx` cobre loading, erro/retry, empty states, destaque do melhor custo, sem oferta, validade não informada, drawer, busca, filtros, ordenação e botão "Limpar filtros".

E2E (`playwright test`):

- 1 cenário novo em `e2e/comparison-flow.spec.ts` (Desktop Chrome) cobrindo: criação de duas cotações para o mesmo item com preços diferentes, ativação, navegação para a comparação, validação do menor custo vigente (R$ 150,00), abertura do drawer mostrando ambas as ofertas, cancelamento da melhor oferta e validação da promoção da próxima (R$ 180,00);
- Cenário 3 da Sprint 2 (`quotation-draft.spec.ts`) preservado;
- Limpeza final coleta todas as cotações que iniciam com o prefixo da fixture antes de remover a categoria e o fornecedor.

## UI/UX

- Identidade visual mantida (cor `#0B6B3A`, tipografia serif nos títulos, cards arredondados, badges textuais com ícone).
- Tabela desktop-first com colunas Código, Item/Serviço, Categoria, Unidade, Menor custo vigente, Fornecedor, Outras ofertas, Validade, Status e Ações; coluna de ações fixa à direita.
- Status "Melhor custo" e "Sem oferta vigente" em badge textual com ícone (`Star` / `XCircle`), nunca dependente apenas de cor.
- "Validade não informada" como badge permanente no card e no drawer.
- Mobile: cards empilhados com código, item, fornecedor, validade e quantidade de ofertas; ordenação default por item.
- Skeleton de carregamento (`TableSkeleton`); sem spinner isolado.
- Empty states contextuais: catálago vazio, sem itens após filtro, sem cotações ativas.
- Erro com botão "Tentar novamente" via `ErrorState`.
- Banner de offline visível em `/pricing` e `/pricing/comparison` quando o navegador está sem conexão.
- Filtros e busca funcionam simultaneamente e a limpeza única reseta todos os critérios.
- Drawer acessível com foco gerenciado, `Escape` para fechar e botão "Fechar painel" rotulado.

## Bundle

| Métrica | Sprint 2 | Sprint 3 | Delta |
| --- | --- | --- | --- |
| Chunk principal | 562,15 kB | 562,66 kB | +0,51 kB (ruído de minificação) |
| Chunk principal gzip | 164,29 kB | 164,49 kB | +0,20 kB |
| Fornecedores lazy | 14,54 kB / 4,70 kB gzip | 13,10 kB / 4,25 kB gzip | -1,44 kB (limpeza de imports não usados) |
| Catálogo lazy | 22,36 kB / 6,07 kB gzip | 19,37 kB / 5,28 kB gzip | -2,99 kB |
| Cotações listagem | 9,79 kB / 2,98 kB gzip | 9,90 kB / 3,02 kB gzip | +0,11 kB |
| Editor de cotação | 30,81 kB / 8,68 kB gzip | 30,90 kB / 8,73 kB gzip | +0,09 kB |
| **Comparação lazy (novo)** | — | 23,85 kB / 6,04 kB gzip | — |

O aviso de chunk > 500 kB do Vite permanece não bloqueante.

## Deploy

- Integração: GitHub `main` → Cloudflare Pages;
- URL canônica: https://efetivaos.pages.dev;
- Rotas publicadas: `/pricing` (launcher), `/pricing/suppliers`, `/pricing/catalog`, `/pricing/comparison`, `/pricing/quotations`, `/pricing/quotations/new`, `/pricing/quotations/:id`;
- Deploy deve ser confirmado após o merge dos commits técnicos desta sprint; o hash de fechamento entra no relatório final do agente.

## Arquivos principais alterados / criados

- Migrations: `supabase/migrations/20260823000400_create_comparison_current_view.sql`, `20260823000410_revoke_anon_from_comparison_view.sql`;
- Testes SQL: `supabase/tests/sprint_03_comparison.test.sql`;
- Frontend: `src/features/pricing/comparison/` (comparison-page, comparison-table, offers-drawer, comparison-api, comparison-queries, comparison-types, comparison-status, comparison-helpers, comparison-page.test, comparison-api.test, comparison-helpers.test);
- `src/features/pricing/pricing-page.tsx` reescrito como launcher;
- `src/app/router.tsx` com a nova rota `/pricing/comparison`;
- `src/app/app-shell.tsx` com item de menu "Comparação" e badge "Sprint 3";
- `src/types/database.ts` com as novas views tipadas;
- E2E: `e2e/comparison-flow.spec.ts` e ajuste em `e2e/fixtures.ts`/`playwright.config.ts`;
- Documentação: `docs/04-decision-register.md`, `docs/05-roadmap.md`, `docs/06-learning-log.md` e este handoff.

## Decisões registradas

- `DEC-027`: fonte autoritativa da comparação na Etapa 03 (view `comparison_current_v` + revogação de `anon`/`public`).

## Findings

- O chunk principal compartilhado segue acima de 500 kB; a comparação lazy (23,85 kB / 6,04 kB gzip) é um chunk separado via code-splitting e o delta de 0,51 kB no principal ficou dentro do ruído de minificação.
- `pricing_comparison_v` não foi reaproveitada por carregar o estado consolidado das Etapas 04 e 05 (sugestão de preço, snapshots, `effective_status`); a Etapa 03 introduziu `comparison_current_v` para evitar acoplamento prematuro e duplicação da lógica de menor custo.
- Nenhum teste real de duas sessões concorrentes foi executado contra o Supabase DEV; a suíte E2E cobre cancelamento e ativação sequenciais; concorrência simultânea segue como finding conhecido de DEC-024.
- Snapshot físico do banco não está habilitado no DEV remoto; o ponto de retorno continua sendo o snapshot lógico externo `efetivaos-pre-20260823000200-20260823T191623Z.json` (SHA-256 `65C440927B1FBADB122B3DDE417D343098B70CD3B3E85CA0538447ECC094D379`).

## Próximo passo recomendado

ETAPA 04 — Regras de acréscimo e cálculo do preço sugerido.
