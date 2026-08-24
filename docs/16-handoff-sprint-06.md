# Handoff — Sprint 6 / ETAPA 06

## ETAPA 06 — STATUS

COMPLETED_WITH_FINDINGS

## Escopo executado

- Dashboard operacional em `/pricing` com preços aprovados, itens em revisão, itens sem regra, itens sem oferta vigente e cotações vencendo nos próximos 7 dias.
- Loading com skeleton, erro com retry completo e ausência de zeros falsos antes da resposta autoritativa.
- Atalhos finais para comparação, tabela comercial, cotações, fornecedores, catálogo e regras; regras visíveis e acessíveis somente para Admin.
- Invalidação consolidada da comparação após alterações em catálogo, fornecedores, cotações, regras e decisões comerciais.
- Textos temporários de sprints/fundação removidos da home, dashboard e App Shell.
- PWA alterado de ativação automática para atualização confirmada pelo usuário, preservando formulários não salvos.
- Responsividade validada em 1440, 1280, 1024, 768, 390 e 360 px, sem overflow horizontal no dashboard.
- Deep-links, modo offline informativo e ausência de erros de console cobertos por Playwright.
- Auditoria final de RLS, perfil inativo, RPCs, Storage e funções `SECURITY DEFINER`.

## Git

Branch: `main`.

Commits da etapa:

- `4871151 feat: complete pricing operations dashboard`;
- `35bf437 fix: restrict privileged database function grants`;
- `ccbf561 test: cover final pricing dashboard flows`;
- `0c86188 docs: close pricing MVP Sprint 6`.

## Banco/Supabase

Projeto DEV: `bxviuzluxcijbqqbpyzb`.

Migration aplicada:

- `20260824000120_harden_security_definer_grants.sql`.

O inventário remoto confirmou 11 funções `SECURITY DEFINER` no schema `public`, todas com owner `postgres`, `search_path` vazio e sem `EXECUTE` para `anon`. `handle_new_user`, `assert_active_quotation_integrity` e `enforce_quotation_integrity_deferred` também deixaram de ser executáveis diretamente por `authenticated`.

Nenhuma tabela, view, RPC ou regra funcional foi criada. A única alteração estrutural foi a revogação objetiva de grants excessivos.

## Testes

- ESLint: aprovado.
- Vitest: 147/147 em 21 arquivos.
- TypeScript/Vite/PWA build: aprovado.
- Playwright remoto: 11/11, Admin, Equipe, mobile, seis breakpoints, deep-links, offline e console.
- Schema remoto: 46/46.
- Sprint 5: 48/48.
- Sprint 4: 28/28.
- Profiles/RLS: 8/8.
- Lint remoto do schema `public`: sem erros.
- Pós-flight: zero fornecedores, categorias, itens ou cotações `E2E_S2_*`; zero extensão pgTAP persistida.

## PWA e bundle

- Manifest oficial preservado em `public/site.webmanifest`.
- Service worker sem runtime cache para Supabase ou dados transacionais.
- Estratégia de registro: `prompt`, com ativação apenas após confirmação.
- Precache: 61 entradas, aproximadamente 1.170 KiB.
- Chunk principal: 563,70 kB / 164,89 kB gzip.
- Dashboard lazy: 9,25 kB / 2,86 kB gzip.

## Deploy

- Integração: GitHub `main` para Cloudflare Pages.
- URL canônica: https://efetivaos.pages.dev.
- Deployment validado: `c917edfc-c362-47a4-b2cd-8849bcdb4637`.
- Source: `7043914`.
- URL imutável: https://c917edfc.efetivaos.pages.dev.
- `/pricing`, `/pricing/comparison` e `/pricing/prices` responderam na URL canônica; `/pricing` também respondeu na URL imutável.
- `site.webmanifest` e `sw.js` publicados e acessíveis.

## Arquivos principais alterados

- `src/features/pricing/pricing-page.tsx`
- `src/features/pricing/pricing-page.test.tsx`
- `src/features/auth/protected-route.tsx`
- `src/app/router.tsx`
- `src/app/app-shell.tsx`
- `src/features/pricing/*/*.queries.ts`
- `src/main.tsx`
- `vite.config.ts`
- `e2e/pricing-dashboard.spec.ts`
- `supabase/migrations/20260824000120_harden_security_definer_grants.sql`
- `supabase/tests/pricing_schema.test.sql`
- `supabase/tests/sprint_06_security_inventory.sql`
- `supabase/tests/sprint_06_postflight.sql`

## Decisões registradas

- `DEC-030`: atualização do PWA exige confirmação explícita.
- `DEC-031`: grants explícitos para funções privilegiadas.
- `LL-025`: revogar `public` não substitui inventário efetivo de grants.

## Findings

- O chunk principal compartilhado permanece acima do aviso de 500 kB, apesar de todas as páginas operacionais continuarem lazy-loaded.
- O Supabase DEV continua sem snapshot físico/PITR habilitado; migrations e snapshot lógico externo permanecem os pontos de retorno disponíveis.
- Permanece a possibilidade residual conhecida de objeto privado órfão se a recuperação concorrente de anexo for interrompida.
- `price_list` continua representando apenas o registro comercial corrente; histórico analítico/versionado permanece fora do MVP.

## Próximo passo recomendado

Definir e autorizar o próximo módulo do Efetiva OS após fechamento do Motor de Preços.
