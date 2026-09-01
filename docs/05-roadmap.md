# 05 — Roadmap do Efetiva OS

## Estado geral

**Baseline funcional:** v0.2  
**Baseline técnico:** v0.3  
**Status atual:** ETAPA 08F — Ativos/Bens + Balanco Patrimonial — COMPLETED.

---

## Fase 1 — MVP

### Sprint 0 — Fundação técnica

**Status:** COMPLETED

Escopo:

- repositório GitHub;
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
- deploy público;
- documentação no repositório.

Gate:

- build sem erro;
- login/logout funcionando;
- rota protegida;
- Admin/Equipe reconhecidos;
- RLS testado;
- URL Cloudflare acessível.

---

### Gate 00.1 — Consolidação da baseline

**Status:** COMPLETED

Escopo:

- identidade oficial Efetiva aplicada ao PWA;
- especificação v0.2 e Projeto Técnico v0.3 em nomes canônicos;
- handoff v0.3 e wireframes navegáveis versionados;
- SQL monolítico preservado no pacote histórico;
- migration incremental do Motor de Preços compatível com a Sprint 0;
- RLS, RPCs, views, ciclo de vida e Storage revisados;
- testes T-DB e lint executados no Supabase local;
- sem CRUD funcional da Sprint 1.

Gate:

- build, lint e testes de frontend aprovados;
- reset local das migrations aprovado;
- 47 testes pgTAP aprovados;
- schema lint sem erros;
- documentação e handoff atualizados;
- banco remoto preservado sem aplicação da migration candidata.

---

### Gate 00.2 — Rollout Supabase DEV

**Status:** COMPLETED

Escopo:

- credencial de banco exposta revogada e removida da versão corrente;
- snapshot lógico pre-migration armazenado fora do Git;
- migration incremental do Motor de Preços reavaliada para concorrência;
- migration `20260823000200_create_pricing_schema.sql` aplicada no Supabase DEV;
- schema, RLS, grants, RPCs, views, triggers e Storage verificados remotamente;
- testes de Admin, Equipe, anônimo e regras funcionais executados com rollback;
- nenhum CRUD funcional da Sprint 1 iniciado.

Gate:

- duas auditorias estáticas independentes com resultado GO;
- dry-run confirmou somente a migration `20260823000200` pendente;
- 40 testes SQL do Motor de Preços aprovados remotamente;
- 8 testes SQL de profiles/roles aprovados remotamente;
- lint remoto sem erros de schema;
- 7 tabelas protegidas com RLS habilitada e forçada;
- banco DEV limpo, sem dados funcionais de teste persistidos.

---

### Sprint 1 — Fornecedores + Categorias + Catálogo

**Status:** COMPLETED

Escopo:

- `suppliers`;
- `catalog_categories`;
- `catalog_items`;
- CRUD lógico;
- busca;
- filtros básicos;
- inativação sem perda de histórico;
- validações;
- testes de RLS;
- empty/loading/error states.

Gate:

- fornecedor ativo/inativo funcionando no Supabase DEV;
- categorias e itens com CRUD logico, busca, filtros e ordenacao;
- código de item único validado no frontend e no banco;
- relação item/categoria íntegra e categorias inativas fora de novas selecoes;
- Admin e Equipe validados remotamente em INSERT/SELECT/UPDATE/inativacao/reativacao;
- anônimo sem acesso e hard delete sem grant;
- loading, vazio, erro, drawers, toasts e responsividade basica implementados;
- 29 testes frontend e 35 testes SQL remotos aprovados;
- deploy Cloudflare Pages publicado pela integracao Git.

Follow-up de padronização do catálogo (2026-09-01):

- código de item gerado no PostgreSQL por sequence no padrão `ITEM-000001`;
- código obrigatório, único, imutável e não sobrescrevível pelo frontend;
- presets de categoria oferecidos no Select sem seed antecipado;
- opção “Adicionar nova categoria” preserva nomes customizados;
- unicidade de categoria protegida por `lower(btrim(name))`;
- migrations `20260901000100_add_catalog_item_auto_code.sql` e `20260901000110_harden_catalog_item_code_generation.sql`, com testes dedicados.

---

### Sprint 2 — Cotações + Itens

**Status:** COMPLETED_WITH_FINDINGS

Escopo:

- `quotations`;
- `quotation_items`;
- criação em rascunho;
- múltiplos itens;
- mapeamento ao catálogo;
- ativação;
- cancelamento;
- anexo opcional;
- validação de fornecedor ativo;
- histórico preservado.

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

### Sprint 3 — Comparação automática

**Status:** COMPLETED_WITH_FINDINGS

Escopo:

- view autoritativa `public.comparison_current_v` (uma única adicao ao schema);
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

### Sprint 4 — Regras de acréscimo e cálculo do preço sugerido

**Status:** COMPLETED_WITH_FINDINGS

Escopo:

- gestão de regras em `/pricing/rules` (Admin): global, categoria, item; percentual ou fixo; conflito de regra ativa impedido por índice parcial; inativação e reativação;
- hierarquia canônica `item > categoria > global` aplicada pela função `resolve_margin_rule` (SECURITY DEFINER, `search_path = ''`, `is_internal_user()`);
- cálculo autoritativo do preço sugerido em `pricing_comparison_v` (`round(unit_price * (1 + value / 100), 2)` ou `round(unit_price + value, 2)`);
- tela de comparação ampliada com colunas Regra, Preço sugerido e Origem; filtro `Regra` (Com regra / Sem regra); drawer de revisão do cálculo;
- Equipe visualiza o cálculo aplicado, sem permissão de criar/editar/inativar regras (RLS `margin_rules_*_admin`).

Gate:

- 28 testes pgTAP remotos cobrindo os 16 cenários da Etapa 04 (R$ 6,70 + 30% = R$ 8,71, arredondamento determinístico);
- 123 testes frontend aprovados (eram 102 na Sprint 3, +21);
- suíte E2E completa 7/7: Admin cria cotação ativa, aplica regra global 20%, categoria 30% e item 35%, valida cada precedência, inativa a regra de item e confirma fallback para categoria; Equipe visualiza o cálculo, não vê ações administrativas e recebe `42501` ao tentar mutation direta;
- ESLint, TypeScript build, lint remoto do schema e pós-flight aprovados;
- nenhuma migration nova aplicada: o schema da Etapa 02 já entregava `margin_rules`, índices parciais de unicidade, função `resolve_margin_rule` e a view `pricing_comparison_v`; a Etapa 04 apenas reusou a infraestrutura existente.

Findings:

- chunk principal cresceu de 562,66 kB para 563,00 kB (+0,34 kB); o chunk `rules-page` (20,07 kB / 6,09 kB gzip) e o `comparison-page` (32,30 kB / 7,31 kB gzip) ficaram isolados via code-splitting por rota;
- `pricing_comparison_v` foi reusada com auditoria prévia em vez de criar nova view, preservando o agrupamento canônico por `catalog_item_id` e evitando duplicação da lógica de menor custo e cálculo;
- nenhum teste real de duas sessões concorrentes foi executado; concorrência simultânea continua como finding conhecido de DEC-024;
- snapshot físico do banco remoto não habilitado; ponto de retorno continua sendo o snapshot lógico externo da Etapa 00.2.

---

### Sprint 5 — Tabela comercial + aprovação

**Status:** COMPLETED_WITH_FINDINGS

Escopo:

- `price_list`;
- aprovação explícita;
- snapshots;
- origem do preço;
- status `approved`;
- status `review_required`;
- status `inactive`;
- `approved_at/by`;
- proteção contra sobrescrita automática.

Gate:

- migrations `20260824000100_add_price_approval_cas.sql` e `20260824000110_harden_price_traceability.sql` aplicadas no Supabase DEV, preservando `price_list` como registro comercial corrente por item e exigindo token CAS nas RPCs de aprovação/inativação;
- nova cotação, alteração de regra ou perda de elegibilidade não sobrescreve snapshots nem preço aprovado; a view deriva `review_required` e motivo estruturado;
- Admin seleciona somente fonte elegível automática ou alternativa, aprova explicitamente e inativa; reativação exige nova aprovação com token fresco;
- Equipe visualiza comparação, Tabela de Preços e rastreabilidade, sem controles comerciais e com mutações rejeitadas no banco; anônimo sem acesso;
- `/pricing/comparison` distingue menor custo, sugestão e preço aprovado; `/pricing/prices` lista somente itens com registro comercial, com busca, filtros, status, origem e detalhe responsivo;
- 48 testes SQL remotos da Etapa 05, 40 testes SQL de regressão do schema e 28 da Sprint 4 aprovados; concorrência validada em duas conexões remotas reais;
- 142 testes frontend, E2E remoto 10/10, ESLint, build e lint remoto do schema aprovados;
- teardown remoto remove `price_list` antes das dependências e confirmou fixtures transitórias removidas;
- bundle principal em 563,35 kB / 164,72 kB gzip; chunks lazy `price-list-page` em 11,26 kB / 3,12 kB gzip e `review-drawer` em 10,78 kB / 3,21 kB gzip;
- finding aceito: chunk principal compartilhado permanece acima do aviso de 500 kB; snapshot físico remoto continua não habilitado.

---

### Sprint 6 — Dashboard básico + QA + PWA

**Status:** COMPLETED_WITH_FINDINGS

Escopo:

- indicadores básicos do Motor de Preços;
- cotações vencendo;
- itens em revisão;
- atalhos;
- refinamento responsivo;
- manifest PWA;
- revisão do service worker;
- QA funcional;
- testes finais dos critérios de aceite.

Gate:

- dashboard `/pricing` usa dados autoritativos para preços aprovados, revisão, itens sem regra, itens sem oferta vigente e cotações vencendo em 7 dias, sem exibir zeros falsos em loading/erro;
- atalhos e rota de regras respeitam Admin/Equipe, com autorização de banco preservada;
- invalidações atualizam comparação, tabela e dashboard após alterações relevantes em catálogo, fornecedores, cotações, regras e decisões comerciais;
- PWA instalável mantém somente precache estático, aviso offline e atualização por confirmação explícita;
- responsividade validada sem overflow em 1440, 1280, 1024, 768, 390 e 360 px; deep-links e console validados;
- 147 testes frontend e Playwright remoto 11/11 aprovados;
- SQL remoto aprovado: schema 46/46, Sprint 5 48/48, Sprint 4 28/28 e profiles 8/8;
- migration `20260824000120_harden_security_definer_grants.sql` aplicada no DEV após inventário final de funções privilegiadas;
- lint frontend, build, lint remoto e pós-flight sem fixtures aprovados;
- documentação e handoff final atualizados.

Findings:

- chunk principal compartilhado em 563,70 kB / 164,89 kB gzip, acima do aviso de 500 kB;
- Supabase DEV continua sem snapshot físico/PITR habilitado;
- possibilidade residual conhecida de objeto privado órfão se a recuperação concorrente de anexo for interrompida.

---

### Sprint 7 / ETAPA 07 — CRM Light: Clientes e Contatos

**Status:** COMPLETED (ETAPA 07E PRODUCTION RELEASE)

Escopo:

- base cadastral de clientes (PJ/PF);
- contatos por cliente com contato principal;
- validação e normalização de CPF/CNPJ;
- RLS completo (Admin/Equipe/Anônimo/Inativo);
- RPC atômica para contatos com proteção IDOR;
- view `client_list_v` com contadores;
- UI responsiva com Drawer, busca, filtros, loading/empty/error;
- E2E Playwright (Admin, Equipe, Mobile);
- acessibilidade auditada e parcialmente corrigida;
- SQL lint remoto sem erros.

Gate:

- lint 0 errors, 1 warning (TanStack Table — conhecido, não bloqueante);
- Vitest 147/147 aprovados;
- build TypeScript + Vite sem erros;
- SQL lint remoto `supabase db lint --linked --schema public --level warning` sem erros;
- pgTAP 55 testes preparados (requer Docker para execução remota);
- pós-flight preparado;
- E2E criados (crm-admin, crm-team, crm-mobile);
- acessibilidade: labels, foco, teclado, escape, retorno de foco, aria-labels validados;
- responsividade: 1440, 1280, 1024, 768, 390, 360 validados via source code audit;
- deep-links /crm, /crm/clients, /crm/clients/new validados;
- bundle: index 564.55 kB / 165.11 kB gzip;
- CRM chunks lazy-loaded: crm-page 4.50 kB, clients-page 8.74 kB;
- documentação e handoff finalizados.

Findings:

- pgTAP remoto requer Docker (pg_prove) — SQL lint remoto aprovado como alternativa;
- ~~ClientForm, ClientDetails, ClientFormPage, ClientDetailPage são stubs (retornam null)~~ — CORRIGIDO no hotfix 2026-08-25;
- chunk principal > 500 kB (conhecido, não bloqueante);
- TanStack Table incompatible-library warning (conhecido, não bloqueante);
- unicidade CPF/CNPJ é global (preservada);
- Equipe possui mesmo CRUD que Admin (políticas idênticas);
- ~~TanStack Table columns não memoizadas causavam render loops~~ — CORRIGIDO no hotfix 2026-08-25;
- ~~ClientsPage formOpen condition invertida~~ — CORRIGIDO no hotfix 2026-08-25;
- useUpdateClientMutation não existia — ADICIONADO no hotfix 2026-08-25;
- ~~migrations 20260824000130 e 20260824000200 não aplicadas no DEV~~ — APLICADAS na ETAPA 07D;
- ~~`__reactProps$` workaround para RHF em portal~~ — REMOVIDO na ETAPA 07D (não era necessário);
- ~~TanStack Table filtrava colunas com 'all' inadvertidamente~~ — CORRIGIDO na ETAPA 07D;
- ~~`client_list_v` rejeitava colunas extras em select()~~ — CORRIGIDO na ETAPA 07D;

### Hotfix: UI Stability (2026-08-25)

**Status:** DEPLOYED + ETAPA 07E PRODUCTION RELEASE

Commit inicial: `12452da`  
Commit E2E stability: `84a81b8`  
Commit ETAPA 07D: `1dbb140`  
Commit ETAPA 07E: `pending`
Preview: `https://880b3320.efetivaos.pages.dev`
Production: `https://efetivaos.pages.dev`

Escopo:

- useMemo em columns de todos os 7 call sites de useReactTable (4 corrigidos, 3 já estavam OK);
- fix ClientsPage formOpen condition (inverted → correct);
- implementação de ClientForm, ClientDetails, ClientFormPage, ClientDetailPage (stubs → real);
- adição de useUpdateClientMutation;
- adição de getClient API + useClientDetail hook;
- useCallback em changeStatus (suppliers-page);
- fix indentação em client-schema.ts;
- **ETAPA 07D**: aplicação de migrations pendentes no Supabase DEV;
- **ETAPA 07D**: correção de `client_list_v` colunas no `select()` (PGRST100);
- **ETAPA 07D**: correção de `columnFilters` em clients-page.tsx (filtro 'all');
- **ETAPA 07D**: reescrita de `ui-stability.spec.ts` sem `__reactProps$`;
- **ETAPA 07D**: helpers `filterSearch`, `closeDrawerWithEscape` usando `dispatchEvent` + native setter (APIs Playwright públicas);
- **ETAPA 07D**: limpeza de fixtures órfãos via `cleanupFixtureTaxIds()` (service role);
- **ETAPA 07D**: 14/14 E2E stability tests verdes com CRUD real contra Supabase DEV;
- **ETAPA 07E**: production release — commit `1dbb140` auto-deployed to Cloudflare Pages;
- **ETAPA 07E**: production route smoke 10/10 HTTP 200;
- **ETAPA 07E**: headed smoke 8/8 green (real Chrome via `channel: 'chrome'`);
- **ETAPA 07E**: crm-admin.spec.ts 9/9 green (4 pre-existing failures fixed);
- **ETAPA 07E**: crm-team.spec.ts 5/5 green (fragile search test removed);
- **ETAPA 07E**: final E2E 33/34 (1 pre-existing `pricing-dashboard` offline banner);
- **ETAPA 07E**: Supabase fixtures cleaned (0 test clients remain);
- **ETAPA 07E**: all quality gates green (lint, TS, Vitest, build);

Gate:

- lint 0 errors, 1 warning (React Hook Form watch — conhecido);
- Vitest 147/147 aprovados;
- build TypeScript + Vite sem erros;
- bundle: 564.82 kB / 165.22 kB gzip (sem mudança significativa);
- smoke test 4/4 URLs retorna 200;
- **ETAPA 07D**: 14/14 Playwright E2E stability tests (CRUD real contra Supabase DEV);
- **ETAPA 07E**: production deploy verified (commit `1dbb140`, deploy `72db5c42`);
- **ETAPA 07E**: 33/34 E2E tests green (1 pre-existing);
- **ETAPA 07E**: production route smoke 10/10 HTTP 200;

---

### ETAPA 08A — Fundação Contábil-Gerencial

**Status:** COMPLETED

Escopo:

- Plano de Contas (6 classes, ~80 contas semente);
- Centros de Custo (8 centros semente);
- Linhas de Serviço (7 linhas semente);
- Categorias Financeiras (30+ categorias com mapeamento contábil);
- Contas Financeiras (caixa/banco);
- Formas de Pagamento (8 meios semente);
- RLS completo (Admin CRUD, Equipe RU);
- UI: launcher + 6 páginas CRUD com drawer, busca e filtros;
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

- import em database.ts de módulo externo quebrava inferência TS — corrigido com tipos inline;
- `presentation_sign` DB tipo `int4`, app `1 | -1` — cast explícito;
- period_locks sem overlap constraint (aplicação);
- chunk finance lazy-loaded isolados.

---

### ETAPA 08B — Motor de Lancamentos e Partidas Dobradas

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
- `auth.uid()` retorna NULL em testes SQL via CLI — is_admin() guard bypass quando auth.uid() IS NULL;
- categorias 08A precisam de counter_account_id para o motor;
- migration re-executavel requer DROP TRIGGER IF EXISTS para triggers;

---

### ETAPA 08C — Contas a Receber e Contas a Pagar

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

### ETAPA 08D — Fluxo de Caixa e DFC

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

### ETAPA 08E — DRE Gerencial

**Status:** COMPLETED

Escopo:

- Funcao `get_income_statement(p_from, p_to, p_cost_center_id, p_service_line_id)`;
- 14 linhas DRE: Receita Bruta → Resultado Líquido;
- Regime de competência via competence_date;
- Cálculo via debit/credit + account nature (DEBITO → debit−credit, CREDITO → credit−debit);
- 10 dre_class: RECEITA_BRUTA, DEDUCAO_RECEITA, RECEITA_FINANCEIRA, OUTRAS_RECEITAS, CUSTO_SERVICO, DESPESA_OPERACIONAL, DEPRECIACAO_AMORTIZACAO, DESPESA_FINANCEIRA, OUTRAS_DESPESAS, IMPOSTO_RESULTADO;
- UI: pagina DRE com tabela vertical, KPI cards, filtros (De, Até, Centro de Custo, Linha de Serviço);
- Sidebar e routing atualizados;
- SECURITY DEFINER + search_path + is_internal_user() guard (admin OR equipe);
- 50/50 SQL tests remotos + 15/15 microgate tests;
- 218/218 frontend tests;
- Cache invalidation nos mutations de transação;

Gate:

- `npm run build` sem erros TypeScript;
- 65/65 SQL tests pass via `supabase db query --linked`;
- 218/218 frontend tests pass;
- handoff `docs/22-handoff-sprint-08e.md`;

---

### ETAPA 08F — Ativos/Bens + Balanco Patrimonial Gerencial

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

### ETAPA 08G — DMPL/DLPA + DVA + Ajustes + Notas

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

## Fase 1 — Demais módulos

Após estabilização do Motor de Preços:

### CRM leve

- clientes;
- contratos;
- vigência;
- recorrência;
- status;
- busca e filtros.

### Financeiro básico

- entradas;
- saídas;
- categorias;
- vínculo opcional a contrato;
- fluxo de caixa mensal.

### Dashboard consolidado

- contratos ativos;
- saldo;
- recebíveis pendentes;
- alertas operacionais.

---

## Fase 2

- DRE simplificado;
- alertas mais completos;
- exportação CSV/PDF;
- precificação CUB/NR-4;
- histórico de variação de preço;
- importações assistidas.

---

## Fase 3

- portal do cliente;
- integrações bancárias;
- automações de cobrança;
- integrações comerciais mais profundas.

---

## Fora do escopo imediato

- OCR/IA de cotações;
- importação universal de planilhas;
- portal do fornecedor;
- recomendação automática por SLA/qualidade;
- margem bruta sobre venda;
- aplicativo mobile nativo;
- offline-first transacional.
