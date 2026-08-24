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
**Aplicação:** O cenario 12 foi reescrito para criar uma nova cotacao ativa com custo menor (50,00) e validar que o preco sugerido recalcula automaticamente. O cenario 12a foi adicionado para validar que o cancelamento da unica cotacao leva ao estado `no_offer`.
**Impacto futuro:** Suites SQL de comparacao devem sempre criar cotacoes adicionais para alterar o melhor custo, em vez de tentar UPDATE em cotacoes ativas. A mesma logica se aplica a mutacoes reais da aplicacao: para um novo preco, registre uma nova cotacao.

---

## Template para novos registros

```text
## LL-XXX — Título

**Data:** AAAA-MM-DD

**Contexto:**

**Aprendizado:**

**Aplicação:**

**Impacto futuro:**
```
