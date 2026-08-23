# Handoff — Sprint 0 / Gate 00.1

## ETAPA 00.1 — STATUS

COMPLETED_WITH_FINDINGS

## Escopo executado

- identidade visual oficial aplicada no login, loading, sidebar, mobile e PWA;
- assets oficiais versionados sem conversão dos PNGs fornecidos;
- documentos v0.2/v0.3 normalizados nos caminhos canônicos;
- wireframe navegável preservado em `docs/wireframes/`;
- pacote técnico original preservado em `docs/archive/`;
- schema monolítico revisado contra a migration de Sprint 0;
- migration incremental do Motor de Preços criada sem duplicar `profiles`;
- constraints, índices, triggers, views, RPCs, RLS, grants e Storage revisados;
- testes T-DB ampliados para autorização, ciclo de vida, cálculo, histórico e Storage;
- nenhum CRUD funcional da Sprint 1 foi iniciado.

## Git

Branch: `main`

Commits do Gate 00.1:

- `87d3bd4 feat: apply official Efetiva visual identity`
- `2ebd798 docs: add approved v0.3 technical baseline`
- `0e48d2a feat: prepare pricing schema baseline for incremental migration`

## Banco/Supabase

Projeto remoto: `efetivaos` (`bxviuzluxcijbqqbpyzb`).

Situação remota:

- migration aplicada permanece `20260823000100_create_profiles_and_roles.sql`;
- `profiles.id`, roles, Auth e RLS da Sprint 0 foram preservados;
- a migration do Motor de Preços não foi aplicada ao remoto neste gate.

Baseline incremental:

- `supabase/migrations/20260823000200_create_pricing_schema.sql`;
- depende explicitamente da migration de profiles existente;
- adiciona `profiles.active`, `created_by` e `updated_by` sem recriar a tabela;
- mantém role alterável somente por `set_user_role()`;
- impede DML direto em `price_list`; aprovação/inativação passam pelas RPCs;
- serializa alterações concorrentes que afetam aprovação comercial;
- preserva unidade/categoria canônicas depois de uso histórico;
- exige anexos no caminho `<quotation_id>/arquivo` e bloqueia substituição após sair de `draft`.

## Testes

Banco local:

- `supabase db reset`: aprovado com as duas migrations desde zero;
- `supabase test db`: 47 testes aprovados;
- `supabase db lint --local --schema public --level warning`: nenhum erro de schema da aplicação;
- cobertura inclui T-DB-01 a T-DB-15 e casos adicionais de autopromoção, grants, DT-02, DT-03, DT-07, DT-08 e auditoria.

Frontend:

- `npm test`: aprovado;
- `npm run lint`: aprovado;
- `npm run build`: aprovado;
- rotas funcionais permanecem lazy-loaded;
- service worker inclui apenas app shell e assets estáticos.

## Arquivos principais alterados

- `assets/logo/`
- `public/site.webmanifest`
- `public/icons/`
- `src/components/shared/logo.tsx`
- `src/components/shared/loading-screen.tsx`
- `src/features/auth/login-page.tsx`
- `src/app/app-shell.tsx`
- `docs/01-especificacao-mvp-v0.2.docx`
- `docs/02-projeto-tecnico-v0.3.docx`
- `docs/03-handoff-v0.3.md`
- `docs/wireframes/motor-precos-v0.3.html`
- `supabase/migrations/20260823000200_create_pricing_schema.sql`
- `supabase/tests/pricing_schema.test.sql`

## Decisões registradas

- `DEC-022`: uso exclusivo dos assets oficiais da identidade Efetiva;
- `DEC-023`: schema do Motor de Preços convertido em migration incremental compatível e não aplicado automaticamente ao remoto.

## Findings

- o chunk principal do frontend mede 528,52 kB (154,65 kB gzip) e permanece acima do aviso padrão do Vite, concentrando runtime React, Supabase Auth, router e providers compartilhados; login, app shell, home, pricing e 404 continuam em chunks lazy separados, portanto não foi introduzida divisão artificial sem ganho de carga total;
- o pacote SQL original não era executável sobre a baseline aplicada porque esperava `profiles.user_id`; ele permanece apenas como artefato histórico dentro do ZIP;
- a migration incremental foi homologada no Supabase local, mas rollout remoto, backup e validação pós-migration continuam sendo uma ação separada e explicitamente autorizada;
- no Windows, a stack Supabase completa apresentou instabilidade em containers auxiliares; a validação reproduzível usou somente o banco, sem impacto no schema ou nos testes.

## Próximo passo recomendado

Autorizar separadamente o rollout da migration `20260823000200_create_pricing_schema.sql` em ambiente Supabase de desenvolvimento/remoto, com backup e repetição dos testes de Admin/Equipe. Somente depois liberar a Sprint 1 — Fornecedores + Categorias + Catálogo.
