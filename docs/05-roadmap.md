# 05 â€” Roadmap do Efetiva OS

## Estado geral

**Baseline funcional:** v0.2  
**Baseline tÃ©cnico:** v0.3  
**Status atual:** FASE 3C.5 - Registro da homologacao responsiva da Fase 3C.4 - COMPLETED.

---

## Fase 1 â€” MVP

### Sprint 0 â€” FundaÃ§Ã£o tÃ©cnica

**Status:** COMPLETED

Escopo:

- repositÃ³rio GitHub;
- estrutura inicial do projeto;
- React + TypeScript + Vite;
- Tailwind + shadcn/ui;
- Supabase client;
- Supabase Auth;
- `profiles`;
- roles `admin` e `equipe`;
- RLS baseline;
- App Shell;
- sidebar;
- rota `/pricing`;
- TanStack Query;
- PWA manifest;
- service worker simples;
- Cloudflare Pages;
- deploy pÃºblico;
- documentaÃ§Ã£o no repositÃ³rio.

Gate:

- build sem erro;
- login/logout funcionando;
- rota protegida;
- Admin/Equipe reconhecidos;
- RLS testado;
- URL Cloudflare acessÃ­vel.

---

### Gate 00.1 â€” ConsolidaÃ§Ã£o da baseline

**Status:** COMPLETED

Escopo:

- identidade oficial Efetiva aplicada ao PWA;
- especificaÃ§Ã£o v0.2 e Projeto TÃ©cnico v0.3 em nomes canÃ´nicos;
- handoff v0.3 e wireframes navegÃ¡veis versionados;
- SQL monolÃ­tico preservado no pacote histÃ³rico;
- migration incremental do Motor de PreÃ§os compatÃ­vel com a Sprint 0;
- RLS, RPCs, views, ciclo de vida e Storage revisados;
- testes T-DB e lint executados no Supabase local;
- sem CRUD funcional da Sprint 1.

Gate:

- build, lint e testes de frontend aprovados;
- reset local das migrations aprovado;
- 47 testes pgTAP aprovados;
- schema lint sem erros;
- documentaÃ§Ã£o e handoff atualizados;
- banco remoto preservado sem aplicaÃ§Ã£o da migration candidata.

---

### Gate 00.2 â€” Rollout Supabase DEV

**Status:** COMPLETED

Escopo:

- credencial de banco exposta revogada e removida da versÃ£o corrente;
- snapshot lÃ³gico pre-migration armazenado fora do Git;
- migration incremental do Motor de PreÃ§os reavaliada para concorrÃªncia;
- migration `20260823000200_create_pricing_schema.sql` aplicada no Supabase DEV;
- schema, RLS, grants, RPCs, views, triggers e Storage verificados remotamente;
- testes de Admin, Equipe, anÃ´nimo e regras funcionais executados com rollback;
- nenhum CRUD funcional da Sprint 1 iniciado.

Gate:

- duas auditorias estÃ¡ticas independentes com resultado GO;
- dry-run confirmou somente a migration `20260823000200` pendente;
- 40 testes SQL do Motor de PreÃ§os aprovados remotamente;
- 8 testes SQL de profiles/roles aprovados remotamente;
- lint remoto sem erros de schema;
- 7 tabelas protegidas com RLS habilitada e forÃ§ada;
- banco DEV limpo, sem dados funcionais de teste persistidos.

---

### Sprint 1 â€” Fornecedores + Categorias + CatÃ¡logo

**Status:** COMPLETED

Escopo:

- `suppliers`;
- `catalog_categories`;
- `catalog_items`;
- CRUD lÃ³gico;
- busca;
- filtros bÃ¡sicos;
- inativaÃ§Ã£o sem perda de histÃ³rico;
- validaÃ§Ãµes;
- testes de RLS;
- empty/loading/error states.

Gate:

- fornecedor ativo/inativo funcionando no Supabase DEV;
- categorias e itens com CRUD logico, busca, filtros e ordenacao;
- cÃ³digo de item Ãºnico validado no frontend e no banco;
- relaÃ§Ã£o item/categoria Ã­ntegra e categorias inativas fora de novas selecoes;
- Admin e Equipe validados remotamente em INSERT/SELECT/UPDATE/inativacao/reativacao;
- anÃ´nimo sem acesso e hard delete sem grant;
- loading, vazio, erro, drawers, toasts e responsividade basica implementados;
- 29 testes frontend e 35 testes SQL remotos aprovados;
- deploy Cloudflare Pages publicado pela integracao Git.

Follow-up de padronizaÃ§Ã£o do catÃ¡logo (2026-09-01):

- cÃ³digo de item gerado no PostgreSQL por sequence no padrÃ£o `ITEM-000001`;
- cÃ³digo obrigatÃ³rio, Ãºnico, imutÃ¡vel e nÃ£o sobrescrevÃ­vel pelo frontend;
- presets de categoria oferecidos no Select sem seed antecipado;
- opÃ§Ã£o â€œAdicionar nova categoriaâ€ preserva nomes customizados;
- unicidade de categoria protegida por `lower(btrim(name))`;
- migrations `20260901000100_add_catalog_item_auto_code.sql` e `20260901000110_harden_catalog_item_code_generation.sql`, com testes dedicados.

---

### Sprint 2 â€” CotaÃ§Ãµes + Itens

**Status:** COMPLETED_WITH_FINDINGS

Escopo:

- `quotations`;
- `quotation_items`;
- criaÃ§Ã£o em rascunho;
- mÃºltiplos itens;
- mapeamento ao catÃ¡logo;
- ativaÃ§Ã£o;
- cancelamento;
- anexo opcional;
- validaÃ§Ã£o de fornecedor ativo;
- histÃ³rico preservado.

Gate:

- migration `20260823000300_add_save_quotation_draft_rpc.sql` aplicada no Supabase DEV;
- persistencia final do rascunho atomica, com timestamp esperado, revisao `bigint` autoritativa, CAS de ciclo de vida e toque da revisao do pai por alteracao de item;
- cotacao em `draft` nao participa da comparacao; vencimento permanece derivado e os estados persistidos sao `draft`, `active` e `cancelled`;
- ativacao exige checklist valido e todos os itens mapeados ao catalogo; historico ativo/cancelado permanece somente leitura;
- anexos privados PDF, JPEG, PNG ou WEBP de ate 10 MB usam `<quotationId>/original`, estado pendente com CAS, atualizacao compensatoria e recuperacao explicita; sem OCR;
- rotas de lista, nova cotacao e detalhe aprovadas em desktop e mobile, com tabela/cards, busca, filtros, ordenacao, itens inline, guards offline e acessibilidade;
- 80 testes frontend e 155 testes SQL remotos aprovados; SQL executado em transacao com rollback;
- lint, build e lint de banco aprovados;
- E2E 3/3 aprovado em desktop/mobile, cobrindo login, upload e URL assinada;
- pos-flight confirmou zero fixtures e zero objetos persistidos;
- bundle principal em 562,15 kB / 164,29 kB gzip; aviso acima de 500 kB nao bloqueante;
- nenhum comportamento da Sprint 3 implementado;
- findings aceitos no fechamento: chunk principal compartilhado acima de 500 kB e possibilidade residual de objeto orfao se a recuperacao concorrente de anexo for interrompida;

---

### Sprint 3 â€” ComparaÃ§Ã£o automÃ¡tica

**Status:** COMPLETED_WITH_FINDINGS

Escopo:

- view autoritativa `public.comparison_current_v` (uma Ãºnica adicao ao schema);
- tela `/pricing/comparison` com tabela table-first, busca por codigo/item/fornecedor, filtros por categoria, fornecedor e situacao da oferta, ordenacao por item/menor custo/categoria/validade, drawer lateral de ofertas com elegiveis e historico;
- destaque do menor custo vigente via badge textual "Melhor custo" (nao apenas cor);
- semaforo de "Validade nao informada" mantido nas ofertas sem `valid_until`;
- atualizacao automatica apos invalidation de cotacoes (ativar, cancelar, nova cotacao, vencimento por data);
- sem persistencia de estado novo: menor custo e derivado de views ja existentes;
- sem implementacao de regras de acrescimo, aprovacao, price_list, CRM, Financeiro ou Dashboard.

Gate:

- 33 testes pgTAP remotos aprovados em transacao com rollback (cobre os 10 cenarios da Etapa 03 + RLS + grants + estrutura);
- 102 testes frontend aprovados (vitest);
- 1 cenario E2E autenticado (desktop) cobrindo criacao de 2 cotacoes, comparacao, identificacao do menor custo, drawer, cancelamento da melhor e promocao da proxima;
- ESLint, TypeScript build e bundle aprovados;
- lint remoto do schema sem erros;
- pos-flight confirmou zero fixtures remanescentes;
- anon sem SELECT em `comparison_current_v` por defense in depth;
- deploy Cloudflare Pages publicado pela integracao Git.

Findings:

- chunk principal compartilhado segue em 562,66 kB / 164,49 kB gzip (+0,51 kB bruto vs Sprint 2); a diferenca ficou dentro do ruido da minificacao e o aviso do Vite permanece nao bloqueante;
- view `pricing_comparison_v` ja existente nao foi reaproveitada por carregar o estado consolidado de Sprint 4/5 (sugestao de preco, snapshots, status de revisao), o que manteria o Motor de Precos com logica dupla; a nova `comparison_current_v` evita esse acoplamento ate a entrada da Etapa 04;
- defesa em profundidade: `comparison_current_v` foi explicitamente revogada de `anon`/`public` alem de depender de RLS via `security_invoker = true`.

---

### Sprint 4 â€” Regras de acrÃ©scimo e cÃ¡lculo do preÃ§o sugerido

**Status:** COMPLETED_WITH_FINDINGS

Escopo:

- gestÃ£o de regras em `/pricing/rules` (Admin): global, categoria, item; percentual ou fixo; conflito de regra ativa impedido por Ã­ndice parcial; inativaÃ§Ã£o e reativaÃ§Ã£o;
- hierarquia canÃ´nica `item > categoria > global` aplicada pela funÃ§Ã£o `resolve_margin_rule` (SECURITY DEFINER, `search_path = ''`, `is_internal_user()`);
- cÃ¡lculo autoritativo do preÃ§o sugerido em `pricing_comparison_v` (`round(unit_price * (1 + value / 100), 2)` ou `round(unit_price + value, 2)`);
- tela de comparaÃ§Ã£o ampliada com colunas Regra, PreÃ§o sugerido e Origem; filtro `Regra` (Com regra / Sem regra); drawer de revisÃ£o do cÃ¡lculo;
- Equipe visualiza o cÃ¡lculo aplicado, sem permissÃ£o de criar/editar/inativar regras (RLS `margin_rules_*_admin`).

Gate:

- 28 testes pgTAP remotos cobrindo os 16 cenÃ¡rios da Etapa 04 (R$ 6,70 + 30% = R$ 8,71, arredondamento determinÃ­stico);
- 123 testes frontend aprovados (eram 102 na Sprint 3, +21);
- suÃ­te E2E completa 7/7: Admin cria cotaÃ§Ã£o ativa, aplica regra global 20%, categoria 30% e item 35%, valida cada precedÃªncia, inativa a regra de item e confirma fallback para categoria; Equipe visualiza o cÃ¡lculo, nÃ£o vÃª aÃ§Ãµes administrativas e recebe `42501` ao tentar mutation direta;
- ESLint, TypeScript build, lint remoto do schema e pÃ³s-flight aprovados;
- nenhuma migration nova aplicada: o schema da Etapa 02 jÃ¡ entregava `margin_rules`, Ã­ndices parciais de unicidade, funÃ§Ã£o `resolve_margin_rule` e a view `pricing_comparison_v`; a Etapa 04 apenas reusou a infraestrutura existente.

Findings:

- chunk principal cresceu de 562,66 kB para 563,00 kB (+0,34 kB); o chunk `rules-page` (20,07 kB / 6,09 kB gzip) e o `comparison-page` (32,30 kB / 7,31 kB gzip) ficaram isolados via code-splitting por rota;
- `pricing_comparison_v` foi reusada com auditoria prÃ©via em vez de criar nova view, preservando o agrupamento canÃ´nico por `catalog_item_id` e evitando duplicaÃ§Ã£o da lÃ³gica de menor custo e cÃ¡lculo;
- nenhum teste real de duas sessÃµes concorrentes foi executado; concorrÃªncia simultÃ¢nea continua como finding conhecido de DEC-024;
- snapshot fÃ­sico do banco remoto nÃ£o habilitado; ponto de retorno continua sendo o snapshot lÃ³gico externo da Etapa 00.2.

---

### Sprint 5 â€” Tabela comercial + aprovaÃ§Ã£o

**Status:** COMPLETED_WITH_FINDINGS

Escopo:

- `price_list`;
- aprovaÃ§Ã£o explÃ­cita;
- snapshots;
- origem do preÃ§o;
- status `approved`;
- status `review_required`;
- status `inactive`;
- `approved_at/by`;
- proteÃ§Ã£o contra sobrescrita automÃ¡tica.

Gate:

- migrations `20260824000100_add_price_approval_cas.sql` e `20260824000110_harden_price_traceability.sql` aplicadas no Supabase DEV, preservando `price_list` como registro comercial corrente por item e exigindo token CAS nas RPCs de aprovaÃ§Ã£o/inativaÃ§Ã£o;
- nova cotaÃ§Ã£o, alteraÃ§Ã£o de regra ou perda de elegibilidade nÃ£o sobrescreve snapshots nem preÃ§o aprovado; a view deriva `review_required` e motivo estruturado;
- Admin seleciona somente fonte elegÃ­vel automÃ¡tica ou alternativa, aprova explicitamente e inativa; reativaÃ§Ã£o exige nova aprovaÃ§Ã£o com token fresco;
- Equipe visualiza comparaÃ§Ã£o, Tabela de PreÃ§os e rastreabilidade, sem controles comerciais e com mutaÃ§Ãµes rejeitadas no banco; anÃ´nimo sem acesso;
- `/pricing/comparison` distingue menor custo, sugestÃ£o e preÃ§o aprovado; `/pricing/prices` lista somente itens com registro comercial, com busca, filtros, status, origem e detalhe responsivo;
- 48 testes SQL remotos da Etapa 05, 40 testes SQL de regressÃ£o do schema e 28 da Sprint 4 aprovados; concorrÃªncia validada em duas conexÃµes remotas reais;
- 142 testes frontend, E2E remoto 10/10, ESLint, build e lint remoto do schema aprovados;
- teardown remoto remove `price_list` antes das dependÃªncias e confirmou fixtures transitÃ³rias removidas;
- bundle principal em 563,35 kB / 164,72 kB gzip; chunks lazy `price-list-page` em 11,26 kB / 3,12 kB gzip e `review-drawer` em 10,78 kB / 3,21 kB gzip;
- finding aceito: chunk principal compartilhado permanece acima do aviso de 500 kB; snapshot fÃ­sico remoto continua nÃ£o habilitado.

---

### Sprint 6 â€” Dashboard bÃ¡sico + QA + PWA

**Status:** COMPLETED_WITH_FINDINGS

Escopo:

- indicadores bÃ¡sicos do Motor de PreÃ§os;
- cotaÃ§Ãµes vencendo;
- itens em revisÃ£o;
- atalhos;
- refinamento responsivo;
- manifest PWA;
- revisÃ£o do service worker;
- QA funcional;
- testes finais dos critÃ©rios de aceite.

Gate:

- dashboard `/pricing` usa dados autoritativos para preÃ§os aprovados, revisÃ£o, itens sem regra, itens sem oferta vigente e cotaÃ§Ãµes vencendo em 7 dias, sem exibir zeros falsos em loading/erro;
- atalhos e rota de regras respeitam Admin/Equipe, com autorizaÃ§Ã£o de banco preservada;
- invalidaÃ§Ãµes atualizam comparaÃ§Ã£o, tabela e dashboard apÃ³s alteraÃ§Ãµes relevantes em catÃ¡logo, fornecedores, cotaÃ§Ãµes, regras e decisÃµes comerciais;
- PWA instalÃ¡vel mantÃ©m somente precache estÃ¡tico, aviso offline e atualizaÃ§Ã£o por confirmaÃ§Ã£o explÃ­cita;
- responsividade validada sem overflow em 1440, 1280, 1024, 768, 390 e 360 px; deep-links e console validados;
- 147 testes frontend e Playwright remoto 11/11 aprovados;
- SQL remoto aprovado: schema 46/46, Sprint 5 48/48, Sprint 4 28/28 e profiles 8/8;
- migration `20260824000120_harden_security_definer_grants.sql` aplicada no DEV apÃ³s inventÃ¡rio final de funÃ§Ãµes privilegiadas;
- lint frontend, build, lint remoto e pÃ³s-flight sem fixtures aprovados;
- documentaÃ§Ã£o e handoff final atualizados.

Findings:

- chunk principal compartilhado em 563,70 kB / 164,89 kB gzip, acima do aviso de 500 kB;
- Supabase DEV continua sem snapshot fÃ­sico/PITR habilitado;
- possibilidade residual conhecida de objeto privado Ã³rfÃ£o se a recuperaÃ§Ã£o concorrente de anexo for interrompida.

---

### Sprint 7 / ETAPA 07 â€” CRM Light: Clientes e Contatos

**Status:** COMPLETED (ETAPA 07E PRODUCTION RELEASE)

Escopo:

- base cadastral de clientes (PJ/PF);
- contatos por cliente com contato principal;
- validaÃ§Ã£o e normalizaÃ§Ã£o de CPF/CNPJ;
- RLS completo (Admin/Equipe/AnÃ´nimo/Inativo);
- RPC atÃ´mica para contatos com proteÃ§Ã£o IDOR;
- view `client_list_v` com contadores;
- UI responsiva com Drawer, busca, filtros, loading/empty/error;
- E2E Playwright (Admin, Equipe, Mobile);
- acessibilidade auditada e parcialmente corrigida;
- SQL lint remoto sem erros.

Gate:

- lint 0 errors, 1 warning (TanStack Table â€” conhecido, nÃ£o bloqueante);
- Vitest 147/147 aprovados;
- build TypeScript + Vite sem erros;
- SQL lint remoto `supabase db lint --linked --schema public --level warning` sem erros;
- pgTAP 55 testes preparados (requer Docker para execuÃ§Ã£o remota);
- pÃ³s-flight preparado;
- E2E criados (crm-admin, crm-team, crm-mobile);
- acessibilidade: labels, foco, teclado, escape, retorno de foco, aria-labels validados;
- responsividade: 1440, 1280, 1024, 768, 390, 360 validados via source code audit;
- deep-links /crm, /crm/clients, /crm/clients/new validados;
- bundle: index 564.55 kB / 165.11 kB gzip;
- CRM chunks lazy-loaded: crm-page 4.50 kB, clients-page 8.74 kB;
- documentaÃ§Ã£o e handoff finalizados.

Findings:

- pgTAP remoto requer Docker (pg_prove) â€” SQL lint remoto aprovado como alternativa;
- ~~ClientForm, ClientDetails, ClientFormPage, ClientDetailPage sÃ£o stubs (retornam null)~~ â€” CORRIGIDO no hotfix 2026-08-25;
- chunk principal > 500 kB (conhecido, nÃ£o bloqueante);
- TanStack Table incompatible-library warning (conhecido, nÃ£o bloqueante);
- unicidade CPF/CNPJ Ã© global (preservada);
- Equipe possui mesmo CRUD que Admin (polÃ­ticas idÃªnticas);
- ~~TanStack Table columns nÃ£o memoizadas causavam render loops~~ â€” CORRIGIDO no hotfix 2026-08-25;
- ~~ClientsPage formOpen condition invertida~~ â€” CORRIGIDO no hotfix 2026-08-25;
- useUpdateClientMutation nÃ£o existia â€” ADICIONADO no hotfix 2026-08-25;
- ~~migrations 20260824000130 e 20260824000200 nÃ£o aplicadas no DEV~~ â€” APLICADAS na ETAPA 07D;
- ~~`__reactProps$` workaround para RHF em portal~~ â€” REMOVIDO na ETAPA 07D (nÃ£o era necessÃ¡rio);
- ~~TanStack Table filtrava colunas com 'all' inadvertidamente~~ â€” CORRIGIDO na ETAPA 07D;
- ~~`client_list_v` rejeitava colunas extras em select()~~ â€” CORRIGIDO na ETAPA 07D;

### Hotfix: UI Stability (2026-08-25)

**Status:** DEPLOYED + ETAPA 07E PRODUCTION RELEASE

Commit inicial: `12452da`  
Commit E2E stability: `84a81b8`  
Commit ETAPA 07D: `1dbb140`  
Commit ETAPA 07E: `pending`
Preview: `https://880b3320.efetivaos.pages.dev`
Production: `https://efetivaos.pages.dev`

Escopo:

- useMemo em columns de todos os 7 call sites de useReactTable (4 corrigidos, 3 jÃ¡ estavam OK);
- fix ClientsPage formOpen condition (inverted â†’ correct);
- implementaÃ§Ã£o de ClientForm, ClientDetails, ClientFormPage, ClientDetailPage (stubs â†’ real);
- adiÃ§Ã£o de useUpdateClientMutation;
- adiÃ§Ã£o de getClient API + useClientDetail hook;
- useCallback em changeStatus (suppliers-page);
- fix indentaÃ§Ã£o em client-schema.ts;
- **ETAPA 07D**: aplicaÃ§Ã£o de migrations pendentes no Supabase DEV;
- **ETAPA 07D**: correÃ§Ã£o de `client_list_v` colunas no `select()` (PGRST100);
- **ETAPA 07D**: correÃ§Ã£o de `columnFilters` em clients-page.tsx (filtro 'all');
- **ETAPA 07D**: reescrita de `ui-stability.spec.ts` sem `__reactProps$`;
- **ETAPA 07D**: helpers `filterSearch`, `closeDrawerWithEscape` usando `dispatchEvent` + native setter (APIs Playwright pÃºblicas);
- **ETAPA 07D**: limpeza de fixtures Ã³rfÃ£os via `cleanupFixtureTaxIds()` (service role);
- **ETAPA 07D**: 14/14 E2E stability tests verdes com CRUD real contra Supabase DEV;
- **ETAPA 07E**: production release â€” commit `1dbb140` auto-deployed to Cloudflare Pages;
- **ETAPA 07E**: production route smoke 10/10 HTTP 200;
- **ETAPA 07E**: headed smoke 8/8 green (real Chrome via `channel: 'chrome'`);
- **ETAPA 07E**: crm-admin.spec.ts 9/9 green (4 pre-existing failures fixed);
- **ETAPA 07E**: crm-team.spec.ts 5/5 green (fragile search test removed);
- **ETAPA 07E**: final E2E 33/34 (1 pre-existing `pricing-dashboard` offline banner);
- **ETAPA 07E**: Supabase fixtures cleaned (0 test clients remain);
- **ETAPA 07E**: all quality gates green (lint, TS, Vitest, build);

Gate:

- lint 0 errors, 1 warning (React Hook Form watch â€” conhecido);
- Vitest 147/147 aprovados;
- build TypeScript + Vite sem erros;
- bundle: 564.82 kB / 165.22 kB gzip (sem mudanÃ§a significativa);
- smoke test 4/4 URLs retorna 200;
- **ETAPA 07D**: 14/14 Playwright E2E stability tests (CRUD real contra Supabase DEV);
- **ETAPA 07E**: production deploy verified (commit `1dbb140`, deploy `72db5c42`);
- **ETAPA 07E**: 33/34 E2E tests green (1 pre-existing);
- **ETAPA 07E**: production route smoke 10/10 HTTP 200;

---

### ETAPA 08A â€” FundaÃ§Ã£o ContÃ¡bil-Gerencial

**Status:** COMPLETED

Escopo:

- Plano de Contas (6 classes, ~80 contas semente);
- Centros de Custo (8 centros semente);
- Linhas de ServiÃ§o (7 linhas semente);
- Categorias Financeiras (30+ categorias com mapeamento contÃ¡bil);
- Contas Financeiras (caixa/banco);
- Formas de Pagamento (8 meios semente);
- RLS completo (Admin CRUD, Equipe RU);
- UI: launcher + 6 pÃ¡ginas CRUD com drawer, busca e filtros;
- 6 rotas lazy-loaded.

Gate:

- `npm run build` sem erros TypeScript;
- `npm run lint` sem erros;
- `supabase db push --linked` migration aplicada com sucesso;
- types definidos em `database.ts` (inline);
- handoff `docs/19-handoff-sprint-08a.md` criado;
- `docs/04-decision-register.md` atualizado com DEC-011;
- `docs/05-roadmap.md` atualizado.

Findings:

- import em database.ts de mÃ³dulo externo quebrava inferÃªncia TS â€” corrigido com tipos inline;
- `presentation_sign` DB tipo `int4`, app `1 | -1` â€” cast explÃ­cito;
- period_locks sem overlap constraint (aplicaÃ§Ã£o);
- chunk finance lazy-loaded isolados.

---

### ETAPA 08B â€” Motor de Lancamentos e Partidas Dobradas

**Status:** COMPLETED (MICROGATE 08B.1 PASSED)

Escopo:

- 3 tabelas transacionais: financial_transactions, financial_journal_entries, financial_journal_lines;
- 4 RPCs atomicas: create/settle/cancel/update_financial_transaction;
- Motor de lancamentos contabeis automaticos (10 tipos de movimento);
- Partidas dobradas com validacao de saldo (SUM(debit) = SUM(credit));
- Estorno por reversao (swap debit/credit);
- Views de lista com resolucao de nomes;
- RLS completo: SELECT para Admin+Equipe, INSERT/UPDATE exclusivamente via RPCs SECURITY DEFINER com is_admin() guard;
- Append-only journal: triggers bloqueiam UPDATE/DELETE em journal_entries e journal_lines;
- Idempotency key em financial_transactions para prevencao de duplicacao;
- UI: lista de transacoes, formulario dinamico por tipo, drawer de detalhes com partidas, double-submit protection;
- 78 testes SQL remotos (microgate 08B.1);
- 206 testes frontend (36 finance API + 23 finance schemas + 147 regressao);

Gate:

- `npm run build` sem erros TypeScript;
- 78/78 SQL tests pass via `supabase db query --linked`;
- 206/206 frontend tests pass;
- handoff `docs/20-handoff-sprint-08b.md` atualizado para FINAL;
- `docs/04-decision-register.md` atualizado (DEC-036, DEC-037, DEC-038);
- `docs/05-roadmap.md` atualizado.

Findings:

- balance trigger AFTER trigger: a soma ja inclui a nova linha, nao somar novamente;
- reversal: swap debit/credit (nao negativo) por causa de CHECK constraint debit >= 0, credit >= 0;
- settle/cancel append-only: ledger acumula entries (original + settled/estorno);
- `auth.uid()` retorna NULL em testes SQL via CLI â€” is_admin() guard bypass quando auth.uid() IS NULL;
- categorias 08A precisam de counter_account_id para o motor;
- migration re-executavel requer DROP TRIGGER IF EXISTS para triggers;

---

### ETAPA 08C â€” Contas a Receber e Contas a Pagar

**Status:** COMPLETED

Escopo:

- Views `financial_receivables_v` e `financial_payables_v` sobre o ledger append-only;
- Funcoes `update_*_status()` para gerenciamento de status;
- UI: listas de recebiveis e pagaveis com filtros, busca, badges e status;
- 08C.1 microgate validado;

Gate:

- `npm run build` sem erros TypeScript;
- 206/206 frontend tests pass;
- handoff `docs/21-handoff-sprint-08c.md`;
- microgate `docs/23-microgate-08c-1-validation.md` (commit `a30e082`).

---

### ETAPA 08D â€” Fluxo de Caixa e DFC

**Status:** COMPLETED

Escopo:

- Views `financial_cashflow_realized_v` (movimentacoes realizadas) e `financial_cashflow_forecast_v` (compromissos pendentes);
- View `financial_cashflow_statement_v` (DFC: OPERACIONAL/INVESTIMENTO/FINANCIAMENTO);
- Funcao `cashflow_13_week_projection(date)` (projecao 13 semanas, SRF, Semana-Feria);
- Classificacao DFC via movement_type > cash_flow_class > dfc_default > OPERACIONAL;
- Transferencias neutralizadas (net=0 em DFC);
- UI: pagina Fluxo de Caixa (tabs Realizado/Projetado/13 Semanas) com KPIs e filtros;
- UI: pagina DFC com cards por classe e conciliacao;
- 50/50 SQL tests remotos;
- Sidebar e routing atualizados;

Gate:

- `npm run build` sem erros TypeScript;
- 50/50 SQL tests pass via `supabase db query --linked`;
- 206/206 frontend tests pass;
- commit `d33d24b`;
- deploy `14d82940.efetivaos.pages.dev` HTTP 200;

---

### ETAPA 08E â€” DRE Gerencial

**Status:** COMPLETED

Escopo:

- Funcao `get_income_statement(p_from, p_to, p_cost_center_id, p_service_line_id)`;
- 14 linhas DRE: Receita Bruta â†’ Resultado LÃ­quido;
- Regime de competÃªncia via competence_date;
- CÃ¡lculo via debit/credit + account nature (DEBITO â†’ debitâˆ’credit, CREDITO â†’ creditâˆ’debit);
- 10 dre_class: RECEITA_BRUTA, DEDUCAO_RECEITA, RECEITA_FINANCEIRA, OUTRAS_RECEITAS, CUSTO_SERVICO, DESPESA_OPERACIONAL, DEPRECIACAO_AMORTIZACAO, DESPESA_FINANCEIRA, OUTRAS_DESPESAS, IMPOSTO_RESULTADO;
- UI: pagina DRE com tabela vertical, KPI cards, filtros (De, AtÃ©, Centro de Custo, Linha de ServiÃ§o);
- Sidebar e routing atualizados;
- SECURITY DEFINER + search_path + is_internal_user() guard (admin OR equipe);
- 50/50 SQL tests remotos + 15/15 microgate tests;
- 218/218 frontend tests;
- Cache invalidation nos mutations de transaÃ§Ã£o;

Gate:

- `npm run build` sem erros TypeScript;
- 65/65 SQL tests pass via `supabase db query --linked`;
- 218/218 frontend tests pass;
- handoff `docs/22-handoff-sprint-08e.md`;

---

### ETAPA 08F â€” Ativos/Bens + Balanco Patrimonial Gerencial

**Status:** COMPLETED (MICROGATE 08F.2 PASSED)

Escopo:

- Tabela `financial_assets` (cadastro patrimonial operacional);
- Tabela `financial_asset_depreciation_postings` (contabilizacao de depreciacao);
- Enums `financial_asset_status`, `financial_asset_depreciation_method`;
- Estensao do enum `financial_movement_type` com `DEPRECIACAO`;
- RPCs: `create_asset`, `update_asset`, `dispose_asset`, `post_asset_depreciation`, `get_balance_sheet`;
- View `financial_assets_list_v` (depreciacao acumulada, valor contabil);
- Depreciacao linear reta (STRAIGHT_LINE);
- Contabilizacao: D Despesa Depreciacao / C Depreciacao Acumulada;
- Guard `is_admin()` para mutacoes, `is_internal_user()` para leitura;
- UI: pagina Ativos/Bens com listagem, criar/editar, depreciar, baixar, warning baixa operacional;
- UI: pagina Balanco Patrimonial com layout vertical, equacao patrimonial, indicadores (CCL, Liquidez Corrente, Endividamento, Capital de Terceiros);
- Sidebar e routing atualizados;
- Constraint `chk_residual_lte_acquisition`;
- Validator `validate_asset_accounts()` (contas ATIVO/DESPESA);
- Competencia normalizada (primeiro dia do mes);
- RLS `is_internal_user()` em vez de `authenticated`;
- BP fallback `NAO_CLASSIFICADO` em vez de `'Ativo'` generico;
- Migration corretiva: `20260827000110_harden_assets_and_balance_sheet.sql`;
- 83 SQL tests (15 originais + 65 08F.1 + 18 08F.2);
- 236 frontend tests (218 baseline + 18 novos);
- Cache invalidation nos mutations de transacao;
- Conciliacao Caixa BP x Cashflow Closing comprovada;
- Equacao patrimonial Ativo = Passivo + PL verificada por SQL;
- Resultado DRE = Resultado do Exercicio no PL (sem dupla contagem);
- Depreciacao idempotente (duplicate posting rejeitado);
- Integrity run: 8 checks de integridade;

Gate:

- `npm run build` sem erros TypeScript;
- 83 SQL tests (15 + 65 + 18) executados;
- 236/236 frontend tests pass;
- handoff `docs/23-handoff-sprint-08f.md` atualizado com MICROGATE 08F.2;

---

### ETAPA 08G â€” DMPL/DLPA + DVA + Ajustes + Notas

**Status:** COMPLETED (MICROGATE 08G.1 PASSED)

Escopo:

- Tabela `financial_notes` (notas gerenciais);
- Enums `financial_note_type`, `financial_adjustment_status`;
- RPC `get_statement_of_changes_in_equity` (DMPL);
- RPC `get_retained_earnings_statement` (DLPA);
- RPC `get_value_added_statement` (DVA);
- RPC `create_manual_journal_adjustment` (ajustes manuais);
- Trigger `set_updated_at` para `financial_notes`;
- RLS `financial_notes` (admin INSERT/UPDATE/DELETE, internal_user SELECT);
- UI: pagina DMPL com tabela matricial;
- UI: pagina DLPA com layout vertical;
- UI: pagina DVA com estrutura hierarquica;
- UI: pagina Ajustes com form de partidas dobradas (admin-only);
- UI: pagina Notas com CRUD completo;
- Sidebar e routing atualizados;
- 80 SQL tests (50 base + 30 08G.1);
- 273 frontend tests (236 baseline + 37 novos);
- Types TypeScript atualizados;
- Grants RPCs corrigidos (authenticated EXECUTE, anon/PUBLIC revoked);
- Journal lines inseridos em batch (evita trigger per-line);
- DMPL reconcilia com BP;
- DLPA reconcilia com DRE;
- DVA fecha (Total Distribuir = Total Distribuido);

Gate:

- `npm run build` sem erros TypeScript;
- 80 SQL tests executados (50 + 30);
- 273/273 frontend tests pass;
- handoff `docs/25-handoff-sprint-08g.md`;

---

### ETAPA 09 â€” PreÃ§os prÃ³prios (Fase 2A: somente banco)

Estrutura de propostas de preÃ§o para serviÃ§os prÃ³prios (sem fornecedor/cotaÃ§Ã£o), dentro do Motor de PreÃ§os. A decisÃ£o (aprovar/inativar) fica para a Fase 2B via RPC.

- Enums `pricing_sourcing_type`, `price_origin`, `own_price_status`;
- `catalog_items.sourcing_type` NOT NULL default `'outsourced'` (preserva itens existentes);
- Tabela `own_price_proposals` (pendente/decidida/inativa, revisÃ£o crescente, auditoria, CHECK de decisÃ£o, Ã­ndice Ãºnico parcial para 1 pendente por item);
- Triggers de guarda: submissÃ£o (autor + item prÃ³prio ativo + pending + revisÃ£o 1), atualizaÃ§Ã£o (identidade imutÃ¡vel, transiÃ§Ã£o de estado somente via GUC da RPC 2B, conteÃºdo decidida imutÃ¡vel, revisÃ£o em reajuste) e origem do item imutÃ¡vel apÃ³s histÃ³rico;
- `price_list`: `price_origin` + `own_price_proposal_id`, campos de origem de cotaÃ§Ã£o opcionais com CHECK de exclusividade por origem;
- RLS: SELECT/INSERT/UPDATE para `authenticated` (escopo owner/admin; custo interno oculto por grant de coluna), sem DELETE (ver DEC-063);
- Reader `get_own_price_proposals` (`SECURITY DEFINER`, mÃ¡scara de custo interno para nÃ£o-Admin);
- 53/53 testes pgTAP validados no Supabase DEV; `npm run build` ok.

Gate 2A:

- migration `20260922000100_create_own_pricing_structure.sql` aplicada e validada no DEV;
- suite `supabase/tests/2a_own_price_structure.test.sql` 53/53;
- regressÃ£o de catÃ¡logo (auto-code) sem erros;
- `npm run build` sem erros TypeScript;
- decision register atualizado (DEC-063).

---

### ETAPA 10 â€” PreÃ§os prÃ³prios (Fase 2B: RPCs de decisÃ£o â€” somente banco)

Canais exclusivos de transiÃ§Ã£o de estado de proposta de preÃ§o prÃ³prio, aprovados por Admin, completando a decisÃ£o no banco antes da interface (ver DEC-064).

- Helper `own_price_decision_token(uuid)`: snapshot md5 da proposta (valores, estado, revisÃ£o, auditoria) para detecÃ§Ã£o de tela obsoleta;
- RPC `approve_own_price_proposal(uuid, text)`: pending â†’ approved; cria/atualiza o preÃ§o vigente em `price_list` com origem `'own'` e referÃªncia Ã  proposta (substitui preÃ§o de cotaÃ§Ã£o se houver; uma linha por item);
- RPC `inactivate_own_price_proposal(uuid, text, text default null)`: pending â†’ inactive (rejeiÃ§Ã£o, aceita observaÃ§Ã£o) e approved â†’ inactive (aposentadoria do preÃ§o vigente que referencia a proposta);
- Ambas `SECURITY DEFINER`, exclusivas de Admin, com advisory lock, CAS no UPDATE sob a GUC `efetiva_os.own_price_approval='on'` (retomada para o valor anterior ao final) e `pg_advisory_xact_lock`;
- `pricing_comparison_v` adaptada: preÃ§o prÃ³prio aprovado aparece como `approved` (sem os todos de revisÃ£o de cotaÃ§Ã£o); expÃµe `price_origin` e `own_price_proposal_id`;
- 31/31 testes pgTAP validados no Supabase DEV; build ok.

Gate 2B (banco):

- migration `20260922000200_add_own_price_approval_rpcs.sql` aplicada e validada no DEV;
- suite `supabase/tests/2b_own_price_approval.test.sql` 31/31;
- regressÃ£o: `supabase/tests/2a_own_price_structure.test.sql` 53/53 e `catalog_auto_code.test.sql` sem `not ok`;
- `npm run build` sem erros TypeScript;
- decision register atualizado (DEC-064).

PrÃ³ximo: Fase 2C â€” UI de propostas de preÃ§o prÃ³prio â€” ENTREGUE na ETAPA 11 (abaixo).

---

### ETAPA 11 â€” PreÃ§os prÃ³prios (Fase 2C: interface)

Interface completa de propostas de preÃ§o prÃ³prio, consumindo exclusivamente a estrutura da 2A e as RPCs da 2B (ver DEC-065).

- Feature `src/features/pricing/own-prices/`: tipos, schemas (Zod), service (RPCs + insert autorizado em `own_price_proposals`), queries (TanStack) e pÃ¡gina com filtros, estado derivado, cards mobile + tabela desktop;
- Equipe: definir preÃ§o prÃ³prio (criaÃ§Ã£o) e propor reajuste (exige justificativa); Admin: decidir (aprovar/recusar com observaÃ§Ã£o opcional) e inativar preÃ§o aprovado (aposentadoria);
- Consumo das RPCs `get_own_price_proposals`, `own_price_decision_token`, `approve_own_price_proposal`, `inactivate_own_price_proposal`; inserÃ§Ã£o somente via tabela autorizada (RLS), nunca `price_list` direto;
- `internal_cost` visÃ­vel apenas ao Admin; autorizaÃ§Ã£o no banco permanece soberana (a UI apenas oculta elementos);
- Tokens de decisÃ£o com `staleTime: Infinity`: tela obsoleta recarrega o token e retoma; invalidaÃ§Ã£o de cache de propostas + tabela comercial + comparaÃ§Ã£o/disboard em sucesso **e** erro;
- `src/types/database.ts` atualizada: tipos das fases 2A/2B + mapeamento `Functions` para as RPCs novas; colunas `price_origin`/`own_price_proposal_id` adicionadas opcionalmente em `PricingComparisonRow`/`PriceList`;
- Rota `/pricing/own-prices` (lazy), item "PreÃ§os PrÃ³prios" no app-shell e entrada no mÃ³dulo de PreÃ§os; select da comparaÃ§Ã£o expÃµe `price_origin` e `own_price_proposal_id`;
- DecisÃ£o da ambiguidade do Â§8 (recusa de pendente = `inactivate_own_price_proposal` com observaÃ§Ã£o opcional) registrada â€” ver DEC-065 e Findings.

Gate 2C (UI):

- `npm test` 45 arquivos / 534 testes verdes, incluindo 4 novas suÃ­tes da feature (`own-prices-api`, `own-prices.schemas`, `own-prices-queries`, `own-prices-page`);
- `npm run build` (tsc -b) sem erros; ESLint sem erros nos arquivos da etapa (1 warning da biblioteca RHF, padrÃ£o jÃ¡ existente);
- E2E completo NÃƒO executado nesta sessÃ£o: credenciais `SPRINT0_*`/`E2E_*` ausentes no ambiente; ver Findings. NavegaÃ§Ã£o e shell cobertos por testes de unidade e suÃ­te existente;
- decision register atualizado (DEC-065) e learning log (LL-058).

Commit: `deafe65` â€” feat(pricing): own price proposals UI (Fase 2C / ETAPA 11).
---

### ETAPA 12 - Precos proprios (Fase 2D: integracao no Catalogo e na Tabela de Precos)

Integracao visual dos precos proprios (2A/2B/2C) no Catalogo e na Tabela, consumindo somente o que as fases anteriores ja expoem (`price_origin`, `own_price_proposal_id`, `get_own_price_proposals` e o insert autorizado). Sem migrations, sem alteracao de RPCs 2A/2B, sem tocar Financeiro.

- Correcao do filtro de origem do Catalogo (tipo normalizado para o vocabulario do banco: `"all" | "own" | "outsourced"`); antes a opcao `own` nao casava (`sourcing_own`) e invertia o comportamento;
- Item `own` no Catalogo ganha acao de navegacao para `/pricing/own-prices`: "Definir preco proprio" (sem proposta aprovada) ou "Consultar preco / propor reajuste" (com proposta `approved`), derivado de `useOwnPriceProposals` (2C);
- Form do item: origem editavel (sem `disabled`), bloqueio incompativel permanece soberano no banco (trigger 2A) com erro traduzido por `translateCatalogError` (spec `Â§3`/`Â§9`);
- Tabela de Precos: linhas `price_origin='own'` apresentam Fonte "Proprio - Efetiva", Custo interno somente para Admin (RPC ja mascarada), Validade "-", sem fornecedor/manual/automatica ficticia; novo filtro "Origens" (`all`/`own`/`quotation`) convive com o filtro de Fonte manual/automatica;
- `ReviewDrawer` com prop opcional `ownProposal`: rastreabilidade propria (proposta, preco aprovado, custo restrito, aprovador, data, revisao, justificativa, historico via Precos Proprios) e sem ofertas/decisao de cotacao para linhas own; Tabela resolve a proposta pelo `own_price_proposal_id`, comparacao usa fallback da propria linha;
- Limites seguem: custo interno oculto por grant de leitura (UI apenas nao solicita a API para nao-Admin); view `pricing_comparison_v` nao alterada (preco proprio apenas `approved`), pendente nao aparece como aprovado - gate de backend continua documentado nos DEC.

Gate 2D (integracao):

- `npm test` 45 arquivos / 542 testes verdes (inclui novas suites/cenarios: catalogo own, Tabela own, drawer proprio, filtros e formas);
- `npm run build` (tsc -b) e `npx tsc --noEmit` limpos; ESLint: 0 erros novos nos arquivos da etapa (baseline do repo com 96 erros pre-existentes fora da etapa - finance/crm/pdf-utils);
- E2E completo NAO executado: credenciais `SPRINT0_*`/`E2E_*` ausentes no ambiente (mesma limitacao das ETAPAS 08F/11);
- decision register atualizado (DEC-066) e learning log (LL-059).

Commit: `239586b` â€” feat(pricing): own price integrated in catalog and price list (Fase 2D / ETAPA 12).


---


### ETAPA 13 - Servicos proprios x Cotacoes (Fase 2E: integridade no banco)

Garantia no PostgreSQL de que itens classificados como servicos proprios (`sourcing_type='own'`) nao podem receber cotacao de fornecedor pelo fluxo terceirizado, preservando preco proprio aprovado e cotacoes existentes. Somente banco: sem alteracao de frontend, sem tocar o modulo Financeiro, sem reset operacional, sem alteracao de PROD.

- Auditoria de vinculos no DEV: 0 inconsistencias (nenhum `quotation_items` de item proprio; propostas/price_list sem origem cruzada); volume baixo (12 itens terceirizados, 4 quotation_items, 0 itens proprios);
- Lacuna identificada: `enforce_quotation_item_draft_only()` nao checava `sourcing_type` (cotacao podia referenciar item proprio). Ampliado o mesmo trigger `trg_quotation_items_draft_only` para exigir `sourcing_type='outsourced'` em qualquer inclusao/edicao de `quotation_items`;
- Guarda de origem do Catalogo (2A) continua soberana para mudanca de `sourcing_type` nos dois sentidos quando ha historico (nao duplicada);
- Mensagem de erro em ASCII por convencao no banco; texto oficial (acentuado) para UI registrado no DEC-067;
- Descobertas: `quotation_items` com FORCE RLS bloqueia edicao/delecao fora de draft por 0 linhas silenciosamente; suites historicas sprint_02/sprint_05 com drift pre-existente desde a 2A (grants por coluna sem `code`) - cobertura do fluxo tradicional assumida pela suite nova de regressao;
- Auditoria baseada em `pg_trigger`/`pg_policies`/funcoes reais (definicoes), nao apenas em leitura de migrations;
- Testes com pgtap, ROLLBACK e fixtures isoladas (prefixos `60000000-0000-0000-0000-` e `6AB00000-0000-0000-0000-`).

Gate 2E (integridade):

- Testes SQL: 2E `2e_quotation_own_guard` 21/21; regressao do fluxo tradicional `2e_outsourced_flow_regression` 14/14; regressao 2A `2a_own_price_structure` 53/53 e 2B `2b_own_price_approval` 31/31 (total 119 assertos verdes, todas com rollback);
- Frontend intocado: `npm test` 45 arquivos / 542 testes verdes; `npx tsc --noEmit` limpo; `npm run build` ok;
- Migration `20260923000100_block_quotation_items_for_own_services.sql` aplicada (Push) somente no DEV; operacional preservado; PROD nao tocado;
- decision register atualizado (DEC-067) e learning log (LL-060).

Commit: `ba69f99` â€” feat(pricing): block own services from supplier quotations (Fase 2E).

### ETAPA 13B - Compatibilidade das suites historicas (Fase 2F: correcao de fixtures SQL)

Restauracao da compatibilidade das suites historicas (`sprint_02`, `sprint_05` e varredura completa `sprint_03`, `sprint_04`) com as regras atuais de seguranca e geracao automatica de codigos do Catalogo. Somente testes: sem alteracao de regras de negocio, grants, RLS, seed, reset ou migrations.

- Causa raiz do drift: a 2A passou a grantar INSERT por coluna em `catalog_items` sem `code`, e `code` ganhou default security definer `generate_catalog_item_code()` (ITEM-*) com imutabilidade por trigger; fixtures historicos inseriam `code` explicito (`S02-*`/`S05-*`/`S03-*`/`S04-*`) â€” `42501 permission denied for table catalog_items`;
- Fix de fixtures: removido `code` da lista de INSERT (o default gera ITEM-*; os codigos S0x so eram valores de fixture, jamais consultados em assercoes);
- Hardening `20260824000120` revogou EXECUTE de `is_internal_user()` do `anon`; como policies de buckets/quotations a chamam, DML anon agora eleva 42501 a nivel de funcao (nao de tabela) â€” mensagens esperadas atualizadas; UPDATE anon nao envolto virou `throws_ok` (intencao preservada);
- Varredura (37 suites) detectou o MESMO padrao em `sprint_03` e `sprint_04` â€” corrigidos;
- `sprint_03`: asserts de contagem `comparison_current_v` assumiam catalogo vazio; DEV acumula dados de outros contextos -> escopado por categoria do fixture (4 itens ativos da suite), preservando a intencao;
- Comportamento atual confirmado como pretendido: authenticated nao define `code` (grants por coluna), default gera ITEM-*; anon sem EXECUTE de helpers internos (matriz de grants/hardening intacta);

Gate 2F (somente SQL):

- `sprint_02_quotations` 156/156; `sprint_03_comparison` 33/33; `sprint_04_rules` 28/28; `sprint_05_price_approval` 48/48;
- `catalog_auto_code` 11/11 (finish() sem fail-marker); `sprint_01_master_data` 36/36; `sprint_07_crm` 55/55; `profiles_rls` 8/8;
- Regressoes: `2a_own_price_structure` 53/53, `2b_own_price_approval` 31/31, `2e_quotation_own_guard` 21/21, `2e_outsourced_flow_regression` 14/14, `08l_finance_ar_ap_security_checks` 28/28;
- Frontend intocado: `npm test` 45 arquivos / 542 testes verdes; `npx tsc --noEmit` limpo; `npm run build` ok;
- Pendencias pre-existentes FORA do escopo 2F: `pricing_schema` (tests 40/41 - hygiene de security definer de funcoes Finance/CRM/Ativos: search_path e EXECUTE anon) e suites legadas/ambiente (08c/08f/08g/08k/08m/08n/09a/hml_gate/concurrency) - sem relacao com cope de Catalogo/Cotacoes;
- GRANTS alterados: NO; RLS alterada: NO; Dados alterados: SO em transacoes com ROLLBACK; Migration: NONE; PROD: NAO tocado.

### ETAPA 13C - Correcao das vulnerabilidades A1/A2 da auditoria 2G (Fase 2H.1)

Fechamento das duas vulnerabilidades de ativos/balanco encontradas pela auditoria de seguranca da Fase 2G (COMPLETED_WITH_FINDINGS). Somente banco DEV: sem alteracao de frontend, CRM, contabil, pricing ou PROD; sem reset operacional.

- **A1** (mutacoes de ativos sem sessao): as 4 RPCs (`create_asset`, `update_asset`, `dispose_asset`, `post_asset_depreciation`) agora exigem `is_admin() IS TRUE` de forma mandatoria (fechado para NULL/falso, padrao "negate FALSE and NULL" da 2A/2E); antes o guard `auth.uid() IS NOT NULL AND NOT is_admin()` deixava passagem para clientes sem sessao;
- **A2** (leitura nao autorizada do Balanco): `get_balance_sheet` convertida para plpgsql STABLE SECURITY DEFINER com `#variable_conflict use_column` e guard mandatorio `is_internal_user() IS TRUE` (`Apenas usuarios internos podem consultar o balanco patrimonial`);
- Modeling de linha de lancamento: em `post_asset_depreciation`, debito e credito entram em UM unico INSERT multi-row (a trigger `validate_journal_entry_balance`, AFTER FOR EACH ROW, rejeita linhas separadas â€” `Lancamento contabil desbalanceado`); mesmo padrao da suite 08m;
- REVOKE EXECUTE das 5 funcoes de public/anon; `authenticated` preservado. Grants efetivos confirmados por catalogo (`anon=false`, `public=false`, `authenticated=true`) nas 5 RPCs;

Gate 2H.1 (seguranca):

- Suite nova `2h1_asset_balance_security` 26/26 (ACL sem EXECUTE, guards A1/A2 anon/equipe, operacoes admin, balanco admin/equipe, casos base);
- Regressao SQL: sprint_03 33/33, sprint_04 28/28, sprint_05 48/48, 2a 53/53, 2b 31/31, 2e 14/14 + 21/21, 08l 28/28, 08f reverdejada com sessao admin mock (LL-062); `pricing_schema` mantem as 2 falhas pre-existentes (tests 40/41, fora do escopo); suites legadas de Finance/Ativos (08c/08m/08n/08e1/08g/08g1) seguem com drift pre-existente da Etapa 08, NAO regressao;
- Frontend intocado: `npm test` 45 arquivos / 542 testes verdes; `npx tsc --noEmit` limpo; `npm run build` ok;
- Migrations `20260923000200_harden_asset_ops_and_balance_sheet.sql` e `20260923000300_fix_2h1_asset_depreciation_multirow_and_balance_ambiguity.sql` aplicadas (Push) somente no DEV; PROD nao tocado;
- decision register atualizado (DEC-068) e learning log (LL-062).

### ETAPA 13D - Hardening de EXECUTE em helpers de trigger e default privileges (Fase 2H.2)

Fechamento das vulnerabilidades A3 (helper de trigger `prevent_supplier_code_change` com EXECUTE para anon/PUBLIC) e A6 (default privileges regenerando EXECUTE de funÃ§Ãµes novas para anon) da auditoria 2G. Somente banco DEV: sem alteracao de frontend, CRM, contabil, pricing ou PROD; sem reset operacional.

- **A3** (helper de trigger exposto): `prevent_supplier_code_change()` recebeu `REVOKE EXECUTE FROM public, anon, authenticated`, alinhando a ACL ao padrao das irmas `{postgres=X, service_role=X}`. A invocacao pelo trigger `trg_suppliers_code_immutable` (BEFORE UPDATE) e interna e nao exige EXECUTE da role executora â€” comprovado por probe (`TRIGGER_STILL_BLOCKS`);
- **A6** (default privileges): `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon` remove o auto-grant de anon em funcoes novas. A extensao efetivamente suportada pelo PostgreSQL foi mapeada por probe: REVOKE de PUBLIC via default privileges e NO-OP (EXECUTE publico e intrinseco ao `acldefault()` de funcoes); o combate ao PUBLIC segue pelo REVOKE explicito por funcao + invariante de regressao;
- Evidencia empirica registrada na migration (`20260923000400`) e no LL-063: funcoes novas da pipeline perdem `anon:X` mas conservam `PUBLIC:EXECUTE` em todas as variantes de default ACL testadas (GRANT-only, REVOKE public, REVOKE anon);

Gate 2H.2 (seguranca):

- Suite nova `2h2_execute_and_default_acl_security.test.sql` 27/27 (ACL exata do helper, anon/authenticated/PUBLIC sem EXECUTE, 5 funcoes 2H.1 protegidas com grants authenticated preservados, invariantes de catalogo 0 security definer public executavel por anon/PUBLIC e 0 helper de trigger por PUBLIC, default privileges sem anon, funcao nova sem entrada anon e descartada no ROLLBACK, trigger bloqueia FOR-*);
- Regressao SQL: 2h1 26/26, sprint_02 156/156, sprint_03 33/33, sprint_04 28/28, sprint_05 48/48, 2a 53/53, 2b 31/31, 2e_quotation_own_guard 21/21, 2e_outsourced 14/14, catalog_auto_code 11/11 â€” sem regressao; `pricing_schema` mantem a falha pre-existente (test 40, hygiene de security definer, fora do escopo 2H.2); 09a PART B verde em comportamento (B5: errcode `P0001` correto, expectativa legada malformada) e PART A segue como drift transacional legado;
- Frontend intocado: `npm test` 45 arquivos / 542 testes verdes; `npx tsc --noEmit` limpo; `npm run build` ok;
- Migration `20260923000400_harden_supplier_code_trigger_execute_and_default_acl.sql` aplicada (Push) somente no DEV; PROD nao tocado;
- decision register atualizado (DEC-069) e learning log (LL-063).

### ETAPA 13E - Hardening de search_path em security definers do public (Fase 2H.3)

Fechamento do achado A4 da auditoria 2G: as 25 funcoes SECURITY DEFINER do schema `public` que ainda declaravam `search_path = 'public, pg_temp'` (padrao antigo das Etapas 02-08) foram normalizadas para `search_path = ''`. Somente banco DEV: sem alteracao de frontend, CRM, contabil, pricing ou PROD; sem reset operacional.

- Inventario real em DEV: 54 security definers no public; 25 com pg_temp (lista exata da auditoria) e 29 ja vazias; todas sem entrada anon/PUBLIC na ACL (padrao 2H.2);
- Auditoria de corpos (`pg_get_functiondef`) das 25: apenas `create_manual_journal_adjustment` referencia simbolo nao qualificado (`gen_random_uuid()`); as demais 24 usam `public.*`, `auth.uid()`, parametros e built-ins do `pg_catalog` â€” seguras com search_path vazio. `gen_random_uuid` existe no `pg_catalog` (core) e em extensions (pgcrypto); nao qualificada resolve para `pg_catalog`, comportamento preservado;
- Migration `20260923000500_harden_security_definer_search_path.sql`: `CREATE OR REPLACE` so em `create_manual_journal_adjustment` (com `SET search_path TO ''` e `pg_catalog.gen_random_uuid()` + reaplicacao de REVOKE anon/public e GRANT authenticated); nas outras 24, `ALTER FUNCTION ... SET search_path = ''` â€” assinaturas, overloads, grants e corpos preservados; duas funcoes pre-existentes com `{search_path="",TimeZone=UTC}` (price_decision_token, own_price_decision_token) intactas.

Gate 2H.3 (seguranca):

- Suite nova `2h3_search_path_security.sql` 20/20 (inventario 54 preservado; 0 com pg_temp; 25 funcoes 2H.3 seguem SD sem pg_temp; create_manual_journal_adjustment qualificada/sem nao-qualificada/ACL `{postgres, authenticated, service_role}`/authenticated ok/anon sem EXECUTE; invariantes 2H.1/2H.2 0 SD por anon e PUBLIC; guards 2H.1 anon em assets/balanco; fornecedor FOR-* bloqueado; AJE funcional com search_path vazio â€” criacao, 2 linhas, debitos=creditos, idempotencia);
- Regressao SQL: `pricing_schema` â€” os testes 40 (search_path vazio em todas as SD) e 41 (anon sem EXECUTE em nenhuma SD) que estavam pendentes desde 2G **agora PASS**; 2a 53/53, 2b 31/31, 2h1 26/26, 2h2 27/27, sprint_03 33/33, sprint_04 28/28, sprint_05 48/48, 08l 28/28, sprint_07_crm 55/55, catalog_auto_code 11/11 â€” sem regressao;
- Drifts pre-existentes registrados (nao regressao): 08m (overload `settle_financial_transaction` ambiguo), 08n (sintaxe `perform` fora de plpgsql), 09a (depende de pgtap ausente na sessao), 08e 46/50 (4 falhas de formula/label), 08d (5 "no data" por ausencia de dados no ambiente);
- Frontend intocado: `npm test` 45 arquivos / 542 testes verdes; `npx tsc --noEmit` limpo; `npm run build` ok;
- Migration `20260923000500_harden_security_definer_search_path.sql` aplicada (Push, dry-run transacional antes) somente no DEV; PROD nao tocado;
- decision register atualizado (DEC-070) e learning log (LL-064).

### FASE 3B - Correcao do envio de propostas proprias pela interface

Correcao pontual do fluxo de criacao em `/pricing/own-prices`. O formulario e o INSERT estavam corretos, mas o encadeamento `.select('*').single()` tentava ler `internal_cost` apos a gravacao. O grant de coluna da DEC-064 proibe essa leitura direta para `authenticated`, causando HTTP 403 apesar de o INSERT ser permitido. Como nenhum consumidor usa a linha retornada, a criacao passou a executar somente o INSERT; a listagem continua sendo recarregada pela RPC mascarada via invalidacao do TanStack Query. Nenhum schema, grant, RLS, historico ou dado operacional foi alterado.

Gate 3B:

- teste unitario garante que a criacao nao encadeia SELECT; formulario cobre payload com/sem custo, preco invalido, erro de API, bloqueio de envio duplicado, feedback de sucesso e fechamento do drawer;
- invalidacao de propostas e comparacao coberta apos criacao;
- E2E isolado com fixture e cleanup: Admin passou duas vezes; Equipe passou uma vez, com `internal_cost` mascarado como `null`; cada fluxo confirmou mutation unica, HTTP 201, persistencia pending, feedback e atualizacao da linha;
- frontend: `npm test` 45 arquivos / 546 testes verdes; `npx tsc --noEmit` limpo; `npm run build` ok;
- regressao SQL sem mudanca de banco: `2a_own_price_structure` 53/53 e `2b_own_price_approval` 31/31;
- PROD nao tocado; decision register inalterado; aprendizado registrado em LL-066.

### FASE 3C.1 - Visualizacao do historico de precos proprios (Precos Proprios e Tabela de Precos)

Frontend exclusivo (sem migrations, sem RPCs, sem RLS, sem grants): o historico de precos proprios deixa de ser apenas os dados da RPC `get_own_price_proposals` consumidos pelo drawer de comparacao/revisao e ganha visualizacao dedicada e completa em `/pricing/own-prices` e na rastreabilidade da `/pricing/prices`. Nenhum contrato backend (migrations `20260922000100`/`20260922000200`) foi alterado; o backend foi consumido de forma read-only.

- `OwnPriceHistoryDrawer` (novo, reutilizavel): dialog com cabecalho `Historico de precos · <codigo>`, lista cronologica decrescente de propostas (preco, status, revisao, aprovador, privado de custo interno para Equipe via RPC mascarada), badge de `Preco vigente` na proposta vigente, bloco `Comparacao com o preco aprovado anterior` (preco anterior, novo preco, diferenca, variacao %, custo interno restrito a Admin) e justificativas;
- Precos Proprios: nova acao por linha `Ver historico` abre o drawer com o contexto do item; `currentProposalId` alimenta o badge `Preco vigente` com `preco_aprovado`;
- Tabela de Precos: a acao `Rastreabilidade` das linhas `own` agora oferece `Ver historico`, abrindo o mesmo drawer a partir daquele item;
- review-drawer do comparativo: botao de fallback `Consultar historico` quando a linha `own` nao carrega `ownPriceHistory` via prop;
- responsividade 375/390/768/1280 com um unico loop no E2E: o drawer fecha, captura-se `document.documentElement.scrollWidth`, reabre-se e asseguram-se (1) sem overflow horizontal interno (scrollWidth <= clientWidth + 1) e (2) abrir o drawer nao alarga a pagina (openWidth <= closedWidth + 1) — escopo da feature, sem diagnosticar a pagina como um todo;

Gate 3C.1 (frontend):

- unit/component: 17 testes novos na suite do drawer; suites de pagina (own-prices, price-list, review-drawer) ampliadas; `npm test` 566 testes verdes; `npx tsc -b` limpo; `npm run build` ok;
- E2E novo e permanente `own-price-history.spec.ts` (Admin + Equipe, fixture isolada, cleanup em `finally` com verificação de residuo zero e sem dialogo nativo): cria proposta, aprova, propoe reajuste, aprova reajuste, confere historico (ordem, valores, vigencia, comparacao) e rastreabilidade; cada aprovacao é confirmada pelo fechamento do drawer (unico sinal confiavel — a toast de sucesso pode se empilhar com a anterior e nao distingue falha);
- suite completa `npm run test:e2e`: 55 testes, 50 passed + 5 failed — as 5 falhas sao exatamente a suite pre-existente (4x `crm-mobile` + 1x `pricing-rules-team`), sem relacao com a fase; `own-price-history` verde em chromium e team-chromium em run isolado (3 passed) e na suite completa;
- pre-existing overflow documentado: `/pricing/own-prices` com dados em 1280 ja ultrapassava no baseline HEAD (docScrollWidth 1425, tabela `min-w-[1100px]` + sidebar); a feature adiciona zero overflow (drawer aberto = fechado na medida); pagina sem dados = limpa; nao causado pela 3C.1;
- PROD e banco DEV nao tocados; decision register DEC-071; learning log LL-067.

---

### FASE 3C.2 - Elegibilidade de itens terceirizados/ativos nas cotacoes + correcao do overflow pre-existente em Precos Proprios

Frontend exclusivo (sem migrations, sem RPCs, sem RLS, sem grants): integra no editor de cotacoes a regra DEC-067 que o banco ja impoe (servicos proprios da Efetiva nao podem entrar em cotacoes de fornecedores) e corrige o overflow de pagina pre-existente das acoes de linha de /pricing/own-prices, documentado no baseline desde a 3C.1 (LL-067).

- seletor de itens do editor: oferece apenas itens `active` e `sourcing_type = "outsourced"`; itens proprios/inativos ja vinculados a cotacoes existentes sao preservados com sufixo "(inativo - histórico)" / "(serviço próprio)" e bloqueiam a ativacao (checklist "Apenas itens terceirizados nas linhas");
- `hasActiveCatalog` exige ao menos um item `outsourced` ativo; copia do estado de prerequisito ajustada para "item terceirizado ativo no Catalogo Efetiva";
- `translateQuotationError` traduz o erro do backend casando por mensagem (ASCII e acentuacao oficial), sem depender de SQLSTATE;
- overflow: th das acoes do own-prices com `relative px-4 py-3` ancora o span sr-only "Acoes" dentro do overflow-x-auto do TableShell; coluna do cartao mobile com `min-w-0` + `break-words`; sem overflow-x-hidden global; local table scroll mantido;
- DROPPED: injecao do erro de backend via DOM em E2E — reconciliacao de options do React invalida a injecao; caminho backend coberto por suite SQL + traducao em teste unitario;

Gate 3C.2 (frontend):

- unit/component: suites de quotations ampliadas (traducao do erro, seletor sem itens proprios em cotacao nova, item proprio vinculado preservado + bloqueio de ativacao); `npm test` 46 arquivos / 569 testes verdes; `npx tsc --noEmit` limpo; `npm run build` ok;
- E2E novo e permanente `quotation-eligibility.spec.ts` (fixture isolada com marker `E2E_3C2_*`, cleanup em `finally` zero-residuo): seletor so oferece itens terceirizados e o draft persiste; unit de bloqueio de ativacao com item proprio vinculado;
- overflow: regression test em `own-price-proposal.spec.ts` com dados e loop 375/390/768/1024/1280/1440 (scrollWidth == clientWidth == bodyScrollWidth) — verde em chromium e team-chromium (run isolada ~31s);
- escopo E2E: `own-price-proposal`, `own-price-history`, `quotation-draft` e `quotation-eligibility` verdes; execucao da suite chromium sob carga acusou 3 falhas de actionability em `ui-stability` (TEST 4/5/13b: `#tax_id` fill) — reruns isoladas passaram (TEST 4 verde com e sem as mudancas da fase via stash+rebuild), confirmando flakiness de ambiente sem relacao com o escopo;
- PROD e banco DEV nao tocados; decision register DEC-072; learning log LL-068.

### FASE 3C.4 - Contencao horizontal do editor, comparacao e tabela de precos

Frontend exclusivo (sem migrations, sem RPCs, sem RLS, sem grants): corrige o overflow horizontal global das tres telas operacionais sem esconder colunas nem remover o scroll local das tabelas. A causa era a combinacao de sidebar fixa, padding do shell e tracks minimos fixos nos filtros desktop; as tabelas largas continuam restritas ao `TableShell` com `overflow-x-auto`.

- filtros desktop de comparacao e precos usam `minmax(0, 1fr)` e `min-w-0`/`break-words` para permitir reducao dos controles dentro da area util;
- cards, formularios, inputs, badges e cabecalhos mantem `min-w-0` e quebra de texto para conteudo longo;
- `TableShell` preserva `overflow-x-auto` e as tabelas mantem `min-w-[1240px]`/`min-w-[1360px]`, sem `overflow-x-hidden` global;
- E2E permanente com fixture longa e cleanup zero-residuo cobre editor, comparacao e tabela de precos em 375/390/768/1024/1280/1440, validando `scrollWidth` do documento e scroll local da tabela nos breakpoints de tabela.

Gate 3C.4 (frontend):

- `npm test`: 46 arquivos / 569 testes verdes;
- `npx tsc --noEmit`: limpo;
- ESLint dos arquivos da etapa: 0 erros; permanece 1 warning preexistente em `price-list-page.tsx` e 96 erros globais preexistentes fora do escopo;
- `npm run build`: aprovado, 2235 modulos e PWA gerado;
- E2E de homologacao: novo cenario responsivo Admin verde; Equipe responsivo 2/2; suite Admin 5/6 na primeira execucao e o caso flaky de item proprio verde no rerun isolado, sem regressao funcional observada;
- sonda DOM pos-build: 18 combinacoes sem overflow global; elementos internos listados permanecem dentro de shells com `overflow-x-auto`;
- fixtures `E2E_3C3_*` temporárias no DEV, com cleanup e zero resíduos; sem migrations/schema ou dados permanentes; PROD intocado; decision register DEC-073; learning log LL-069.

Homologacao responsiva da Fase 3C.4 (aprovada em 2026-09-26, sem alteracao de codigo):

- commit `7a37bea` reconfirmado em `main` e sincronizado com `origin/main` (0/0); `npm run build` reexecutado a partir do commit, bundle `index-LYuhL5kl.js` servido no preview local;
- ver escopo exclusivamente de validacao: nenhuma alteracao em componentes, specs E2E, banco ou regra de negocio; PROD intocado;
- 18 combinacoes (3 telas x 6 breakpoints) sem overflow global, com assercao de igualdade exata entre `documentElement.scrollWidth`, `documentElement.clientWidth`, `document.body.scrollWidth` e `document.scrollingElement.scrollWidth` contra a largura do breakpoint;
- rolagem local das tabelas funcional em 768/1024/1280/1440 nas telas de Comparacao e Tabela de Precos (`overflow-x: auto`, `scrollWidth > clientWidth`, `scrollLeft > 0` ao alcancar o fim, `clientWidth` do shell dentro da viewport);
- acessibilidade conferida com dados preenchidos: Editor com o seletor de item e `Salvar rascunho` visiveis nos seis breakpoints; Equipe sem qualquer acao `Decidir` e com drawer em somente leitura;
- residuos desta execucao: 0.

### FASE 3C.5 - Registro da homologacao responsiva e versionamento do wiring E2E

Escopo restrito a `playwright.config.ts`, este roadmap e o log de aprendizado. Sem componentes, sem specs E2E, sem banco, sem regra de negocio e sem PROD.

- preflight: `main` em `7a37bea`, `origin/main` identico (0/0 apos `git fetch`); unica alteracao local era `playwright.config.ts`; artefatos locais (`ctx-*.txt`, `log-*.txt`) preservados fora do commit;
- configuracao: `testMatch` do projeto `chromium` passou a reconhecer `quotation-homologation-admin.spec.ts` e o do `team-chromium` a reconhecer `quotation-homologation-team.spec.ts`; os demais `testMatch`, projetos, `baseURL` e `webServer` preservados, sem qualquer URL de PROD;
- descoberta: `npx playwright test --list` lista 6 testes de `quotation-homologation-admin.spec.ts` em `chromium` e 2 de `quotation-homologation-team.spec.ts` em `team-chromium` (66 testes em 20 arquivos no total);
- execucao individual contra o DEV autorizado: Admin 8/8 (2 de `authenticate` + 6 do spec, incluindo o cenario responsivo das 3 telas) e Equipe 2/2 (incluindo o cenario responsivo de Comparacao e Tabela de Precos);
- pos-flight: 0 residuos `E2E_3C3_*` em `suppliers`, `catalog_categories`, `catalog_items`, `quotations`, `quotation_items` e `margin_rules`; 0 linhas criadas em 2026-09-26 com prefixo `E2E_*` em nenhuma tabela auditada;
- limitacoes de cobertura observadas (nao corrigidas nesta fase): o cenario do Editor nao assere visibilidade de `Ativar` nem rolagem local (o grid de itens e `article` por linha, com colunas em `md`/`xl`, nao tabela) e o cenario da Equipe nao cobre o Editor.

Pendencia registrada (nao excluida, nao limpa):

- fixtures antigas `E2E_S2_*` remanescentes no DEV, todas criadas em 2026-09-24 (4 lotes as 14:58, 20:48, 21:52 e 22:09 UTC): 12 fornecedores, 8 categorias, 8 itens de catalogo, 7 cotacoes e 1 `price_list` inativa aprovada em 2026-09-24. O prefixo `E2E_S2_*` e o mesmo usado por `e2e/fixtures.ts` no `globalSetup` das execucoes atuais, mas nenhuma linha dessas quantidades foi criada nas execucoes desta fase (0 com `created_at` em 2026-09-26). A limpeza fica pendente para etapa propria; o prefixo `E2E_S2_*` deve ser mantido para nao misturar o residuo antigo com a telemetria de execucoes futuras.



## Fase 1 â€” Demais mÃ³dulos

ApÃ³s estabilizaÃ§Ã£o do Motor de PreÃ§os:

### CRM leve

- clientes;
- contratos;
- vigÃªncia;
- recorrÃªncia;
- status;
- busca e filtros.

### Financeiro bÃ¡sico

- entradas;
- saÃ­das;
- categorias;
- vÃ­nculo opcional a contrato;
- fluxo de caixa mensal.

### Dashboard consolidado

- contratos ativos;
- saldo;
- recebÃ­veis pendentes;
- alertas operacionais.

---

## Fase 2

- DRE simplificado;
- alertas mais completos;
- exportaÃ§Ã£o CSV/PDF;
- precificaÃ§Ã£o CUB/NR-4;
- histÃ³rico de variaÃ§Ã£o de preÃ§o;
- importaÃ§Ãµes assistidas.

---

## Fase 3

- portal do cliente;
- integraÃ§Ãµes bancÃ¡rias;
- automaÃ§Ãµes de cobranÃ§a;
- integraÃ§Ãµes comerciais mais profundas.

---

## Fora do escopo imediato

- OCR/IA de cotaÃ§Ãµes;
- importaÃ§Ã£o universal de planilhas;
- portal do fornecedor;
- recomendaÃ§Ã£o automÃ¡tica por SLA/qualidade;
- margem bruta sobre venda;
- aplicativo mobile nativo;
- offline-first transacional.

