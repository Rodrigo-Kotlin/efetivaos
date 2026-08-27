# 04 — Decision Register

Registro oficial das decisões arquiteturais, funcionais e operacionais do Efetiva OS.

## Como registrar

Cada nova decisão deve conter:

- ID;
- data;
- contexto;
- decisão;
- motivo;
- impacto;
- status.

Não registrar tarefas triviais ou detalhes sem impacto futuro.

---

## DEC-001 — Efetiva OS é produto separado do Efetiva Gestão

**Data:** 2026-08-23
**Status:** FECHADA

**Contexto:** Existe outro ERP denominado Efetiva Gestão.

**Decisão:** Efetiva OS será tratado como projeto novo e independente, não como refatoração ou continuação do Efetiva Gestão.

**Motivo:** Evitar herdar arquitetura, dívida técnica e decisões que não pertencem ao novo MVP.

**Impacto:** Repositório, banco, deploy e documentação próprios.

---

## DEC-002 — Stack-base do frontend

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** React + TypeScript + Vite + Tailwind CSS.

**Complementos:** shadcn/ui, TanStack Query, TanStack Table, React Hook Form, Zod e Zustand.

**Motivo:** Base moderna, modular, adequada para PWA administrativo e compatível com a experiência já acumulada nos demais produtos.

**Impacto:** Não substituir bibliotecas sem justificativa técnica registrada.

---

## DEC-003 — Supabase como backend do MVP

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Supabase PostgreSQL + Auth + RLS será o backend do MVP.

**Motivo:** Permitir autenticação, banco relacional, segurança por linha, Storage e integração simples com o frontend.

**Impacto:** Toda tabela sensível deve possuir RLS.

---

## DEC-004 — Multiusuário e perfis desde o início

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** O MVP terá perfis `admin` e `equipe` desde a Sprint 0.

**Motivo:** O sistema manipulará dados administrativos e comerciais reais.

**Impacto:** Permissões devem existir na UI e no banco.

---

## DEC-005 — Sem offline-first no MVP

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** O PWA será instalável, porém dados transacionais não serão tratados como offline-first.

**Motivo:** Uso predominantemente administrativo e necessidade de evitar complexidade e risco de inconsistência.

**Impacto:** Service worker simples; sem cache agressivo de dados financeiros/comerciais.

---

## DEC-006 — Code-splitting por rota desde o início

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Implementar lazy loading/code-splitting por rota desde a fundação.

**Motivo:** Evitar crescimento para bundle monolítico.

**Impacto:** Rotas principais devem ser carregadas de forma modular.

---

## DEC-007 — Catálogo Efetiva como referência canônica

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Itens de fornecedores serão associados ao Catálogo Efetiva e comparados por `catalog_item_id`.

**Motivo:** Evitar fragmentação causada por variações de nomenclatura.

**Impacto:** Item de cotação não mapeado não participa da comparação.

---

## DEC-008 — Cotação como cabeçalho com múltiplos itens

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** `quotations` representa o documento/cabeçalho e `quotation_items` representa suas linhas.

**Motivo:** Reproduzir a estrutura real de uma cotação de fornecedor.

**Impacto:** Relação 1:N entre cotação e itens.

---

## DEC-009 — Terminologia comercial do MVP

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Utilizar o termo **acréscimo sobre custo**, não margem genérica.

**Tipos:** percentual sobre custo ou valor fixo.

**Motivo:** Eliminar ambiguidade entre markup e margem bruta sobre venda.

**Impacto:** UI, documentação e cálculo devem utilizar a mesma terminologia.

---

## DEC-010 — Hierarquia das regras de acréscimo

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Prioridade: item → categoria → global.

**Motivo:** Flexibilidade sem aumentar a complexidade do MVP.

**Impacto:** Resolver uma única regra aplicável em cada cálculo.

---

## DEC-011 — Cotação vencida preservada

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Cotação vencida permanece no histórico, mas não participa da comparação vigente.

**Impacto:** Vencimento é comportamento derivado pela data, não motivo para exclusão física.

---

## DEC-012 — Cotação sem validade

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Cotação sem validade informada pode participar da comparação com alerta permanente.

**Impacto:** UI deve indicar claramente “Validade não informada”.

---

## DEC-013 — Preço aprovado não é atualizado automaticamente

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Nova cotação pode gerar sugestão ou revisão, mas não sobrescreve preço comercial aprovado.

**Motivo:** Manter controle humano e previsibilidade comercial.

**Impacto:** Atualização exige aprovação explícita de Admin.

---

## DEC-014 — Seleção manual de fonte

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Admin pode selecionar outra cotação elegível diferente do menor custo.

**Impacto:** A escolha deve ser identificada e rastreada como manual.

---

## DEC-015 — Valores monetários

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Persistir valores monetários em `numeric/decimal`; não utilizar `float`.

**Impacto:** Preços finais exibidos/persistidos em duas casas; regras podem usar precisão adicional quando necessário.

---

## DEC-016 — CUB/NR-4 fora do Motor v1

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Precificação por CUB e grau de risco NR-4 fica para Fase 2.

**Motivo:** Reduzir escopo e evitar acoplamento prematuro.

---

## DEC-017 — Arquivos de cotação sem OCR no MVP

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** PDF/imagem pode ser anexado como evidência, mas os itens serão registrados manualmente no MVP.

**Impacto:** Storage privado; sem IA/OCR nesta fase.

---

## DEC-018 — GitHub como fonte oficial do projeto

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Código, documentação e migrations deverão permanecer versionados no mesmo repositório.

**Motivo:** Garantir rastreabilidade e permitir que agentes de IA trabalhem com contexto estável.

**Impacto:** Documentação relevante deve ser atualizada no mesmo ciclo das mudanças de código.

---

## DEC-019 — Implementação por gates

**Data:** 2026-08-23  
**Status:** FECHADA

**Decisão:** Cada sprint termina com testes, documentação e relatório antes da liberação da próxima.

**Motivo:** Reduzir retrabalho e evitar expansão automática de escopo por agentes.

**Impacto:** Agentes devem parar ao final da etapa autorizada.

---

## DEC-020 — Role autorizada exclusivamente por profiles

**Data:** 2026-08-23  
**Status:** FECHADA

**Contexto:** Metadados editáveis do Supabase Auth não podem ser usados como fonte confiável de autorização.

**Decisão:** A role efetiva será lida de `public.profiles`. Novos usuários recebem `equipe`; alterações de role ocorrem pela função `set_user_role`, autorizada no banco somente para Admin.

**Motivo:** Impedir elevação de privilégio por metadata controlável pelo usuário e manter a autorização centralizada no PostgreSQL.

**Impacto:** A UI consulta `profiles`; RLS e RPC validam `auth.uid()`; o frontend não escreve diretamente na coluna `role`.

---

## DEC-021 — Cache PWA limitado a recursos estáticos

**Data:** 2026-08-23  
**Status:** FECHADA

**Contexto:** A aplicação deve ser instalável, sem comportamento offline-first para dados transacionais.

**Decisão:** O service worker precacheia somente HTML do shell, JavaScript, CSS, fontes e ícones gerados pelo build. Requisições Supabase não possuem regra de runtime cache.

**Motivo:** Permitir instalação e carregamento do shell sem presumir sincronização de dados comerciais.

**Impacto:** A aplicação exibe aviso persistente offline e operações de dados continuam dependentes de conexão.

---

## DEC-022 — Assets oficiais da identidade Efetiva

**Data:** 2026-08-23
**Status:** FECHADA

**Contexto:** A fundacao visual utilizava marca e icones temporarios gerados durante o bootstrap.

**Decisão:** Usar exclusivamente os PNGs, favicons, app icons, manifest e browserconfig do pacote oficial Efetiva. A cor principal de tema passa a ser `#0B6B3A`; logo completa em login e cabecalho, simbolo em contextos compactos.

**Motivo:** Preservar consistencia de marca entre interface, navegador e instalacao do PWA sem recriar ou distorcer os assets.

**Impacto:** `assets/logo/` e `public/` tornam-se as fontes versionadas da marca; o Vite nao gera um manifesto concorrente.

---

## DEC-023 — Schema do Motor de Preços como migration incremental

**Data:** 2026-08-23
**Status:** FECHADA

**Contexto:** O SQL monolítico do Projeto Técnico v0.3 foi produzido antes da migration de Sprint 0 já aplicada. A execução direta recriaria contratos incompatíveis de `profiles`, reabriria escrita direta em `price_list` e deixaria lacunas de ciclo de vida e auditoria.

**Decisão:** A baseline executável do Motor de Preços será `supabase/migrations/20260823000200_create_pricing_schema.sql`, dependente da migration de profiles existente. Ela preserva `profiles.id`, `set_user_role()` e grants por coluna; adiciona `active` e auditoria de forma incremental; restringe `price_list` às RPCs; mantém cotação ativa de fornecedor inativado elegível conforme DT-08; protege unidade/categoria históricas; serializa decisões concorrentes de preço; e limita substituição de anexo ao caminho da própria cotação enquanto ela estiver em `draft`.

**Motivo:** Manter compatibilidade com o banco aplicado, cumprir DT-06 e DT-08 e impedir escalada de privilégio, reinterpretação de custo histórico ou troca silenciosa da evidência de uma cotação ativa.

**Validação:** Reset completo no Supabase local, 47 testes pgTAP e `supabase db lint --local --schema public --level warning` sem erros.

**Impacto:** O SQL original permanece no pacote histórico. A migration incremental está validada localmente, mas não será aplicada ao projeto remoto durante o Gate 00.1; qualquer aplicação remota exige autorização explícita e plano de rollout.

---

## DEC-024 — Validação Supabase remote-first sem Docker local

**Data:** 2026-08-23
**Status:** FECHADA

**Contexto:** O rollout autorizado da migration do Motor de Preços precisava ser validado no projeto Supabase DEV sem iniciar Docker ou a stack Supabase local. O ambiente remoto não possuía snapshot físico concluído nem PITR utilizável no momento do gate.

**Decisão:** Migrations remotas podem seguir um fluxo remote-first quando o uso de Docker local estiver indisponível ou proibido: auditoria estática independente, confirmação do projeto e do histórico remoto, snapshot lógico dos dados afetáveis fora do Git, `db push --dry-run`, aplicação exclusiva das migrations pendentes, testes SQL transacionais com rollback, pós-flight estrutural e `db lint --linked`. Comandos Supabase CLI que criam login temporário devem ser executados sequencialmente.

**Motivo:** Preservar segurança, rastreabilidade e cobertura de validação sem tornar Docker um requisito operacional do gate nem manter dados de teste no DEV.

**Impacto:** As suítes SQL criam pgTAP dentro da própria transação e revertem a extensão junto com os dados de teste. A ausência de backup físico deve ser registrada como finding, e o rollout só prossegue com ponto de retorno lógico adequado ao escopo afetado.

**Validação:** Migration `20260823000200` aplicada no DEV; 40 testes do Motor de Preços, 8 testes de profiles/roles, pós-flight de RLS/grants/Storage e lint remoto aprovados.

---

## DEC-025 — Status de categoria não altera itens automaticamente

**Data:** 2026-08-23
**Status:** FECHADA

**Contexto:** `catalog_categories` e `catalog_items` possuem status lógico próprio. O contrato da Sprint 1 exige inativar e reativar ambos, mas não define cascata de status entre categoria e itens já cadastrados.

**Decisão:** Inativar uma categoria não inativa nem reativa seus itens automaticamente. Categorias inativas permanecem visíveis em filtros e registros históricos, mas não podem ser selecionadas ao criar um item ou reclassificar um item existente. O status operacional do item continua explícito e independente.

**Motivo:** Evitar alterações silenciosas em vários itens e preservar o histórico, sem inventar uma regra comercial de cascata não prevista no schema ou na especificação.

**Impacto:** A UI filtra categorias ativas nos formulários e identifica categorias históricas inativas. Qualquer futura regra de bloqueio ou cascata exigirá decisão funcional e migration quando aplicável.

---

## DEC-026 — Persistencia atomica do rascunho e recuperacao tecnica de anexo

**Data:** 2026-08-23
**Status:** FECHADA

**Contexto:** A Sprint 2 introduziu edicao concorrente do cabecalho e dos itens de uma cotacao, alem do envio de evidencia para Storage privado. O timestamp de atualizacao isolado nao distingue de forma confiavel todas as revisoes e o Storage nao participa da mesma transacao PostgreSQL.

**Decisão:** O salvamento final do rascunho passa pela RPC atomica `save_quotation_draft`, que exige o timestamp esperado e uma revisao `bigint` autoritativa, aplica CAS ao ciclo de vida e atualiza a revisao do pai quando seus itens mudam. Anexos usam estado pendente protegido por CAS, atualizacao compensatoria e recuperacao explicita por `discard_pending_quotation_attachment` quando a operacao entre Storage e banco nao puder ser concluida.

**Motivo:** Impedir perda silenciosa de atualizacoes concorrentes, evitar persistencia parcial entre cabecalho e itens e tornar falhas de anexo detectaveis e recuperaveis sem fingir atomicidade entre PostgreSQL e Storage.

**Impacto:** Clientes devem reenviar a revisao e o timestamp recebidos do servidor, tratar conflito como recarga obrigatoria e executar a recuperacao explicita de anexo pendente. O arquivo continua sendo apenas evidencia privada, sem OCR/IA, e uma interrupcao durante a recuperacao concorrente ainda pode exigir limpeza operacional de objeto orfao.

**Validação:** Migration `20260823000300_add_save_quotation_draft_rpc.sql` aplicada no Supabase DEV; suites frontend, SQL remota e E2E da Sprint 2 aprovadas.

---

## DEC-027 — Fonte autoritativa da comparação na Etapa 03

**Data:** 2026-08-24
**Status:** FECHADA

**Contexto:** A Etapa 03 introduz a tela de comparação de custos. O schema ja entrega `quotation_item_candidates_v`, `ranked_quotation_items_v` e `best_quote_per_item_v` com toda a regra de elegibilidade e desempate canonica (menor valor unitario, depois maior `valid_until` conhecida, depois `received_at` mais recente), mas nenhuma dessas views lista itens do catalogo sem oferta ativa.

**Decisão:** A tela `/pricing/comparison` consome `public.comparison_current_v`, uma view incremental e dedicada a Etapa 03. Ela lista todos os itens ativos do Catalogo Efetiva, faz `LEFT JOIN` com `best_quote_per_item_v` e expoe apenas colunas necessarias a listagem (codigo, item, unidade, categoria, melhor oferta, fornecedor, validade, contagem de ofertas elegiveis). A view usa `security_invoker = true` e recebeu `GRANT SELECT` somente para `authenticated`; `anon` e `public` foram explicitamente revogados em migration posterior.

**Motivo:** Manter a logica central em SQL, nao duplicar regras no TypeScript, evitar a dependencia prematura de `pricing_comparison_v` (que carrega regras de acrescimo, snapshots e `effective_status` das Etapas 04/05) e prevenir leitura indevida por usuarios nao autenticados atraves de grants em cascata.

**Impacto:** Drawer de ofertas consome `quotation_item_candidates_v` filtrado por `catalog_item_id` para preservar o historico (canceladas, vencidas, rascunhos) com ordenacao consistente. Itens inativos do catalogo sao ocultos por padrao; futuras flags de "inativos" no filtro de Catalogo podem reativa-los sem mudar o schema. A view e referenciada como fonte autoritativa de qualquer melhoria futura na tela ate a entrada da Etapa 04.

**Validação:** Migrations `20260823000400_create_comparison_current_view.sql` e `20260823000410_revoke_anon_from_comparison_view.sql` aplicadas no Supabase DEV. 33 testes pgTAP remotos cobrindo os 10 cenarios da Etapa 03 + RLS Admin/Equipe/anon + grants + estrutura. Pos-flight confirmou zero fixtures e zero extensao pgTAP remanescentes.

---

## DEC-028 — `pricing_comparison_v` reusada como fonte autoritativa da Etapa 04

**Data:** 2026-08-24
**Status:** FECHADA

**Contexto:** A Etapa 04 precisa expor na tela de comparacao o menor custo, a regra de acrescimo aplicada, a origem e o preco sugerido. A view `pricing_comparison_v` (criada na Etapa 02) ja entrega todos esses campos via `best_cost`, `best_supplier_*`, `resolved_margin_rule_id`, `resolved_rule_scope`, `resolved_adjustment_type`, `resolved_adjustment_value` e `suggested_price`. Uma nova view dedicada a Etapa 04 duplicaria o JOIN canonico por `catalog_item_id` e o calculo de arredondamento.

**Decisão:** A Etapa 04 consome `pricing_comparison_v` diretamente, sem criar nova view. A Etapa 03 havia recomendado essa reauditoria antes de qualquer reuso, e a auditoria concluiu: `security_invoker = true` (a view respeita RLS do caller); `resolve_margin_rule` continua `SECURITY DEFINER` com `set search_path = ''`, `is_internal_user()` e `limit 1`; a unica dependencia nova seria o consumidor, e ela apenas le os campos Sprint 3/4 e ignora os campos `price_list`/`approved_*`/`effective_status`/`review_reason` que pertencem a Etapa 05; o calculo `round(..., 2)` e deterministico e ja foi exercitado pela suite da Etapa 02.

**Motivo:** Manter a fonte autoritativa no banco, evitar duplicacao da logica de elegibilidade e desempate ja consolidada, e impedir acoplamento prematuro entre as camadas Sprint 4 e Sprint 5. O time-to-valor de uma view nova era maior do que o risco residual, e a auditoria nao encontrou desvio.

**Impacto:** A UI de comparacao passou a ler `pricing_comparison_v` em vez de `comparison_current_v`; o tipo `ComparisonRow` foi atualizado com os novos campos (`best_cost`, `resolved_*`, `suggested_price`); a suite de testes da Etapa 03 foi preservada apos ajustes de identificadores. Equipe continua visualizando o preco sugerido aplicado, e Admin ganha o caminho `/pricing/rules` para gerenciar as regras. Nenhuma migration nova foi necessaria.

**Validação:** 28 testes pgTAP remotos cobrindo os 16 cenarios da Etapa 04 (resolucao por hierarquia, 0% vs sem regra, R$ 6,70 + 30% = R$ 8,71, recalculo do menor custo, RLS Admin/Equipe/anon, indices parciais de unicidade e grants); 123 testes frontend (eram 102 na Sprint 3); suite E2E completa 7/7, incluindo os fluxos autenticados de Admin e Equipe. Lint remoto do schema sem erros; pos-flight confirmou zero fixtures e zero extensao pgTAP remanescentes.

---

## DEC-029 — Token CAS para decisões comerciais de preço

**Data:** 2026-08-24
**Status:** FECHADA

**Contexto:** O advisory lock global existente serializava alterações de ofertas, regras e aprovações, mas não distinguia a intenção lida por uma tela antiga. Uma aprovação iniciada antes de outra sessão alterar a melhor oferta, a regra ou o preço corrente poderia aguardar o lock e depois aprovar silenciosamente o novo contexto.

**Decisão:** `pricing_comparison_v` passa a expor `decision_token`, calculado por `price_decision_token(catalog_item_id)` sobre o item, a melhor oferta elegível, a regra resolvida e a linha comercial atual. `approve_price(uuid, text, uuid)` e `inactivate_price(uuid, text)` exigem esse token e o revalidam somente depois de adquirir o advisory lock. Token nulo, forjado, reutilizado ou anterior a qualquer mudança relevante gera conflito e recarga obrigatória. O token não é credencial e não transporta custo, regra ou preço; todos os valores continuam selecionados, validados, calculados e gravados pelo banco. A reativação ocorre exclusivamente por nova chamada de aprovação com token fresco, nunca por troca direta de status.

**Motivo:** Serialização impede sobreposição física, mas CAS é necessário para rejeitar intenção obsoleta. Um token composto evita adicionar histórico analítico ou coluna de revisão à tabela comercial corrente e cobre tanto a primeira aprovação quanto atualizações posteriores.

**Impacto:** As assinaturas antigas não consumidas pela aplicação foram removidas. Clientes devem ler e reenviar `decision_token`, tratar conflito como recarga e nunca calcular `final_price` como dado autoritativo. `price_list` continua com uma linha corrente por `catalog_item_id`, preservando snapshots sem criar histórico versionado.

**Validação:** Migrations `20260824000100_add_price_approval_cas.sql` e `20260824000110_harden_price_traceability.sql` aplicadas no Supabase DEV; 48 testes pgTAP da Etapa 05 aprovados; teste com duas conexões remotas confirmou que a sessão A lê o token, a sessão B altera e confirma a regra, e a aprovação antiga da sessão A é rejeitada; lint remoto sem erros; E2E Admin/Equipe aprovado.

---

## DEC-030 — Atualização do PWA exige confirmação explícita

**Data:** 2026-08-24
**Status:** FECHADA

**Contexto:** A ativação automática de uma nova versão do service worker podia recarregar o PWA durante a edição de uma cotação ou outra operação ainda não salva.

**Decisão:** O registro do service worker usa estratégia `prompt`. Quando uma versão fica disponível, a aplicação pergunta se o usuário deseja atualizar e informa que alterações não salvas serão descartadas. A nova versão só é ativada após confirmação.

**Motivo:** Preservar o modelo instalável e o cache estático aprovado sem interromper silenciosamente formulários transacionais.

**Impacto:** Não há fila offline nem cache de dados Supabase. Adiar a atualização mantém a versão corrente até uma nova navegação/reabertura ou futura confirmação.

---

## DEC-031 — Grants explícitos para funções privilegiadas

**Data:** 2026-08-24
**Status:** FECHADA

**Contexto:** O inventário final encontrou grants diretos de `EXECUTE` para `anon` em sete funções `SECURITY DEFINER`, apesar das revogações de `public` presentes nas migrations de origem. Três helpers reservados a triggers também estavam executáveis por `authenticated`.

**Decisão:** A migration `20260824000120_harden_security_definer_grants.sql` revoga explicitamente `public` e `anon` de todas as funções privilegiadas do Motor e remove `authenticated` de `handle_new_user`, `assert_active_quotation_integrity` e `enforce_quotation_integrity_deferred`. Os contratos necessários permanecem executáveis por `authenticated` e continuam autorizando a ação no banco.

**Motivo:** Reduzir superfície privilegiada e impedir chamadas diretas a helpers internos, sem depender de grants padrão ou apenas das validações internas das funções.

**Impacto:** Inventário remoto passa a exigir owner `postgres`, `search_path` vazio, zero função privilegiada executável por `anon` e zero helper de trigger executável por `authenticated`.

**Validação:** Schema 46/46, Sprint 5 48/48, Sprint 4 28/28, profiles 8/8, lint remoto sem erros e pós-flight limpo.

---

## DEC-032 — CRM Light: Unicidade CPF/CNPJ é global

**Data:** 2026-08-25
**Status:** FECHADA

**Contexto:** Definir se a unicidade de CPF/CNPJ deve ser verificada apenas entre clientes ativos ou globalmente.

**Decisão:** Unicidade global via `UNIQUE (tax_id)` na tabela `clients`.

**Motivo:** Simplificar a lógica de negócio, evitar ambiguidade na regra, e preservar integridade dos dados mesmo com inativação/reativação.

**Impacto:** Um CPF/CNPJ inativado não pode ser reutilizado para um novo cadastro. Reativação do registro original é a única forma de restaurar o vínculo.

---

## DEC-033 — CRM Light: Contato principal é no máximo um ativo

**Data:** 2026-08-25
**Status:** FECHADA

**Contexto:** Definir regra de contato principal.

**Decisão:** No máximo um contato principal ativo por cliente. Cliente pode ter zero contatos principais.

**Motivo:** Flexibilidade operacional — nem todo cliente tem contato definido. A restrição de "máximo um" é enforced por partial unique index.

**Impacto:** `uq_client_contacts_active_primary` previne dois contatos principais ativos. Troca é atômica via `save_client_contact()`. Contato inativado automaticamente perde status de principal.

---

## DEC-034 — CRM Light: Equipe possui CRUD idêntico ao Admin

**Data:** 2026-08-25
**Status:** FECHADA

**Contexto:** Definir restrições de Equipe no CRM Light.

**Decisão:** Equipe possui mesmas permissões de CRUD que Admin em `clients`, `client_contacts`, `client_list_v` e `save_client_contact`.

**Motivo:** Na fase de base cadastral, ambos os perfis precisam cadastrar e gerenciar clientes e contatos. Restrições comerciais (aprovação de preço, regras) já são controladas no Motor de Preços.

**Impacto:** Policies atuais não distinguem Admin de Equipe. Qualquer restrição futura deve ser registrada como nova migration e decisão.

---

## DEC-035 — UI Stability: TanStack Table columns must use useMemo

**Data:** 2026-08-25
**Status:** FECHADA

**Contexto:** Pages com TanStack Table apresentavam freezes intermitentes causados por referências instáveis de `columns` e `data`.

**Decisão:** Todos os `useReactTable` devem receber `columns` via `useMemo<ColumnDef<T>[]>(...)` com dependency array correto. Data que pode ser `undefined` deve usar `useMemo` ou constante estável, nunca `?? []` inline.

**Motivo:** TanStack Table detecta mudança de referência em `columns` e `data` e re-renderiza toda a tabela. Quando esses objetos são criados inline no corpo do componente, cada render cria novas referências, causando ciclos de re-renderização infinitos.

**Impacto:** Todos os 7 call sites de `useReactTable` foram auditados. 4 precisaram de correção (suppliers, clients, quotations, catalog). 3 já estavam corretos (rules, comparison, offers-drawer).

---

## DEC-011 — Finance types definidos inline em database.ts

**Data:** 2026-08-26
**Status:** FECHADA

**Contexto:** A migration de financeiro criou 8 tabelas. O Supabase client TypeScript depende da definição do tipo `Database` em `database.ts` para inferir tipos das tabelas.

**Decisão:** Os tipos financeiros (ChartAccount, CostCenter, ServiceLine, FinancialCategory, FinancialAccount, PaymentMethod, FinancialParty, PeriodLock) e seus enums são definidos inline em `database.ts` e re-exportados via `src/features/finance/types/finance-types.ts`.

**Motivo:** Um `import type` de módulo externo (finance-types.ts) posicionado entre definições de tipo e a definição de `Database` quebrava a inferência de tipos do Supabase client, causando `never` em todas as tabelas.

**Impacto:** `database.ts` contém a única fonte de verdade para tipos de tabela. `finance-types.ts` é apenas re-export. Ao adicionar novas tabelas futuras, definir os tipos em `database.ts` primeiro.

---

## DEC-036 — Ledger contábil é append-only (imutável)

**Data:** 2026-08-26
**Status:** FECHADA

**Contexto:** Microgate 08B.1 identificou que settle/cancel usavam DELETE + regenerate, violando imutabilidade do journal.

**Decisão:** Journal entries e journal lines são append-only. Triggers BEFORE UPDATE/DELETE bloqueiam qualquer mutação direta. Settle/cancel criam novas entries (estorno/liquidação) sem remover as originais. Views refletem o estado mais recente.

**Motivo:** Livro-razão append-only é padrão contábil. Permite auditoria completa e rastreabilidade de todas as alterações.

**Impacto:** UI mostra todas as entries de uma transação (original + liquidação + estorno). Views permanecem inalteradas — o frontend já exibe todas as entries.

---

## DEC-037 — RPCs financeiras são Admin-only com guard interno

**Data:** 2026-08-26
**Status:** FECHADA

**Contexto:** RLS sozinha não restringe mutações a Admin. Policies eram `is_internal_user()` para todos os authenticated.

**Decisão:** Todas as 4 RPCs financeiras (create, settle, cancel, update) incluem `is_admin()` guard interno. RLS de INSERT/UPDATE removido das 3 tabelas financeiras — apenas SELECT permitido para authenticated. SECURITY DEFINER RPCs bypassam RLS mas são protegidos pelo guard.

**Motivo:** Defesa em profundidade. Nem interface nem SQL direta podem executar mutações financeiras sem ser Admin.

**Impacto:** Equipe pode visualizar transações/journal mas não criar, liquidar ou cancelar.

---

## DEC-038 — Idempotency key na criação de transações

**Data:** 2026-08-26
**Status:** FECHADA

**Contexto:** Microgate 08B.1 identificou risco de duplicação por duplo clique/submit.

**Decisão:** Coluna `idempotency_key` (text, unique partial) em `financial_transactions`. Frontend gera `crypto.randomUUID()` antes de cada submit. Se key já existe, RPC retorna UUID existente sem criar nova transação.

**Motivo:** Previne transações duplicadas em cenários de rede lenta ou duplo clique.

**Impacto:** Coluna adicional no schema. Frontend passa key a cada chamada. RPC aceita key opcional.

---

## DEC-039 — DRE Gerencial usa LANGUAGE plpgsql STABLE

**Data:** 2026-08-26
**Status:** FECHADA

**Contexto:** A função `get_income_statement` precisa de um guard de admin (RAISE EXCEPTION) que não é suportado em `LANGUAGE sql`.

**Decisão:** Usar `LANGUAGE plpgsql STABLE` para a função DRE, permitindo `BEGIN ... EXCEPTION WHEN` no admin guard.

**Motivo:** `LANGUAGE sql` não suporta `RAISE EXCEPTION`. O guard é necessário como defesa em profundidade além de GRANT/REVOKE.

**Impacto:** Função é compilada como PL/pgSQL. Performance equivalente para consultas simples.

---

## DEC-040 — COALESCE nos totais DRE

**Data:** 2026-08-26
**Status:** FECHADA

**Contexto:** `SUM(...)` retorna NULL quando não há linhas no período, causando todos os valores DRE como NULL.

**Decisão:** Envolcher todos os `SUM(...)` da CTE `totals` com `COALESCE(..., 0)`.

**Motivo:** Garantir que períodos sem dados retornem zeros consistentes em vez de NULL.

**Impacto:** UI mostra R$ 0,00 em vez de campos vazios. Fórmulas funcionam corretamente com zero.

---

## DEC-041 — Apresentação DRE segue referência Financeiro 360

**Data:** 2026-08-26
**Status:** FECHADA

**Contexto:** Terminologia da DRE deve seguir a referência funcional (Financeiro 360 v2.0.0).

**Decisão:** Usar termos idênticos: "Lucro Bruto / Margem de Contribuição", "EBITDA Gerencial", "(-) Deduções da Receita".

**Motivo:** Preservar conformidade com a referência funcional validada.

**Impacto:** Nenhum impacto técnico. Coerência com documentação existente.

---

## DEC-042 — PL/pgSQL output variables vs subquery columns

**Data:** 2026-08-26
**Status:** FECHADA

**Contexto:** Em PL/pgSQL, variáveis de saída da função (`row_code`, `label`, etc.) conflitam com nomes de colunas em subquery interna.

**Decisão:** Qualificar colunas externas com alias da subquery: `dre_rows.row_code`.

**Motivo:** PostgreSQL levanta erro de ambiguidade quando variável de PL/pgSQL e coluna de tabela têm o mesmo nome.

**Impacto:** Qualificação explícita nas colunas da query externa. Sem impacto funcional.

### PEND-001 — Nome definitivo do sistema

**Status:** ABERTA

`Efetiva OS` permanece nome de trabalho.

### PEND-002 — Lançamentos financeiros de contratos recorrentes

**Status:** ABERTA

Definir posteriormente se contratos recorrentes gerarão lançamentos automaticamente ou mediante confirmação manual.
