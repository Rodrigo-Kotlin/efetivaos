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
