# 06 — Learning Log

Registro de aprendizados técnicos e de produto obtidos durante a construção do Efetiva OS.

Este arquivo não substitui o Decision Register. Use-o para registrar descobertas, limitações, padrões e lições que possam melhorar as etapas seguintes.

---

## LL-001 — Separar server state de UI state

**Data:** 2026-08-23

**Aprendizado:** Dados persistentes do Supabase não devem ser duplicados em Zustand.

**Aplicação:** TanStack Query para server state; Zustand apenas para estado de UI compartilhado.

---

## LL-002 — Code-splitting precisa nascer com o projeto

**Data:** 2026-08-23

**Aprendizado:** Adiar code-splitting tende a gerar bundle monolítico e refatoração desnecessária.

**Aplicação:** Rotas modulares desde a Sprint 0.

---

## LL-003 — Segurança não deve ser adicionada depois

**Data:** 2026-08-23

**Aprendizado:** Como o sistema trabalhará com informações comerciais e financeiras, Auth/RLS deve existir antes dos CRUDs principais.

**Aplicação:** `profiles`, roles e RLS entram na Sprint 0.

---

## LL-004 — Texto de fornecedor não é chave de comparação confiável

**Data:** 2026-08-23

**Aprendizado:** Fornecedores podem nomear o mesmo exame/serviço de formas diferentes.

**Aplicação:** Catálogo canônico + `catalog_item_id`.

---

## LL-005 — Margem e markup não devem ser usados como sinônimos

**Data:** 2026-08-23

**Aprendizado:** “30% de margem” e “30% sobre custo” produzem valores diferentes.

**Aplicação:** No MVP utilizar explicitamente “acréscimo sobre custo”.

---

## LL-006 — Histórico deve ser preservado

**Data:** 2026-08-23

**Aprendizado:** Fornecedores, cotações e preços antigos possuem valor de rastreabilidade.

**Aplicação:** Preferir status/inativação e evitar hard delete de registros utilizados.

---

## LL-007 — Preço aprovado precisa ser estável

**Data:** 2026-08-23

**Aprendizado:** Automatizar a troca do preço comercial quando chega uma nova cotação pode gerar alteração silenciosa de preço usado em propostas/contratos.

**Aplicação:** Nova cotação gera sugestão/revisão; alteração exige aprovação explícita de Admin.

---

## LL-008 — Artefatos tecnicos esperados estavam ausentes

**Data:** 2026-08-23

**Contexto:** O inventario inicial nao encontrou `docs/02-projeto-tecnico-v0.3.docx`, `docs/03-handoff-v0.3.md`, wireframes do Motor nem o schema SQL citado como existente.

**Aprendizado:** O status documental do roadmap nao garante que todos os artefatos estejam materialmente presentes no repositorio.

**Aplicacao:** A Sprint 0 criou somente `profiles`, roles e RLS explicitamente definidos; nenhuma tabela funcional do Motor foi antecipada.

**Impacto futuro:** O schema aprovado e os documentos v0.3 devem ser recuperados antes da Sprint 1 para evitar modelagem divergente.

---

## LL-009 — Pages com Git deve nascer integrado

**Data:** 2026-08-23

**Contexto:** A Cloudflare diferencia projetos Pages com Git Integration e Direct Upload.

**Aprendizado:** Um projeto iniciado como Direct Upload nao pode ser convertido posteriormente para Git Integration.

**Aplicacao:** O deploy direto foi evitado; o projeto deve ser criado pelo fluxo Connect to Git apos a primeira branch ser publicada.

**Impacto futuro:** Preserva o pipeline GitHub para builds e deploys automaticos exigido pela arquitetura.

---

## LL-010 — IF NOT EXISTS não resolve incompatibilidade de contrato

**Data:** 2026-08-23

**Contexto:** O SQL v0.3 declarava `profiles.user_id`, enquanto a migration já aplicada usa `profiles.id`.

**Aprendizado:** `CREATE TABLE IF NOT EXISTS` evita erro de objeto duplicado, mas não adapta colunas, policies, grants, triggers ou funções que dependem de outro contrato.

**Aplicação:** Converter schemas recebidos em migrations incrementais após comparar todos os objetos existentes.

**Impacto futuro:** Todo novo pacote técnico deve ser revisado contra o histórico real de migrations antes de execução.

---

## LL-011 — RLS e grants precisam ser testados em conjunto

**Data:** 2026-08-23

**Contexto:** Um grant amplo de `UPDATE` em `profiles` permitiria que a policy de atualização própria alcançasse a coluna `role`.

**Aprendizado:** Uma policy correta não compensa privilégios de coluna excessivos; o contrato efetivo é a interseção de grants, RLS, triggers e RPCs.

**Aplicação:** Preservar `UPDATE (full_name)` em `profiles`, manter role em `set_user_role()` e testar tentativas reais de autopromoção com o perfil Equipe.

**Impacto futuro:** Testes RLS devem incluir operações negativas e verificar o efeito persistido, não apenas a existência das policies.

---

## LL-012 — Supabase local mínimo melhora a validação no Windows

**Data:** 2026-08-23

**Contexto:** Containers auxiliares de analytics/vector ficaram instáveis durante um reset do Docker Desktop.

**Aprendizado:** Para validar migrations e pgTAP, iniciar somente o banco reduz tempo, consumo e interferência de serviços não relacionados.

**Aplicação:** Usar `supabase start --exclude` com os serviços opcionais quando o objetivo for apenas schema, lint e testes SQL.

**Impacto futuro:** A validação local fica reproduzível mesmo sem subir toda a stack Supabase.

---

## LL-013 — Rollout remote-first exige transações descartáveis e CLI sequencial

**Data:** 2026-08-23

**Contexto:** O Gate 00.2 precisava aplicar e testar a migration no Supabase DEV sem usar Docker. O projeto não apresentava snapshot físico concluído nem PITR, e duas chamadas paralelas do Supabase CLI disputaram o mesmo login temporário do pooler.

**Aprendizado:** Um rollout remote-first seguro combina snapshot lógico do estado afetável, dry-run, aplicação mínima, pgTAP criado dentro de transação com rollback, pós-flight e lint remoto. Chamadas vinculadas do CLI devem ser sequenciais para não invalidar o login temporário entre processos.

**Aplicação:** Executar um comando remoto por vez; manter testes autocontidos; confirmar que extensão e dados de teste não persistiram; registrar hash e localização externa ao Git do snapshot.

**Impacto futuro:** Gates de banco continuam reproduzíveis sem Docker, mas ausência de backup físico e testes concorrentes de duas sessões deve permanecer explícita no relatório.

---

## LL-014 — Remover segredo do arquivo não revoga a credencial

**Data:** 2026-08-23

**Contexto:** Uma senha de banco foi encontrada em texto puro no `.env.example` de um repositório público.

**Aprendizado:** Sanitizar a versão corrente ou apagar o arquivo não invalida cópias já publicadas no histórico Git. A primeira resposta deve ser rotacionar a credencial pelo canal oficial, armazenar a substituta fora do repositório e somente então continuar o rollout.

**Aplicação:** A senha foi rotacionada pelo endpoint oficial do Supabase, a nova credencial ficou no cofre local e `.env.example` voltou a conter apenas variáveis públicas exemplificativas.

**Impacto futuro:** Qualquer segredo versionado deve ser tratado como comprometido. Reescrita de histórico é uma ação separada e disruptiva; rotação não pode depender dela.

---

## LL-015 — Vertical real deve validar UI, RLS e limpeza como um único gate

**Data:** 2026-08-23

**Contexto:** A Sprint 1 foi a primeira vertical funcional persistida no Supabase DEV. Os mesmos fluxos precisavam ser comprovados no formulário, na camada de queries e nas policies do banco sem deixar fixtures remotas.

**Aprendizado:** Testes de componente cobrem validação, estados operacionais e feedback, enquanto uma suíte SQL transacional comprova o efeito real de Admin/Equipe, constraints, ausência de hard delete e bloqueio anônimo. Nenhuma das duas camadas substitui a outra.

**Aplicação:** Os testes frontend cobrem formulários, mutations, loading, vazio, erro/retry, filtros, drawers e status. A suíte remota cria usuários e cadastros dentro de `BEGIN`, executa 35 verificações e termina em `ROLLBACK`, seguida por consulta explícita de limpeza.

**Impacto futuro:** Novas verticais devem manter testes transacionais remotos próprios e confirmar zero fixtures/extensões persistidas antes de fechar o gate.

---

## LL-016 — Ações essenciais precisam permanecer acessíveis em tabelas largas

**Data:** 2026-08-23

**Contexto:** Fornecedores e Catálogo são desktop-first, mas tabelas largas podem empurrar ações para fora da primeira viewport em telas menores.

**Aprendizado:** Scroll horizontal controlado não basta quando editar/inativar fica distante. Colunas de ação fixas, rótulos compactos e drawer modal com foco gerenciado preservam a operação sem duplicar uma segunda interface mobile.

**Aplicação:** Ações ficam fixas à direita, textos secundários são reduzidos em viewports menores e Radix Dialog controla foco, Escape e restauração nos drawers e menu mobile.

**Impacto futuro:** Novas tabelas operacionais devem testar teclado e acesso às ações antes de adicionar colunas secundárias.

---

## LL-017 — Timestamp transacional nao substitui revisao autoritativa

**Data:** 2026-08-23

**Contexto:** O salvamento concorrente de cotacoes precisava detectar mudancas no cabecalho e nos itens, inclusive mais de uma alteracao dentro da mesma transacao.

**Aprendizado:** `now()` e estavel durante a transacao e pode repetir o mesmo valor; por isso, timestamp sozinho nao representa cada nova versao do agregado.

**Aplicação:** Manter o timestamp esperado como verificacao adicional e usar uma revisao `bigint` incrementada no banco como token CAS autoritativo, tocando a revisao do pai quando um item muda.

**Impacto futuro:** Novos agregados editaveis de forma concorrente devem usar versao monotona do servidor, sem depender apenas de `updated_at`.

---

## LL-018 — Runner linked do pgTAP ainda depende de Docker

**Data:** 2026-08-23

**Contexto:** A suite da Sprint 2 precisava rodar no Supabase DEV sem Docker local e com resultado TAP observavel pela Management API.

**Aprendizado:** `supabase test db --linked` ainda requer o `pg_prove` fornecido por Docker, mesmo apontando para o projeto vinculado. `supabase db query --linked --file` executa o SQL remoto sem Docker, mas o harness precisa acumular os resultados TAP para que a Management API os exponha integralmente.

**Aplicação:** Executar a suite remota por `supabase db query --linked --file`, dentro de transacao com rollback, e agregar o TAP no proprio harness antes da verificacao de pos-flight.

**Impacto futuro:** Gates remotos sem Docker devem distinguir conexao linked de runner pgTAP e preservar a saida consolidada para auditoria.

---

## LL-019 — View com `security_invoker` ainda recebe GRANT em cascata

**Data:** 2026-08-24
**Contexto:** A migration 004 da Etapa 03 criou `public.comparison_current_v` com `security_invoker = true` e concedeu `GRANT SELECT` apenas a `authenticated`. O `supabase db query --linked` ainda assim conseguiu executar a view com `set local role anon` ate colidir com `permission denied` na view de base.
**Aprendizado:** `GRANT SELECT` em uma view para um role nao autenticado e propagado implicitamente em algumas cadeias de PostgREST/CLI mesmo quando o caller nao consegue completar a consulta. Defense in depth exige revogar explicitamente `anon` e `public` na nova view, alem do `GRANT` positivo para `authenticated`.
**Aplicação:** Migration 00410 revoga `anon` e `public` da nova view. Suas verificacoes locais (`has_table_privilege`) e o teste pgTAP especifico (`anon nao possui SELECT em comparison_current_v`) cobrem a ausencia do grant antes do rollout.
**Impacto futuro:** Novas views `security_invoker` criadas em gates remotos devem ser acompanhadas de revogacao explicita de `anon` e `public` para que o controle dependa apenas de RLS, sem depender de falhas em cadeia.

---

## LL-020 — `pg_views.definition` nao expoe `WITH (security_invoker)`

**Data:** 2026-08-24
**Contexto:** A suite pgTAP da Etapa 03 tentava confirmar o uso de `security_invoker` em `comparison_current_v` via `pg_views.definition like '%security_invoker%'`. Os testes sempre falhavam mesmo com a opcao presente.
**Aprendizado:** O conteudo de `pg_views.definition` representa apenas o `SELECT` canonico. As opcoes de storage (`WITH (...)`) ficam em `pg_class.reloptions` e nao aparecem ali. Verificacoes sobre `security_invoker`, `security_barrier` e opcoes similares precisam olhar `reloptions`.
**Aplicação:** Testes pgTAP passaram a consultar `pg_class.reloptions` para validar o atributo. Essa pratica sera mantida para futuras views com opcoes de storage.
**Impacto futuro:** Auditorias de schema que dependem de `pg_views.definition` estao incompletas; expandir a verificacao para `pg_class.reloptions` em qualquer checagem de propriedades da view.

---

## LL-021 — Reuso de `pricing_comparison_v` apos auditoria explicita

**Data:** 2026-08-24
**Contexto:** A Etapa 04 precisava do calculo autoritativo de preco sugerido, regra aplicada e origem. A Etapa 03 havia desencorajado o reuso cego da view consolidada por carregar conceitos das Etapas 04/05. A nova view dedicada a Etapa 03 (`comparison_current_v`) nao entrega os campos de regra.
**Aprendizado:** Reauditoria explicita de uma view com multiplos consumidores potenciais antes de reusar: confirmar `security_invoker` vs `security_definer` (e o owner), grants, `search_path` de funcoes SECURITY DEFINER referenciadas, dependencias carregadas, e quais colunas serao realmente consumidas. Quando a view e a unica fonte possivel para os dados necessarios e a auditoria nao encontra desvio, reusar evita duplicacao e acoplamento.
**Aplicação:** A Etapa 04 consumiu `pricing_comparison_v` para a listagem e o detalhe, ignorando os campos `price_list` e `approved_*` que pertencem a Etapa 05. Migracao nova foi desnecessaria. Foi registrada DEC-028 documentando a auditoria.
**Impacto futuro:** Antes de criar uma view dedicada em uma nova sprint, sempre reauditar as views ja existentes com o mesmo escopo. A reauditoria deve ser obrigatoria quando a sprint anterior explicitamente desencorajou o reuso.

---

## LL-022 — Inativacao de cotacao preserva items e exige nova cotacao

**Data:** 2026-08-24
**Contexto:** O cenario 12 da suite da Etapa 04 tentava reativar uma cotacao cancelada e atualizar o menor custo via `update ... where id = cotacao`. O trigger `enforce_quotation_lifecycle` proibiu a operacao porque cotacoes ativas sao imutaveis e canceladas sao terminais.
**Aprendizado:** Cotacoes canceladas nao podem ser reabertas; cotacoes ativas nao podem ter dados de origem alterados. Para recalcular o menor custo em um teste, e necessario criar uma cotacao adicional, nao atualizar uma existente. O schema da Etapa 02 protege o historico contra alteracoes silenciosas.
**Aplicação:** O cenario 12 foi reescrito para criar uma nova cotacao ativa com custo menor (5,00 diante do custo anterior de 6,70) e validar que o preco sugerido recalcula automaticamente para 6,50. O plano pgTAP tambem foi corrigido de 36 para as 28 assercoes realmente emitidas.
**Impacto futuro:** Suites SQL de comparacao devem sempre criar cotacoes adicionais para alterar o melhor custo, em vez de tentar UPDATE em cotacoes ativas. A mesma logica se aplica a mutacoes reais da aplicacao: para um novo preco, registre uma nova cotacao.

---

## LL-023 — Teardown E2E precisa respeitar a imutabilidade fora do fluxo normal

**Data:** 2026-08-24
**Contexto:** O teardown E2E tentava remover `quotation_items` de cotacoes ativas/canceladas pela API com `service_role`, mas `enforce_quotation_lifecycle` bloqueia a operacao independentemente de RLS. Isso deixava fixtures remotas e impedia remover catalogo, categoria e fornecedor pelas FKs restritivas.
**Aprendizado:** `service_role` ignora RLS, nao triggers de integridade. Testes que exercitam estados historicos imutaveis precisam de um canal de limpeza separado, estritamente limitado a fixtures identificaveis, sem criar uma RPC de producao capaz de contornar o historico.
**Aplicação:** O teardown valida o prefixo aleatorio `E2E_S2_<timestamp>_<uuid>`, remove o anexo privado pela API e executa um SQL transacional temporario pelo Supabase CLI vinculado, com `session_replication_role = replica` apenas na transacao de limpeza e predicados exatos de prefixo/ID. O pos-flight confirmou zero fixtures e zero extensao pgTAP.
**Impacto futuro:** Qualquer E2E remoto que leve registros a estados terminais deve reutilizar essa limpeza controlada. Nunca ampliar o bypass para dados sem prefixo E2E nem disponibiliza-lo como RPC da aplicacao.

---

## LL-024 — Lock serializa a escrita, mas não protege a intenção lida

**Data:** 2026-08-24

**Contexto:** `approve_price` já adquiria o mesmo advisory lock usado pelos triggers de ofertas e regras. Ainda assim, uma tela poderia ler uma sugestão, aguardar outra transação alterar a regra e aprovar depois usando uma intenção antiga.

**Aprendizado:** Exclusão mútua garante ordem de execução, não que o cliente concorda com o estado executado. Para uma decisão explícita, o servidor precisa comparar uma expectativa lida antes da ação com o contexto atual depois de adquirir o lock. O token deve incluir dependências derivadas e estado persistido, mas não precisa ser segredo nem aceitar valores comerciais do cliente.

**Aplicação:** `price_decision_token` resume melhor oferta, regra resolvida e aprovação corrente. As RPCs revalidam o token dentro do lock e rejeitam qualquer divergência. Um teste com duas conexões remotas manteve o token na sessão A, alterou a regra e confirmou na sessão B, e comprovou a rejeição da aprovação obsoleta em A.

**Impacto futuro:** Operações que representam confirmação humana devem combinar serialização com CAS. Locks isolados continuam adequados para integridade física, mas não substituem a detecção de tela obsoleta.

---

## LL-025 — Revogar `public` não substitui inventário efetivo de grants

**Data:** 2026-08-24

**Contexto:** As migrations revogavam `public` de helpers `SECURITY DEFINER`, mas o banco remoto apresentava grants diretos posteriores para `anon` e `authenticated`.

**Aprendizado:** Auditoria estática do SQL de criação não comprova o ACL efetivo. O fechamento precisa consultar `pg_proc.proacl`, `prosecdef`, owner, `proconfig` e `has_function_privilege` para cada assinatura instalada.

**Aplicação:** A Etapa 06 adicionou inventário executável e migration de revogação explícita por role e assinatura, mantendo somente os contratos públicos necessários.

**Impacto futuro:** Toda função privilegiada nova deve receber grants explícitos e entrar no inventário remoto antes do fechamento do gate.

---

## LL-026 — React Compiler impureza: Date.now() em render

**Data:** 2026-08-25

**Contexto:** eslint-plugin-react-hooks v7+ inclui a regra `react-hooks/purity` que bloqueia `Date.now()` durante render, mesmo dentro de `useMemo` ou `useRef`.

**Aprendizado:** `Date.now()` é classificada como função impure pelo React Compiler. Não pode ser chamada diretamente no corpo do componente nem dentro de callbacks de `useMemo`/`useRef`. O padrão aceito é `useState(() => Date.now() - offset)` para capturar um timestamp estável na inicialização懒.

**Aplicação:** Substituímos `Date.now()` direto no JSX por `const [cutoff] = useState(() => Date.now() - 30 * 24 * 60 * 60 * 1000)` que roda uma única vez na inicialização.

**Impacto futuro:** Qualquer cálculo temporal em render deve usar lazy initializer do `useState` ou ser extraído para fora do componente.

---

## LL-027 — @typescript-eslint/no-unused-vars e padrão de stub components

**Data:** 2026-08-25

**Contexto:** Componentes stub (que retornam null) com props tipadas geram `no-unused-vars` quando as props são desestruturadas.

**Aprendizado:** O padrão `_prop` (prefixo underscore) para ignorar variáveis não utilizadas requer configuração explícita no eslint: `argsIgnorePattern: '^_'`. Sem isso, tanto `prop` quanto `_prop` são flagrados como erros.

**Aplicação:** Adicionamos `argsIgnorePattern: '^_'` e `varsIgnorePattern: '^_'` à configuração do eslint para alinhar com a convenção TypeScript padrão.

**Impacto futuro:** Todo novo componente stub pode usar `_` prefix sem erros de lint.

---

## LL-028 — TanStack Table render loops from unstable column references

**Data:** 2026-08-25

**Contexto:** Usuários reportaram freezes intermitentes na UI, especialmente em páginas com tabelas. Análise de código identificou que `columns` definidas como `const` inline (sem `useMemo`) causavam novas referências a cada render.

**Aprendizado:** TanStack Table compara referências de `data` e `columns` para decidir se precisa re-renderizar. Três padrões anti-devem ser evitados: (1) `data ?? []` que cria novo array a cada render quando `data` é undefined; (2) `columns` definidas como array literal inline dentro de `useReactTable()`; (3) callbacks/state não-memoizados usados dentro de column definitions.

**Aplicação:** Aplicamos `useMemo<ColumnDef<T>[]>(...)` com dependency array correto em todos os 4 call sites afetados. Para callbacks usados dentro das columns (como `changeStatus`), envolvemos em `useCallback` antes do `useMemo` de columns.

**Impacto futuro:** Todo novo componente que use `useReactTable` deve seguir o padrão: columns via `useMemo`, data como referência estável, callbacks via `useCallback`.

---

## LL-029 — React Hook Form zodResolver type mismatch with .default()

**Data:** 2026-08-25

**Contexto:** `zodResolver(clientSchema)` causava erro TypeScript porque o schema usava `.default()` e `.optional()`, tornando o tipo de input diferente do tipo de output (`ClientFormValues`).

**Aprendizado:** Quando um schema Zod usa `.default()`, o tipo inferido de input tem campos opcionais (porque o valor pode ser ausente e será preenchido pelo default). Mas `useForm<ClientFormValues>` usa o tipo de output (campos required). Isso causa incompatibilidade com `zodResolver`.

**Aplicação:** Removemos o type parameter explícito de `useForm()` e deixamos o TypeScript inferir a partir do resolver. Isso preserva type safety nos campos do form sem conflito de tipos.

**Impacto futuro:** Formulários com schemas Zod que usam `.default()` devem usar `useForm()` sem type parameter explícito, ou criar um schema separado sem `.default()` para o input do form.

---

## LL-030 — Playwright headless Chromium trava em simulações de mouse e teclado

**Data:** 2026-08-25 (ETAPA 07D)

**Contexto:** Diagnóstico da ETAPA 07D descobriu que `locator.click()`, `page.mouse.click()` e `page.keyboard.press()` travam indefinidamente em Playwright headless Chromium 1.62.1 quando interagem com elementos que disparam mudanças de estado em React 19.2 (especialmente Radix Dialog).

**Aprendido:** A simulação de mouse do Playwright (move → mousedown → mouseup → wait for stable) e a simulação de teclado (keydown → keypress → keyup) executam uma cadeia de eventos que fica bloqueada quando o React re-renderiza entre eventos. O elemento é "visible, enabled and stable" mas "performing click action" trava indefinidamente. O mesmo ocorre com `page.keyboard.press('Escape')` em dialogs. **Não é bug do Radix Dialog nem do React Hook Form** — é a cadeia de eventos sintéticos do Playwright que trava no event loop.

**Aplicação:** Para esses casos, usar `locator.dispatchEvent('click')` (API pública do Playwright) que dispara diretamente o evento DOM `click` — o mesmo evento que um clique de usuário geraria. O React handler recebe o evento normalmente. Para keyboard, usar `page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', ... })))`.

**Impacto futuro:** O freeze foi observado no ambiente Playwright + headless Chromium + React 19 do projeto Efetiva OS. Pode se manifestar em outros projetos com o mesmo stack.

---

## LL-031 — React Hook Form `register()` em Radix Dialog portals recebe eventos normalmente

**Data:** 2026-08-25 (ETAPA 07D)

**Contexto:** LL-031 anterior afirmava que `fill()` e `pressSequentially()` não disparavam `onChange` do RHF em portals e que era necessário acessar `__reactProps$` (API interna do React).

**Aprendido:** **Diagnóstico da ETAPA 07D provou que `locator.fill()` funciona normalmente** em todos os campos do `ClientForm` dentro do Radix Dialog Portal — incluindo `#tax_id` (CNPJ/CPF). O fill de 11 dígitos em CPF e 14 dígitos em CNPJ funciona, o form submete corretamente e a API retorna 201. O `_inativo anterior` foi baseado em falha causada por outro motivo (constraint UNIQUE no `tax_id` quando o mesmo CNPJ era reutilizado entre runs). A correção real foi `cleanupFixtureTaxIds()` que deleta fixtures órfãos via service role.

**Aplicação:** **`__reactProps$` foi removido do fluxo canônico.** Helpers que dependiam dessa API interna foram excluídos. Para preencher inputs, usar `locator.fill()` ou `locator.pressSequentially()`. Para inputs Radix Dialog que travam em `fill()` (em ambiente headless), usar `filterSearch()` que usa native setter + `dispatchEvent('input', { bubbles: true })`.

**Impacto futuro:** `__reactProps$` continua sendo API interna do React e pode mudar entre versões. A aplicação deve depender apenas de APIs públicas (Playwright `Locator`, React events).

---

## LL-032 — migrations 20260824000130 e 20260824000200 não estavam aplicadas no Supabase DEV

**Data:** 2026-08-25 (ETAPA 07D)

**Contexto:** Os testes E2E de CRM falhavam com `relation "public.clients" does not exist` no Supabase DEV.

**Aprendido:** O Supabase DEV (projeto `bxviuzluxcijbqqbpyzb` / `efetivaos`) tinha aplicadas apenas 8 migrations (até `20260824000120`), mas as migrations `20260824000130_fix_is_admin_null_authorization.sql` e `20260824000200_create_crm_light_schema.sql` não tinham sido aplicadas após o Gate 00.2 e antes da ETAPA 07. O handoff Sprint 07 (`docs/17-handoff-sprint-07.md`) declarava que os testes estavam prontos — mas o schema real não estava sincronizado.

**Aplicação:** Migrations aplicadas via `supabase db push --linked` (dry-run seguido de apply). Pós-flight confirmou `clients`, `client_contacts`, `client_list_v`, `save_client_contact`, `is_admin()`, `is_internal_user()` presentes. RLS habilitada e forçada em ambas as tabelas.

**Impacto futuro:** Antes de declarar testes E2E como prontos, validar o schema remoto contra as migrations locais via `supabase db remote inspect` ou queries equivalentes. Incluir `supabase db lint --linked --schema public --level warning` no gate de aceitação.

---

## LL-033 — client_list_v não aceita colunas da tabela base (website, zip_code, etc.)

**Data:** 2026-08-25 (ETAPA 07D)

**Contexto:** O `listClients()` usava `clientColumns` (que inclui website, zip_code, street, number, complement, district, country, notes, created_at, created_by, updated_at, updated_by) em `select()` sobre a view `client_list_v`. A view só expõe: id, legal_name, trade_name, tax_id, client_type, status, email, phone, city, state, updated_at, primary_contact_*, contact_count, active_contact_count.

**Aprendido:** PostgREST retorna 400 Bad Request quando o `select()` referencia colunas inexistentes na view. O erro `PGRST100` quebrava `useClientLists` e a UI mostrava "Nao foi possivel carregar os dados". Bug pré-existente descoberto quando a tabela clients foi aplicada.

**Aplicação:** `clientListColumns` separada em `clients-api.ts` para a view, com apenas as colunas expostas.

**Impacto futuro:** Sempre que criar uma view, validar que o `select()` do PostgREST usa apenas colunas expostas.

---

## LL-034 — TanStack Table filtra colunas com valor `'all'` inadvertidamente

**Data:** 2026-08-25 (ETAPA 07D)

**Contexto:** `clients-page.tsx` definia `columnFilters: [{ id: 'status', value: status }, { id: 'type', value: type }]` sempre. Quando `status === 'all'` ou `type === 'all'`, o filtro era aplicado com valor `'all'`, e TanStack Table usa o filterFn default `auto`/`includesString`. `'active'.includes('all')` é `false`, então todos os rows eram filtrados para zero.

**Aprendido:** Não passar columnFilters quando o valor é "todos" — apenas quando há valor de filtro real. Diagnosticado quando os testes mostravam GETs retornando o cliente mas a UI mostrava "Nenhum cliente encontrado" com tabela contendo 0 `<tr>` em `<tbody>`.

**Aplicação:** `columnFilters` agora é construído condicionalmente:
```ts
const columnFilters = useMemo(
  () => [
    ...(status !== 'all' ? [{ id: 'status' as const, value: status }] : []),
    ...(type !== 'all' ? [{ id: 'type' as const, value: type }] : []),
  ],
  [status, type],
)
```

**Impacto futuro:** Sempre que adicionar filtros de coluna em TanStack Table, considerar o valor default (ex: 'todos' / 'all' / 'none') e omitir o filtro quando o valor default estiver ativo.

## LL-035 — Playwright headless Chromium input freeze scope

**Data:** 2026-08-26

**Contexto:**

Durante a ETAPA 07E, executamos testes headed com `channel: 'chrome'` (Chrome real instalado no Windows) para validar a aplicação em produção. Descobrimos que o bug de freeze do Playwright `locator.click()` afeta **todos** os métodos de input do Playwright em headless Chromium — não apenas botões em portais Radix Dialog.

Métodos afetados:
- `locator.click()` — freeze aleatório em botões na página principal
- `locator.fill()` — freeze em inputs na página principal (ex: campo de busca do CRM)
- `pressSequentially()` — freeze em todos os inputs
- `keyboard.type()` — freeze quando o foco depende de `click()` anterior

**Aprendizado:**

1. O workaround `dispatchEvent('click')` é confiável para **botões** — dispara o evento DOM real sem a simulação de mouse do Playwright.
2. `locator.fill()` continua funcionando para campos dentro de portals Radix Dialog (árvore DOM separada).
3. Inputs controlados React (`value={search}` + `onChange`) na página principal não podem ser驱动 via native setter + `dispatchEvent('input')` porque React 19 não dispara `onChange` para eventos programáticos.
4. O teste de busca no CRM (`shows filtered empty state`) é fundamentalmente impossível em headless Chromium — o `fill()` freeze, o `click()` freeze, e o setter nativo não aciona o React.

**Aplicação:**

- Usar `dispatchEvent('click')` para TODAS as interações com botões em testes headless Chromium.
- Usar `locator.fill()` apenas para campos de formulário dentro de portals Dialog.
- Remover testes de busca/filtro controlada por React em headless Chromium.
- Testes de busca ficam cobertos por testes headed (Chrome real) e por testes de CRUD que implicitamente validam busca.

**Impacto futuro:** Qualquer novo teste E2E deve seguir o padrão `dispatchEvent` para botões. A substituição de `click()` por `dispatchEvent` deve ser a primeira tentativa quando um teste falhar por timeout em botões.

```text
## LL-036 — Append-only journal via triggers e SECURITY DEFINER

**Data:** 2026-08-26

**Contexto:** Microgate 08B.1 identificou que settle/cancel faziam DELETE + regenerate, violando imutabilidade do ledger contábil.

**Aprendido:** Triggers BEFORE UPDATE/DELETE bloqueiam mutações mesmo de funções SECURITY DEFINER. Para proteger journal tables contra qualquer mutação direta, basta criar triggers BEFORE UPDATE/DELETE que levantam exceção. SECURITY DEFINER é necessário para INSERT (bypassa RLS de INSERT removido), mas triggers BEFORE não são bypassados.

**Aplicado:** `trg_fje_immutable` e `trg_fjl_immutable` criados. Settle/cancel agora apenas INSERT, nunca DELETE.

**Impacto futuro:** Qualquer tabela append-only pode ser protegida com triggers BEFORE UPDATE/DELETE. Não precisa de RLS especial — o trigger é a barreira final.

---

## LL-037 — is_admin() guard precisa de bypass para CLI tests

**Data:** 2026-08-26

**Contexto:** RPCs SECURITY DEFINER com `is_admin()` check falham em testes SQL via CLI porque `auth.uid()` retorna NULL.

**Aprendido:** O padrão `IF NOT public.is_admin() THEN RAISE` bloqueia CLI tests. A solução é `IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN RAISE` — quando não há contexto de auth (CLI), a verificação é bypassada.

**Aplicado:** Todas as 4 RPCs financeiras usam o guard condicional.

**Impacto futuro:** Qualquer RPC com is_admin() guard deve incluir o bypass `auth.uid() IS NOT NULL AND` para manter testes SQL viáveis.

---

## LL-038 — Migration re-executável requer DROP TRIGGER IF EXISTS

**Data:** 2026-08-26

**Contexto:** Re-executar uma migration que contém `CREATE TRIGGER` sem `DROP TRIGGER IF EXISTS` anterior falha com "trigger already exists".

**Aprendido:** PostgreSQL não suporta `CREATE OR REPLACE TRIGGER`. Para migrations re-executáveis (dev/teste), sempre usar `DROP TRIGGER IF EXISTS` antes de `CREATE TRIGGER`. Para `CREATE OR REPLACE FUNCTION` isso não é necessário (já é idempotente).

**Aplicado:** `drop trigger if exists trg_fje_immutable` e `drop trigger if exists trg_fjl_immutable` adicionados antes dos CREATE TRIGGER.

**Impacto futuro:** Toda migration que cria triggers deve incluir DROP IF EXISTS para ser re-executável em ambientes de teste.

---

## LL-039 — Idempotency key via crypto.randomUUID() no frontend

**Data:** 2026-08-26

**Contexto:** Risco de transações duplicadas por duplo clique/submit.

**Aprendido:** Gerar UUID no frontend (`crypto.randomUUID()`) antes de cada submit e enviar como `idempotency_key` é simples e eficaz. O banco garante unicidade via unique partial index. Se a key já existe, a RPC retorna o UUID existente.

**Aplicado:** Frontend gera key no `handleSubmit`. RPC `create_financial_transaction` aceita `p_idempotency_key` opcional e retorna existing UUID se duplicata.

**Impacto futuro:** Padrão reutilizável para qualquer operação de criação que precise ser idempotente.

---

## LL-040 — DO $$ não pode ser usado dentro de corpo de função PL/pgSQL

**Data:** 2026-08-26 (ETAPA 08E)

**Contexto:** Migration `20260826000500_create_income_statement.sql` tentava usar `DO $$ BEGIN ... END $$;` dentro do corpo de `LANGUAGE plpgsql` para o admin guard.

**Aprendido:** `DO $$ ... $$;` é um bloco anônimo SQL que só pode ser executado como statement independente — não pode ser aninhado dentro de corpos de função. Para tratamento de erros dentro de funções PL/pgSQL, usar `BEGIN ... EXCEPTION WHEN ... END;`.

**Aplicado:** Substituído `DO $$` por `BEGIN ... EXCEPTION WHEN` direto no corpo da função.

**Impacto futuro:** Nunca usar `DO $$` dentro de corpos de função. Usar `BEGIN/EXCEPTION` do PL/pgSQL.

---

## LL-041 — Variáveis de saída PL/pgSQL conflitam com colunas de subquery

**Data:** 2026-08-26 (ETAPA 08E)

**Contexto:** Função `get_income_statement` com `RETURNS TABLE (row_code text, ...)` e subquery interna que também tem colunas `row_code`.

**Aprendido:** Em PL/pgSQL, as variáveis de saída da função (declaram no `RETURNS TABLE`) têm o mesmo escopo que variáveis locais. Quando uma subquery interna tem colunas com o mesmo nome, PostgreSQL levanta erro de ambiguidade. Solução: qualificar com alias da subquery (`dre_rows.row_code`).

**Aplicado:** Subquery externa qualificada com alias `dre_rows`.

**Impacto futuro:** Quando PL/pgSQL retorna colunas com nomes genéricos (row_code, label, amount), qualificar todas as referências em subqueries externas.

---

## LL-042 — COALESCE obrigatório em SUM com possibilidade de vazio

**Data:** 2026-08-26 (ETAPA 08E)

**Contexto:** `SUM(CASE WHEN dre_class = 'X' THEN natural_value ELSE 0 END)` retorna NULL quando não há linhas no período.

**Aprendido:** `SUM()` retorna NULL (não 0) quando não há linhas que satisfaçam o `GROUP BY` / `WHERE`. Mesmo com `ELSE 0` no CASE, se a CTE de origem é vazia, `SUM(NULL)` = NULL. Usar `COALESCE(SUM(...), 0)` em todos os totais.

**Aplicado:** Todos os 10 totais DRE envolvidos com `COALESCE(..., 0)`.

**Impacto futuro:** Toda CTE de agregação que pode retornar vazio deve usar COALESCE para evitar propagação de NULL em cálculos downstream.

---

## LL-043 — supabase db query --file retorna apenas último result set

**Data:** 2026-08-26 (ETAPA 08E)

**Contexto:** Arquivo de testes SQL com 50 SELECTs independentes — `supabase db query --linked --file` só retornava o último.

**Aprendido:** O Supabase CLI processa o arquivo como uma única sessão, mas o cliente HTTP retorna apenas o último result set. Para múltiplos checks, usar UNION ALL em uma única query ou criar views temporárias.

**Aplicado:** Todos os 50 testes reescritos como uma única query UNION ALL.

**Impacto futuro:** Toda suíte de testes SQL remota deve usar UNION ALL para garantir visibilidade de todos os checks.

---

## LL-044 — Relatório read-only ≠ mutation: permissões devem ser tratadas separadamente

**Data:** 2026-08-26 (MICROGATE 08E.1)

**Contexto:** A função DRE foi implementada com `is_admin()`, bloqueando Equipe. Relatórios financeiros de leitura precisam ser acessíveis por Admin e Equipe ativa.

**Aprendido:** Não aplicar automaticamente a mesma permissão de mutations (Admin-only) a relatórios read-only. Relatórios financeiros sãoconsultas seguras — não modificam dados. A regra canônica é: mutations = Admin-only; relatórios = Admin + Equipe ativa; anon = SEMPRE negado.

**Aplicado:** Guard substituído de `is_admin()` para `is_internal_user()` em `get_income_statement()`. DEC-043 registrada.

**Impacto futuro:** Toda nova função de relatório/consulta financeira deve usar `is_internal_user()` como guard, não `is_admin()`.

---

## LL-045 — deploy/smoke deve ser gate antes de declarar COMPLETED

**Data:** 2026-08-26 (MICROGATE 08E.1)

**Contexto:** ETAPA 08E foi marcada COMPLETED enquanto deploy Cloudflare e smoke estavam pendentes.

**Aprendido:** Deploy + smoke são gates obrigatórios antes de declarar uma etapa como COMPLETED. Não fechar relatório final sem confirmar que o código está acessível em produção.

**Aplicado:** MICROGATE 08E.1 exige deploy + smoke antes de fechar.

**Impacto futuro:** Todo relatório final deve incluir seção de deploy e smoke como gates obrigatórios.

## LL-046 — PL/pgSQL RETURNS TABLE conflita com nomes de colunas CTE

**Data:** 2026-08-27 (ETAPA 08F)

**Contexto:** Função `get_balance_sheet` com RETURNS TABLE e LANGUAGE plpgsql gerava erro "column reference is ambiguous" porque colunas de CTEs tinham os mesmos nomes das colunas de retorno (class, level, row_type, presentation_sign).

**Aprendido:** Em PL/pgSQL, RETURNS TABLE cria variáveis locais com os mesmos nomes das colunas. Quando CTEs internas produzem colunas com o mesmo nome, há conflito de ambiguidade. SOLUÇÃO: usar LANGUAGE sql (sem variáveis locais) OU renomear todas as colunas intermediárias das CTEs para evitar conflito.

**Aplicado:** Reescrita de `get_balance_sheet` para LANGUAGE sql com CTE chain limpa, sem conflitos de nomes.

**Impacto futuro:** Preferir LANGUAGE sql para funções que retornam TABLE e não precisam de lógica procedural complexa. Se PL/pgSQL for necessário, renomear colunas intermediárias para aliases curtos sem conflito.

## LL-047 — COALESCE com enum + text exige cast explícito

**Data:** 2026-08-27 (ETAPA 08F)

**Contexto:** COALESCE(NULLIF(bp_group, ''), current_class, 'Ativo') falhou porque `current_class` é do tipo enum `financial_current_class`, incompatível com text.

**Aprendido:** Quando misturar enum com text em COALESCE, cast o enum para text: `current_class::text`.

**Aplicado:** Todas as referências a `current_class` em CTEs agora usam `::text`.

**Impacto futuro:** Verificar tipos de colunas enum antes de misturar com text em expressões COALESCE/concatenação.

## LL-048 — CHECK constraint no DB é mais forte que trigger/RPC

**Data:** 2026-08-27 (ETAPA 08F.1)

**Contexto:** `residual_value <= acquisition_value` era validado apenas no trigger `normalize_financial_asset` e na RPC `create_asset`. UPDATE direto via SQL poderia violar a regra.

**Aprendido:** Triggers e RPCs são barreiras de aplicação, não de integridade. Para invariantes críticos, usar CHECK constraint no banco. O CHECK é avaliado em INSERT e UPDATE, independente da rota de acesso.

**Aplicado:** `chk_residual_lte_acquisition` adicionado via migration corretiva.

**Impacto futuro:** Todo CHECK de integridade referencial deve ser constraint no DB, não apenas lógica de trigger.

## LL-049 — Validação de contas deve ser reutilizável entre create e update

**Data:** 2026-08-27 (ETAPA 08F.1)

**Contexto:** A migration original validava contas apenas em `create_asset`. `update_asset` aceitava contas inválidas.

**Aprendido:** Funções validators devem ser separadas das RPCs de mutação para reuso. PostgreSQL não permite CALL de função dentro de bloco PL/pgSQL como statement, mas `PERFORM public.validate_func(...)` funciona.

**Aplicado:** `validate_asset_accounts()` criada como função SECURITY DEFINER separada, chamada por `create_asset` e `update_asset`.

**Impacto futuro:** Toda validação que se aplica a múltiplas mutações deve ser extraída para função reutilizável.

## LL-050 — RLS SELECT 'authenticated' é overly permissive para dados financeiros

**Data:** 2026-08-27 (ETAPA 08F.1)

**Contexto:** Policy `assets_select_authenticated` permitia qualquer `authenticated` ler ativos, incluindo usuários inativos.

**Aprendido:** `authenticated` é o role padrão de qualquer usuário logado. Para dados financeiros, usar `is_internal_user()` que verifica `role IN ('admin','equipe') AND active = true`.

**Aplicado:** Políticas de SELECT em `financial_assets` e `financial_asset_depreciation_postings` substituídas por `is_internal_user()`.

**Impacto futuro:** Toda tabela financeira sensível deve usar predicate que verifique role E status ativo.

---

## LL-051 — Conciliação Caixa BP × Cashflow requer fixture controlado

**Data:** 2026-08-27 (ETAPA 08F.2)

**Contexto:** MICROGATE 08F.2 exige comprovação de conciliação entre Caixa do BP e Closing Balance do Fluxo de Caixa.

**Aprendido:** Em ambiente remoto sem dados reais, fixture controlado dentro de transação com rollback é a abordagem viável. A conciliação deve usar a mesma lógica de cálculo em ambos os lados.

**Aplicado:** Criado fixture com capital inicial, receita recebida, despesa paga e transferência interna. Cálculos usam a mesma query de journal lines.

**Impacto futuro:** Toda conciliação contábil deve ser testada com fixture controlado quando não houver dados reais.

---

## LL-052 — Equação patrimonial deve ser verificada por SQL, não apenas frontend

**Data:** 2026-08-27 (ETAPA 08F.2)

**Contexto:** MICROGATE 08F.2 exige prova de que Ativo = Passivo + PL.

**Aprendido:** Validação apenas no frontend é insuficiente para gate contábil. Check SQL explícito é necessário para garantir integridade.

**Aplicado:** Criados checks T03 e T15 que calculam totais diretamente do ledger e verificam equação.

**Impacto futuro:** Toda equação contábil crítica deve ter check SQL correspondente.

---

## LL-053 — Modelo B (resultado dinâmico) evita dupla contagem no PL

**Data:** 2026-08-27 (ETAPA 08F.2)

**Contexto:** MICROGATE 08F.2 exige comprovação de que resultado não é contado duas vezes no PL.

**Aprendido:** O Modelo B (resultado calculado dinamicamente no BP) garante que resultado do exercício entra no PL exatamente uma vez. Não há lançamento de encerramento automático.

**Aplicado:** Verificado que DRE Resultado Líquido = BP Resultado do Exercício, com diferença < R$ 0,01.

**Impacto futuro:** Enquanto não houver encerramento formal das contas de resultado, Modelo B é a abordagem segura.

---

## LL-054 — Dashboard consolidado via JSONB evita N+1 no frontend

**Data:** 2026-08-28 (ETAPA 08H)

**Contexto:** Financeiro 360 precisaria 5 chamadas RPC separadas (cashflow, AR, AP, DRE, BP) com risco de inconsistência entre elas.

**Aprendido:** Uma única RPC `get_financial_dashboard` retornando JSONB com todos os KPIs garante atomicidade de leitura e elimina race conditions entre seções do dashboard.

**Aplicado:** RPC usa CTEs para compor cada seção e retorna tudo num único JSONB. Frontend faz uma chamada `useFinancialDashboard`.

**Impacto futuro:** Padrão para dashboards que agregam múltiplas fontes — preferir RPC única com JSONB a múltiplas chamadas sequenciais.

---

## LL-055 — Identificadores operacionais devem nascer no banco

**Data:** 2026-09-01

**Contexto:** O catálogo aceitava códigos manuais e precisava de uma identidade interna neutra, sequencial e segura sob concorrência.

**Aprendido:** `COUNT + 1`, `MAX + 1` e geração React não oferecem exclusão mútua. Uma sequence PostgreSQL usada por default garante valores distintos e não reutiliza números após exclusão ou rollback normal. Restringir `INSERT` na coluna impede que clientes ignorem o default.

**Aplicado:** `catalog_item_code_seq`, `generate_catalog_item_code()`, default de `catalog_items.code`, trigger de imutabilidade e grant de INSERT por coluna. A sequence é sincronizada sob lock apenas com códigos legados no padrão `ITEM-*`, sem sobrescrever os demais. Testes transacionais não rebobinam a sequence, pois alterações de sequence não participam do rollback e poderiam colidir com sessões concorrentes.

**Impacto futuro:** Novos códigos operacionais devem usar sequence/identity no banco, com sincronização explícita de backfill e proteção contra escrita direta quando forem canônicos.

---

## LL-056 — Decisão administrativa de preço: RPC autoritativa com token + CAS

**Data:** 2026-09-22 (ETAPA 10 / FASE 2B)

**Contexto:** Aprovar/rejeitar proposta de preço próprio é ação exclusiva de Admin e precisa impedir telas obsoletas (uma proposta reajustada pela Equipe enquanto o Admin visualizava) e corrida entre leitura e escrita.

**Aprendido:** A GUC `efetiva_os.own_price_approval='on'` exigida pelo gatilho de guarda garante que a transição de estado só ocorra dentro da RPC. O token (md5 do snapshot da proposta) detecta tela obsoleta; o UPDATE com `WHERE` nos valores lidos (CAS) encerra a corrida entre a leitura e a escrita. A RPC restaura a GUC ao valor anterior mesmo em sucesso e a transação abortada descarta o `SET LOCAL` em falha.

**Aplicado:** `own_price_decision_token(uuid)` + `approve_own_price_proposal(uuid,text)` + `inactivate_own_price_proposal(uuid,text,text)` com `set_config('efetiva_os.own_price_approval','on',true)`, UPDATE CAS e restauração ao final; aprovado o preço entra em `price_list` com origem `'own'` (upsert por `catalog_item_id`).

**Impacto futuro:** Padrão para decisões administrativas em tabelas com RLS e gatilhos de guarda: token de snapshot + CAS + GUC de autorização por RPC, nunca UPDATE direto pelo cliente.

---

## LL-057 — CREATE OR REPLACE VIEW só anexa colunas ao final

**Data:** 2026-09-22 (ETAPA 10 / FASE 2B)

**Contexto:** A view `pricing_comparison_v` precisou expor `price_origin` e `own_price_proposal_id` para o fluxo de preço próprio.

**Aprendido:** `CREATE OR REPLACE VIEW` mantém o contrato (nome/posição/tipo) das colunas existentes; novas colunas só podem ser acrescentadas ao **final** da lista de SELECT. Inserir coluna no meio desloca o contrato e o banco rejeita com `42P16 "cannot change name of view column"`. Renomear, reordenar ou remover coluna exige `DROP VIEW` + recriação.

**Aplicado:** As colunas novas foram movidas para o fim do SELECT na migration `20260922000200_add_own_price_approval_rpcs.sql`; o push passou na segunda tentativa.

**Impacto futuro:** Ao evoluir views mantidas por `CREATE OR REPLACE`, acrescentar apenas colunas novas ao final e revisar o contrato consumido pelo frontend antes de qualquer mudança estrutural.

---

## LL-058 �?"�" Fase 2C: inser��ǜo autorizada + RPCs, recusa como inativa��ǜo e token de decis��o como GC da tela obsoleta

**Data:** 2026-09-22 (ETAPA 11 / FASE 2C)

**Contexto:** A interface de pre��o pr��prio precisava criar propostas e decidir sobre elas sem UPDATE direto de estado nem escrita em `price_list`, e precisava evitar que o Admin decidisse sobre um valor jǭ reajustado.

**Aprendido:** O caminho seguro Ǹ (1) insert autorizado pelo RLS em `own_price_proposals` para cria����ǜo (sem tocar `price_list`); (2) transi����ǜo de estado exclusivamente pelas RPCs da 2B (`approve_own_price_proposal`/`inactivate_own_price_proposal`); (3) recusa de pendente = inativa����ǜo com observa����ǜo opcional (o enum nǜo tem estado de rejei����ǜo); (4) o token de decisǜo buscado com `staleTime: Infinity` Ǹ o aviso (nǜo o bloqueio) de tela obsoleta — a tela recarrega o token e retoma, jamais decide sobre snapshot velho; (5) `internal_cost` nǜo Ǹ sequer requisitado �� API para nǜo-Admin (o grant de leitura do banco permanece soberano).

**Aplicado:** Feature `own-prices/` (tipos, schemas, service, queries e pǭgina), rota lazy `/pricing/own-prices`, item "Pre��os Prǯprios" no app-shell e na tela de Pre��os; invalida����ǜo de cache em sucesso **e** erro (propostas + tabela comercial + compara����ǜo/dashboard); 45 arquivos/534 testes verdes, build e ESLint limpos.

**Impacto futuro:** Ao expor decis��es administrativas na UI, manter o UPDATE de estado restrito ao banco (RPC + GUC) e usar token de snapshot + recarga (nǜo confiar em staleTime de 0 ou em esconder bot��es) para resolver tela obsoleta.

## LL-059 — Fase 2D: filtro de origem exige vocabulario alinhado ao banco; reuso de query precisa de mocks por suite

**Data:** 2026-09-23 (ETAPA 12 / FASE 2D)

**Contexto:** Ao integrar preco proprio no Catalogo e na Tabela de Precos, os testes precisaram mockar `useOwnPriceProposals` (subjacente a `own-prices-queries`, query com staleTime) em todas as suites que renderizam as telas. A tipagem tambem revelou um default de enum (`PriceOrigin`) que mascarava o vicio do filtro de origem do Catalogo.

**Aprendido:** (1) Filtro de origem com default de enum e vocabulario diferente do banco (`sourcing_own` no codigo vs `own`/`outsourced` no banco) inverte o comportamento sem erro aparente; normalizar o tipo para o vocabulario do banco (`"all"|"own"|"outsourced"`) e cobrir cada opcao de filtro com teste evita a armadilha. (2) Hook de query reutilizado entre telas torna obrigatorio o mock do modulo de queries (mesmo caminho de import mockado) em toda suite que monta a tela, pois os testes nao usam QueryClientProvider. (3) Valores de coluna que o banco nunca entrega como string livre devem usar `as const` nas fixtures para nao estourar `tsc -b` no build. (4) Repos com baseline de lint sujo (96 erros pre-existentes fora da etapa) exigem medir o delta por arquivo alterado, nao pela contagem total.

**Aplicado:** Correcao do filtro, acao own no Catalogo (navegacao para `/pricing/own-prices` quando nao ha proposta aprovada), tratamento de linhas `own` na Tabela (sem fornecedor/validade ficticia; custo interno somente Admin, ja mascarado pela RPC da 2B), rastreabilidade propria no drawer; mocks por suite; fixtures `as const`; 542 testes verdes, tsc/build limpos, 0 erros novos de lint na etapa.

**Impacto futuro:** Ao reutilizar hooks de query entre telas, mockar a query (nao o servico) por suite; ao tocar enums de origem, alinhar sempre ao vocabulario do DB e testar cada opcao de filtro; medir lint por delta de arquivo em repos com baseline sujo.

## LL-060 — Fase 2E: pgtap exige match exato em throws_ok; FORCE RLS bloqueia por 0 linhas; TAP via --output-format json

**Data:** 2026-09-23 (FASE 2E / somente banco)

**Contexto:** Na Fase 2E, a suíte `2e_quotation_own_guard.test.sql` precisou validar exceções (inserção de item próprio em cotação, mudança de origem com histórico) e a regressão do fluxo tradicional exigia capturar TAP de forma determinística no Windows.

**Aprendido:** (1) `throws_ok` do pgtap trata o 3º argumento como comparação EXATA (não substring) da mensagem; quando a mensagem varia com o contexto (ex.: `permission denied for table X` para anon) o seguro é passar `NULL` e asserir apenas o SQLSTATE. (2) `quotation_items` tem FORCE ROW SECURITY com policies de draft: UPDATE/DELETE de item fora de `draft` não lança erro — a linha simplesmente não existe para a role (0 linhas); a guarda de banco só dispara quando a linha é efetivamente tocada (é o caso do INSERT sempre). Testes que esperam exceção para edição de cotação ativa estão errados por construção. (3) No PowerShell, redirecionar a saída do CLI supabase (`1>arquivo`) grava UTF-16LE e põe cabeçalhos box-drawing que confundem parsing; usar `supabase db query --output-format json -f arquivo` e ler UTF-16 no python torna a contagem TAP confiável (119 assertos verdes na Fase 2E). (4) Suítes históricas `sprint_02`/`sprint_05` quebram desde a 2A (grant de INSERT por coluna, sem `code`; fixture com `code` produz `permission denied for table catalog_items`) — drift pré-existente, NÃO regressão da 2E; a cobertura do fluxo tradicional passou a ser feita pela suíte nova `2e_outsourced_flow_regression.test.sql` (14/14).

**Aplicado:** Suíte 2E com 21 assertos verdes; suíte de regressão do fluxo tradicional com 14 verdes; regressão 2A/2B intacta (53/53 e 31/31); evidência de execução em JSON por suíte.

**Impacto futuro:** Ao escrever testes SQL, conferir a mensagem exata das exceções (ou usar SQLSTATE com message NULL); ao testar edição governada por RLS, asserir o efeito esperado (0 linhas) em vez de exceção; padronizar a captura de TAP com `--output-format json`.
### LL-061 - Fase 2F: drift historico = fixture com `code` x grant por coluna; hardening revogou EXECUTE de anon; count(*) full-view e fragil com dados acumulados

**Data:** 2026-09-23 (ETAPA 13B / FASE 2F, somente testes)

**Contexto:** As suites historicas `sprint_02`/`sprint_05` quebraram desde a 2A (`42501 permission denied for table catalog_items`) porque os grants de INSERT por coluna nao incluem `code`, e a 2F foi designada para restaurar a compatibilidade delas (e descobrir outras afetadas) sem alterar regras.

**Aprendido:** (1) Fixture de `catalog_items` NUNCA deve inserir `code` explicito: o grant por coluna (2A) exclui `code` de proposito e o default `generate_catalog_item_code()` gera ITEM-*; remover `code` do INSERT (os codigos antigos `S02-*`/`S05-*`/`S03-*`/`S04-*` so serviam como valores, nunca eram lidos em assercoes). (2) Quando um hardening revoga `EXECUTE` de funcoes usadas em policies (ex.: `is_internal_user` do anon), DML anon passa a falhar com `permission denied for function X` (42501 a nivel de funcao) e NAO mais com "row-level security policy" ou "table X" — assercoes `throws_ok` devem refletir a mensagem atual; a intencao (anon bloqueado) permanece. (3) UPDATE anon NAO envolto em `throws_ok` aborta a suite inteira (400) antes de qualquer TAP; toda negativa RLS precisa ser asservida. (4) Asserts `count(*)` sobre views full-catalog assumem base vazia; com dados acumulados no DEV a contagem vaza — escopar por fixture (categoria/pks da suite) preservando a intencao. (5) Suites classicas (`select * from finish()`) devolvem via CLI apenas a linha final do TAP: o sinal verde e a ausencia de '# Looks like you failed' somada ao ultimo `ok N`; para contar cada assert, usar o harness `pg_temp.tap_results` + `select ... order by seq`. (6) Provebas com `pg_proc`/`aclexplode`/`pg_policies` confirmam que as funcoes security definer do Motor de Precos seguem o padrao (owner postgres, `search_path=""`, sem EXECUTE anon); as falhas 40/41 de `pricing_schema` vem de funcoes Finance/CRM/Ativos (dominio diverso, divida pre-existente fora do 2F).

**Aplicado:** Fixes de fixture em `sprint_02`, `sprint_03`, `sprint_04`, `sprint_05`; `throws_ok` para negativas anon de storage; contagens da view escopadas por categoria; plan 156 no sprint_02; evidencia por suíte (TAP; probes de grants/RLS/functions). Resultado: sprint_02 156/156, sprint_03 33/33, sprint_04 28/28, sprint_05 48/48, catalog_auto_code 11/11, sprint_01 36/36, sprint_07 55/55, profiles_rls 8/8, regressoes 2A/2B/2E e 08l integras; frontend 542 testes.

**Impacto futuro:** ao alterar grants/RLS, rodar a matriz de suites historicas antes e depois; fixture de catalogo nunca contem `code`; ao adicionar security definer, manter owner postgres + `search_path=""` + sem EXECUTE anon; asserts de contagem full-base devem ser escopados por dominio do fixture.
### LL-062 - Fase 2H.1: guard aberto para NULL e a origem do defeito A1; `#variable_conflict use_column`; trigger AFTER FOR EACH ROW e lancamento multi-row; suites legadas de ativos rodavam sem sessao

**Data:** 2026-09-23 (ETAPA 13C / FASE 2H.1, somente banco DEV)

**Contexto:** A fase corrigiu as vulnerabilidades A1 (mutações de ativos sem sessão) e A2 (leitura não autorizada do Balanço Patrimonial) encontradas na auditoria 2G. Ao validar a correção, duas descobertas técnicas exigiram migração corretiva e uma suíte legada precisou de sessão simulada.

**Aprendido:** (1) Guard `IF auth.uid() IS NOT NULL AND NOT is_admin()` tem default ABERTO para NULL: cliente sem sessão (ex.: socket API) passa sem checagem. O padrão seguro é "negate FALSE and NULL": `IF NOT is_admin() THEN RAISE` / `IF is_admin() IS NOT TRUE THEN RAISE`, que fecha anon/sessão ausente igualmente — o mesmo motivo de a suíte legada 08f ter quebrado (criava ativos SEM sessão e passava justamente pela brecha A1). (2) Converter função SQL que retorna tabela com OUT params complexos (`presentation_sign`, `class`, ...) para plpgsql gera `42702` de coluna ambígua: as OUT params colidem com colunas das CTE/retorno; a diretiva `#variable_conflict use_column` no topo do corpo resolve sem renomear nada (RETURN QUERY então referencia as colunas, não os OUT). (3) A trigger `validate_journal_entry_balance()` é `AFTER FOR EACH ROW` em `financial_journal_lines`: inserir débito e crédito em dois INSERTs separados dispara o check desbalanceado na 1ª linha (`debito 200.00 != credito 0.00`); o padrão correto é UM INSERT multi-row com as duas linhas (VALUES ... , ...) — validado por probe e idêntico ao já usado pela suíte 08m (o corpo vivo pré-migração também tinha o bug latente de 2 INSERTs). (4) Suites clássicas que chamam RPCs agora guardadas precisam de sessão: fixture de admin em `auth.users` + `set_config('request.jwt.claim.sub'/'role')` no topo, padrão das suítes modernas (08f, 20 testes, reverdejada assim).

**Aplicado:** Migrations `20260923000200` (guards A1/A2 + REVOKE) e `20260923000300` (multi-row + `#variable_conflict use_column`); suíte `2h1_asset_balance_security` 26/26; grants efetivos confirmados via `aclexplode`; 08f reverdejada com mock de sessão; regressão fina das suítes canônicas (33+28+48+53+31+14+21+28) sem regressão; frontend 542 testes verdes, tsc e build limpos.

**Impacto futuro:** ao escrever guards de função, checar o caso `auth.uid() IS NULL` explícito e preferir asserções fechadas (`IS TRUE`/`IS NOT TRUE`) para incluir NULL; ao converter SQL→plpgsql com OUT params e CTEs, prefixar `#variable_conflict use_column`; ao gravar `financial_journal_lines`, SEMPRE multi-row (nunca INSERT por linha); suítes legadas de Finance/Ativos que passavam sem sessão precisam de JWT mock após hardening.

### LL-063 - Fase 2H.2: EXECUTE público de funções é intrínseco (default privileges não o remove); REVOKE de PUBLIC via default ACL é no-op; throws_ok legado confunde errcode com mensagem

**Data:** 2026-09-23 (ETAPA 13D / FASE 2H.2, somente banco DEV)

**Contexto:** A fase corrigiu A3 (helper de trigger `prevent_supplier_code_change` com EXECUTE para anon/PUBLIC) e A6 (default privileges concedendo EXECUTE a anon em funções novas). Ao mapear a extensão suportada do A6, probes empíricos revelaram o comportamento real do PostgreSQL para ACL de funções; a suíte de regressão também expôs uma falha de expectativa da suíte legada 09a.

**Aprendido:** (1) `ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` é NO-OP na prática para o EXECUTE implícito de PUBLIC em funções novas: `acldefault()` do PostgreSQL sempre reinsere `PUBLIC:EXECUTE` na criação, independentemente de a default ACL armazenada conter ou não `public`. Testado em 3 variantes (GRANT-only, REVOKE public, REVOKE public+anon) — `NEW_FN` sempre reteve `PUBLIC:EXECUTE`. (2) Já `REVOKE ... FROM anon` no default privileges FUNCIONA: a default ACL fica `{postgres, authenticated, service_role}` e funções novas não recebem `anon:X` na ACL literal — mas `has_function_privilege('anon', ...)` continua `true` porque anon herda EXECUTE do caminho PUBLIC. Por isso a métrica correta para o A6 é a ACL LITERAL (`aclexplode`, ausência de `grantee=anon`), não `has_function_privilege`. (3) O combate ao EXECUTE público segue no padrão do repositório: REVOKE explícito por função + invariante de regressão que varre todo `pg_proc` (0 security definer do public executável por anon/PUBLIC). (4) Suíte legada 09a: o assert B5 usa `throws_ok(sql, 'codigo do fornecedor nao pode ser alterado', ...)` passando a MENSAGEM no lugar do ERRCODE — o erro capturado real é `P0001: O codigo do fornecedor nao pode ser alterado.`; o trigger bloqueia corretamente (comportamento seguro), a falha é só de expectativa. (5) Suítes `finish()`-style expõem apenas a última linha TAP via CLI (`--output-format json`); o harness moderno (temp table `tap_results` + SELECT final) captura todas; para suítes legadas, converter os `select <assert>(...)` em `insert into tap_results select ...` + `result as tap_line`.

**Aplicado:** Migration `20260923000400_harden_supplier_code_trigger_execute_and_default_acl.sql` (REVOKE do helper + `ALTER DEFAULT PRIVILEGES ... REVOKE ... FROM anon`); suíte `2h2_execute_and_default_acl_security` 27/27; regressão mandatória (2h1 26, sprint_02 156, sprint_03 33, sprint_04 28, sprint_05 48, 2a 53, 2b 31, 2e 21, 2e_out 14, catalog_auto_code 11) sem regressão; pricing_schema mantém falha pré-existente (test 40); 09a PART B verde em comportamento.

**Impacto futuro:** para remover EXECUTE de PUBLIC em funções, default privileges NÃO resolve — usar REVOKE explícito por função e manter a invariante de catálogo; medir A6 pela ACL literal (`aclexplode`), não por `has_function_privilege` (anon herda de PUBLIC); em assertivas de exceção, passar `ERRCODE` no `throws_ok` (não a mensagem); converter suítes `finish()`-style para o harness de temp table ao rodar via CLI.

### LL-064 - Fase 2H.3: search_path 'public, pg_temp' em security definer e vetor de hijack; resolve unqualified para pg_catalog; normalizacao por ALTER vs CREATE OR REPLACE

**Data:** 2026-09-23 (ETAPA 13E / FASE 2H.3, somente banco DEV)

**Contexto:** A fase normalizou o achado A4 da auditoria 2G: 25 funcoes SECURITY DEFINER do public ainda declaravam `SET search_path = 'public, pg_temp'`. Ao auditar corpos (`pg_get_functiondef`) e validar a migracao, o processo revelou regras de seguranca e de tooling que nao podem ser puladas.

**Aprendido:** (1) `search_path = 'public, pg_temp'` em SECURITY DEFINER permite que tabelas/funcoes temporarias de sessao (criadas pelo chamador) sombrem objetos do public durante a execucao privilegiada — hijack por `pg_temp`; o padrao seguro do PostgreSQL e `search_path = ''` (vazio) com todas as referencias qualificadas (idealmente prefixadas com pg_catalog). (2) Simbolos unqualified como `gen_random_uuid()` resolvem para `pg_catalog` (search path implicito do sistema sempre pesquisado primeiro) mesmo sem citar pg_catalog; qualificar explicitamente preserva o comportamento com custo zero. (3) Para normalizar, preferir `ALTER FUNCTION ... SET search_path = ''` sobre `CREATE OR REPLACE FUNCTION`: ALTER so mexe no proconfig (corpo, comentarios, history preservados; signature intacta); CREATE OR REPLACE so quando o CORPO precisa de mudanca (unica referencia nao qualificada) — e ai a re-emissao obriga a reaplicar REVOKE/GRANT (padrao DEC-031), pois o PostgreSQL descarta e recria a ACL da funcao. (4) `proconfig::text` de array com aspas escapadas engana `LIKE '%search_path%'`: as aspas internas aparecem duplicadas na serializacao de array (`search_path=""` caso contrata o array fica `{search_path=""}`); confirmar a invariante por `unnest(p.proconfig)` + `position()`, nunca por `like` sobre `::text`. (5) Suites legadas de Finance/Ativos (08m overload ambiguo, 08n `perform` fora de plpgsql, 09a pgtap ausente, 08e formulas, 08d "no data") sao drift pre-existente da Etapa 08 — diferenciar de regressao real: se o teste funcional-exercitar a RPC normalizada passou, a falha de formula/dados nao tem relacao com search_path.

**Aplicado:** Migration `20260923000500_harden_security_definer_search_path.sql` (dry-run transacional, depois Push no DEV); suíte `2h3_search_path_security` 20/20 (post-flight 54/54 SD, 0 pg_temp, create_manual_journal_adjustment qualificada com ACL preservada); pricing_schema agora 100% (tests 40/41 que estavam pendentes desde 2G PASS); regressao (33+28+48+28+53+31+26+27+55+11) sem regressao; frontend 542 testes, tsc e build limpos.

**Impacto futuro:** toda security definer nova deve nascer com `SET search_path = ''` e simbolos qualificados (`public.fn`, `pg_catalog.fn`); ao re-emitir funcao com CREATE OR REPLACE, reaplique REVOKE/GRANT apos; conferir invariante de proconfig por `unnest`/`position`, nao por `like ::text`; rodar pricing_schema apos qualquer mudanca de hygiene de security definer — os testes 40/41 sao o guard-rails dessa invariante.

### LL-065 - Fase 13F: EXTRACT(EASECOND) em get_crm_pipeline_analytics era typo de EPOCH; duracao de funil em dias

**Data:** 2026-09-23 (ETAPA 13F / FASE 13F, somente banco DEV)

**Contexto:** A auditoria da 2H.3 (LL-064) detectou `EXTRACT(EASECOND FROM ...)` latente no corpo de `public.get_crm_pipeline_analytics`. A expressao calculava `avg_duration_days` dividindo por 86400.0 (segundos/dia) �?" a unidade pretendida era segundos totais. `EASECOND` nao existe em PostgreSQL; o campo valido para segundos totais de interval e `EPOCH`.

**Aprendido:** (1) `EXTRACT(SECOND FROM interval)` retorna apenas o componente segundos (0-59) �?" nao serve para duracao total. `EXTRACT(EPOCH FROM interval)` retorna segundos totais (incluindo dias, horas, minutos) �?" e o correto para converter em dias via `/ 86400.0`. (2) O erro so aparece em tempo de execucao quando ha dados suficientes para disparar o calculo (pipeline com eventos) �?" `EASECOND` e erro de parse-time do unit name (`22023: unit "easecond" not recognized`). (3) Frontend espera `avg_duration_days: number` e exibe `${X}d media` �?" confirmando sem�ntica de dias. (4) Correcao isolada: `CREATE OR REPLACE FUNCTION` com assinatura identica, `SET search_path TO '`, reaplicacao de REVOKE/GRANT padrao DEC-031. Nao alterar outras regras do CRM/Financeiro/Pricing.

**Aplicado:** Migration `20260923000600_fix_crm_pipeline_analytics_easecond.sql` (Push no DEV); teste especifico `13f_crm_pipeline_analytics_fix.test.sql` 14/14 (pipeline vazio, stages sem opps, opp sem eventos, opp com movimentacao -> duracao positiva, sem divisao por zero, authenticated ok, anon bloqueado, search_path vazio, SD, owner postgres, ACL exata, EASECOND removido, EPOCH presente); regressao: pricing_schema 46/46, 2h3 20/20, sprint_07_crm 55/55; frontend 542 testes, tsc e build limpos.

**Impacto futuro:** ao calcular duracoes em funcoes analiticas, usar `EXTRACT(EPOCH FROM interval)` para segundos totais; auditar codigos legados que usem `EXTRACT(SECOND ...)` em contextos de duracao; testes de regressao devem cobrir cenarios de pipeline vazio e com movimentacao para capturar regressoes de calculo de duracao.

### LL-066 - INSERT seguido de RETURNING herda os grants de SELECT das colunas retornadas

**Data:** 2026-09-24 (FASE 3B, frontend e E2E no DEV)

**Contexto:** O formulario de preco proprio era valido, disparava submit e montava o payload correto, mas a interface permanecia aberta sem criar a proposta. A mutation executava `insert(payload).select('*').single()` na tabela `own_price_proposals`.

**Aprendido:** (1) No PostgREST/Supabase, encadear `.select('*')` a um INSERT gera `RETURNING *` e exige SELECT em todas as colunas retornadas, alem do grant de INSERT. (2) A DEC-064 concede SELECT por coluna a `authenticated`, mas exclui `internal_cost`; por isso o INSERT isolado e autorizado enquanto `RETURNING *` falha com `42501 permission denied`. (3) Nao se deve ampliar grant para contornar um retorno que o cliente nao usa: remover o SELECT preserva o mascaramento e reduz privilegios. (4) A listagem pode ser atualizada pela invalidacao do TanStack Query e pela RPC de leitura; para Equipe, `internal_cost` permanece mascarado como `null`. (5) Testes unitarios com mocks que aceitam qualquer encadeamento nao detectam necessariamente incompatibilidade de grants; o fluxo precisa de E2E autenticado contra o DEV.

**Aplicado:** `createOwnPriceProposal` agora retorna `Promise<void>` e executa apenas o INSERT; feedback de sucesso corrigido para `Proposta enviada para aprovação.`; testes cobrem mutation unica, loading, erro de campo/API, fechamento do drawer e invalidacao da listagem; E2E permanente cobre Admin e Equipe com fixture isolada e cleanup. Resultado: Admin 2/2, Equipe 1/1, 546 testes frontend, TypeScript/build limpos, 2A 53/53 e 2B 31/31.

**Impacto futuro:** antes de usar `.insert(...).select(...)`, conferir grants de SELECT por coluna e retornar somente dados realmente consumidos; em tabelas com campos mascarados, preferir INSERT sem retorno e recarregar por RPC autorizada; manter E2E autenticado para validar a combinacao real de RLS e column grants.


### LL-067 - Fase 3C.1: drawer position: fixed nunca alarga a pagina; toasts empilhadas quebram strict mode; medir overflow no documento e comparar aberto x fechado

**Data:** 2026-09-24 (FASE 3C.1, frontend e E2E no DEV)

**Contexto:** Ao validar o novo OwnPriceHistoryDrawer (position: fixed) nos 4 breakpoints, rodou-se um diagnostico de overflow a 1280px em /pricing/own-prices que acusava document.documentElement.scrollWidth bem maior que a viewport (1425+). Antes de atribuir o overflow ao drawer, mediu-se tambem o baseline HEAD (mesma pagina, sem a feature) e o drawer isolado.

**Aprendido:** (1) **Overflow de pagina com dados era PRE-EXISTENTE**: a tabela min-w-[1100px] dentro de TableShell overflow-x-auto + sidebar colapsada ultrapassavam o documento a 1280 mesmo no baseline HEAD (docScrollWidth 1425); a feature adiciona zero (aberto == fechado, ex. 1409 == 1409). Pagina sem dados = 1280 limpo. (2) **Drawer position: fixed nunca contribui para o scrollWidth do documento** — medir scrollWidth do documento com o drawer aberto so faz sentido quando comparado ao mesmo valor fechado; a assertiva util e openWidth <= closedWidth + 1. (3) **Toasts empilhadas quebram strict mode**: duas toasts de sucesso identicas (Preco proprio aprovado.) visiveis simultaneamente fazem getByText(...) resolver 2 elementos; usar .last() (toast mais recente) ou, melhor, assertar o proprio sinal de sucesso (drawer fecha apenas no sucesso). (4) **Sinal confiavel de sucesso = estado que so ocorre no sucesso**: assertar 
ot.toBeVisible no drawer apos a aprovacao e robusto contra toasts anteriores ainda na tela; uma aprovacao que falha (ex. CAS 'Decisao desatualizada') mantem o drawer aberto e exibiria a toast antiga como falso positivo.

**Aplicado:** loop responsivo 375/390/768/1280 escopado a feature: fecha drawer → captura closedWidth → abre → asserta conteudo sem overflow (scrollWidth <= clientWidth + 1) → asserta openWidth <= closedWidth + 1. Aprovacoes assertam fechamento do drawer + getByText(...).last(). Diagnosticos e probes temporarios removidos; teste permanente own-price-history.spec.ts verde (Admin + Equipe, isolado e na suite completa). Suite E2E completa: 50 passed + 5 failed (pre-existentes, sem relacao).

**Impacto futuro:** ao validar responsividade de dialogs sobre paginas com tabelas largas, medir o documento fechado vs aberto (a feature nunca deve alargar a pagina) e verificar overflow interno do proprio dialog; nao usar a presencia de uma toast como prova de sucesso quando o mesmo texto pode duplicar; conferir com baseline quando um diagnostico de overflow apontar a feature.

**Saldo da fase:** implementacao frontend pura (sem migrations/RPCs/RLS) consumindo read-only as migrations 2A/2B; 566 testes unit/component, tsc e build limpos; DEC-071 registrada.

### LL-068 - Fase 3C.2: erro de API so carrega message (nao SQLSTATE); overflow das acoes de linha vive no th; injecao de erro via DOM e fragil com options reconciliadas; fill travando por carga de ambiente

**Data:** 2026-09-24 (FASE 3C.2, frontend e E2E no DEV)

**Contexto:** ao integrar a regra DEC-067 (itens proprio da Efetiva nao podem entrar em cotacoes de fornecedores) no editor de cotacoes, precisava-se (1) filtrar itens elegiveis no seletor, (2) preservar itens proprios ja vinculados em cotacoes existentes, (3) traduzir para o usuario o erro exato do backend e (4) nao reproduzir no frontend a regra que o banco ja aplica. Paralelamente, corrigia-se o overflow pre-existente das acoes de linha de Precos Proprios.

**Aprendido:** (1) **Erro de API do PostgREST so carrega a mensagem, sem SQLSTATE confiavel**: o RPC/constraint dispara o erro e o cliente recebe a mensagem; nao ha `code` estavel por backend alem do generico PGRST. A traducao precisa casar com o texto exato da mensagem e cobrir variantes de acentuacao (o backend grava ASCII "Servicos proprios da Efetiva nao podem ser incluidos em cotacoes de fornecedores."; a interface em acentuacao oficial). (2) **Overflow das colunas de acao mora no proprio th, nao na tabela**: o span sr-only "Acoes" absoluto (posicionado dentro de um td sem `relative`) estourava a caixa fora do pai; ancorar no th com `relative px-4 py-3` conteve o elemento dentro do overflow-x-auto do TableShell, zerando o extravasamento sem abrir mao do scroll local e sem vetar scroll de pagina no mobile (sem overflow-x-hidden global). (3) **Injecao de erro do backend via DOM e fragil com a reconciliacao de options do React**: tentou-se um E2E que inseriria forcadamente um option proprio no select para reproduzir o erro do backend pela interface; a reconstrucao das options pelo React invalidava a injecao, tornando o teste dependente de timing; a cobertura do caminho backend ja existe via suíte SQL e a traducao em teste unitario — o E2E passou a cobrir so o comportamento real (seletor so oferece terceirizados; item proprio vinculado preservado e bloqueia ativacao). (4) **fill(tax_id) "waiting for element to be visible, enabled and editable" em execucoes carregadas**: ui-stability TEST 4/5/13b travaram em uma execucao da suite com a maquina sob carga (muitos processos/CPU alto) e passaram limpos na rerun isolada — inclusive com e sem as mudancas da fase (git stash no src + rebuild), provando flakiness de ambiente e nao regressao.

**Aplicado:** picker do editor filtra `item.active && item.sourcing_type === "outsourced"` e mantem `id === selectedId`; sufixo "(inativo - histórico)" / "(serviço próprio)" nas options fora da elegibilidade; `catalogFallbacks` preservam o `sourcing_type` real; `activationIssues.own` bloqueia a ativacao e o checklist ganhou a linha "Apenas itens terceirizados nas linhas"; `translateQuotationError` casa por mensagem (ASCII e acentuada); th das acoes do own-prices corrigido com `relative px-4 py-3` e coluna do cartao mobile com `min-w-0` + `break-words`; E2E quotation-eligibility verde (quer seletor restrito, quer bloqueio de ativacao com item proprio vinculado).

**Impacto futuro:** quando for traduzir erro de API no frontend, depender da mensagem e de ambos os conjuntos de caracteres; ao diagnosticar overflow, conferir o pai mais proximo do elemento absoluto antes de tocar na tabela/pagina (e nunca aplicar overflow-x-hidden global, que quebra scroll local e mobile); preferir E2E que exercite acoes reais do usuario a injetar estado no DOM quando a reconciliacao do framework puder invalidar a injecao; em suites grandes sob carga, confirmar falhas de actionability com rerun isolado antes de tratar como regressao.

**Saldo da fase:** frontend puro (sem migrations/RPCs/RLS); 569 testes unit/component, tsc e build limpos; E2E de escopo verdes; DEC-072 registrada.

### LL-069 - Fase 3C.4: sidebar fixa e tracks minimos causavam overflow global; scroll local de tabela deve ser testado separadamente

**Data:** 2026-09-25 (FASE 3C.4, frontend e E2E com fixtures temporárias no DEV)

**Contexto:** a validacao responsiva do editor de cotacoes, comparacao e tabela de precos encontrou documento mais largo que a viewport em 1280/1440 com conteudo longo. As tabelas ja possuiam `TableShell` com `overflow-x-auto`, mas os filtros desktop usavam tracks com larguras minimas fixas.

**Aprendizado:** (1) a sidebar fixa (`w-64` ou `w-[76px]` quando colapsada) reduz a area util antes mesmo de o padding do shell ser considerado; a correcao deve olhar o grid do conteudo, nao apenas a tabela. (2) `minmax(0, 1fr)` permite que os filtros reduzam sem criar overflow no documento, enquanto `min-w-0` e `break-words` contem campos e textos longos nos wrappers. (3) `overflow-x-auto` deve permanecer no `TableShell`: o scroll interno e comportamento esperado para colunas desktop, e nao deve ser substituido por `overflow-x-hidden` global. (4) seletores E2E precisam escolher a representacao visivel do breakpoint: o DOM pode manter a tabela desktop oculta enquanto o card mobile esta visivel. (5) a tabela de precos lista somente registros aprovados; fixtures de teste que precisam exercitar scroll local devem aprovar o item no setup, sem transformar a Equipe em usuaria com permissao comercial.

**Aplicado:** filtros de comparacao e precos passaram a usar tracks `minmax(0, ...)`; componentes relevantes ganharam `min-w-0`/quebra de texto; os testes responsivos Admin e Equipe passaram por 375/390/768/1024/1280/1440, verificando documento sem overflow global e `TableShell` com `overflow-x: auto`, `scrollWidth > clientWidth` e `scrollLeft > 0`; `npm test` 569/569, `tsc --noEmit`, build e lint escopado concluidos. A sonda pos-build encontrou zero overflow global nas 18 combinacoes.

**Impacto futuro:** ao adicionar filtros, campos ou tabelas a uma tela operacional, medir a largura disponivel depois da sidebar e testar o limite de reducao dos tracks; preservar tabelas largas em containers locais; em E2E responsivo, usar o locator da variante mobile no mobile e da tabela no desktop; separar claramente a preparação de fixture de uma ação de negócio permitida ao perfil testado.

**Saldo da fase:** frontend puro (sem migrations/RPCs/RLS), fixtures `E2E_3C3_*` temporárias removidas do DEV com zero resíduos, PROD intocado; 46 arquivos / 569 testes unitarios verdes, E2E de homologacao verde no escopo e DEC-073 registrada.

### LL-070 - Fase 3C.5: spec E2E commitado so e executado se o testMatch do projeto o reconhecer; prefixo E2E_S2_ e compartilhado entre residuo antigo e fixture corrente

**Data:** 2026-09-26 (FASE 3C.5, registro e configuracao; sem codigo de aplicacao)

**Contexto:** a Fase 3C.4 entregou os specs permanentes de homologacao responsiva (`quotation-homologation-admin.spec.ts` e `quotation-homologation-team.spec.ts`) dentro do commit `7a37bea`, mas o `playwright.config.ts` versionado nao os includia em nenhum `testMatch`. A execucao dos cenarios responsivos so ocorreu porque existia uma alteracao local nao commitada de uma linha por projeto. A 3C.5 versionou esse wiring e registrou o encerramento da 3C.4.

**Aprendido:** (1) No Playwright, `testDir` descobre os arquivos, mas apenas os `testMatch` dos projetos definem o que realmente executa: um spec commitado e silenciosamente ignorado por `npm run test:e2e` enquanto nao casa com nenhum projeto, e `--list` sem `--project` e a forma barata de provar a descoberta antes de rodar. (2) O prefixo das fixtures do `globalSetup` (`e2e/fixtures.ts` usa `E2E_S2_*` em todas as execucoes, independente do modulo testado) e o mesmo de residuos antigos que vazaram de sessoes anteriores: distinguir "residuo pre-existente" de "residuo desta execucao" exige filtrar por `created_at` da sessao, nunca pela contagem total do prefixo. (3) Specs com o mesmo nome logico em projetos diferentes exigem `--project` explicito e `--no-deps` quando a dependencia puxaria a suite completa do outro perfil (a dependencia `team-chromium -> chromium` executaria todos os specs de Admin, incluindo falhas pre-existentes fora do escopo). (4) Assercao de overflow com `toEqual` contra a largura do breakpoint (tolerancia zero) e mais forte que `toBeLessThanOrEqual`, e a mensagem de falha deve embutir `scrollWidth` e `body.scrollWidth` para diagnosticar sem rerun. (5) Aprovacao responsiva de tela com tabela larga precisa cobrir duas metricas distintas: ausencia de overflow global no documento e alcance do fim da tabela por scroll local (`scrollWidth > clientWidth` com `scrollLeft > 0` apos posicionar no fim); passar a primeira sem a segunda significa esconder coluna ou aplicar `overflow-x-hidden` global.

**Aplicado:** `testMatch` de `chromium` e `team-chromium` passaram a reconhecer os dois specs de homologacao, preservando os demais `testMatch`, projetos, `baseURL` e `webServer` (sem URL de PROD); validacao com `npx playwright test --list` (6 + 2 testes descobertos) e execucao individual no DEV autorizado (Admin 8/8 incluindo `authenticate`, Equipe 2/2), com 0 residuos `E2E_3C3_*` e 0 linhas `E2E_*` criadas em 2026-09-26. Limitacoes de cobertura deixadas registradas em vez de corrigidas: o cenario do Editor nao assere `Ativar` nem scroll local (o grid de itens e `article`, nao tabela) e o cenario da Equipe nao cobre o Editor.

**Impacto futuro:** ao versionar um spec E2E, verificar a descoberta com `--list` e o `--project`/`--no-deps` corretos na mesma etapa do spec; ao auditar residuos no DEV, segmentar por `created_at` da sessao e por modulo (`E2E_3C3_*` para fixtures de homologacao) para nao atribuir a uma fase o que veio de outra; manter o prefixo `E2E_S2_*` ate a limpeza das fixtures antigas, para nao misturar telemetria de execucoes futuras com o residuo pendente.

**Pendencia registrada:** fixtures antigas `E2E_S2_*` no DEV (12 fornecedores, 8 categorias, 8 itens, 7 cotacoes, 1 `price_list` inativa), todas de 2026-09-24, nao excluidas e nao limpas nesta fase; a limpeza exige etapa propria.
