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

### DEC-043 — Relatórios financeiros: Equipe ativa tem acesso read-only

**Status:** FECHADA

**Data:** 2026-08-26 (MICROGATE 08E.1)

**Contexto:** `get_income_statement()` foi implementada com `is_admin()`, bloqueando Equipe. A política do módulo financeiro prevê que relatórios de leitura sejam acessíveis por Admin e Equipe ativa, enquanto mutations permanecem Admin-only.

**Decisão:** Usar `is_internal_user()` como guard em relatórios financeiros read-only. Função retorna `true` para `role IN ('admin','equipe') AND active = true`. Mutations financeiras (create, update, settle, cancel) continuam Admin-only via `is_admin()`.

**Motivo:** Separar claramente permissão de relatório (read-only) de permissão de mutação (write). Equipe precisa visualizar DRE, cashflow e demonstrativos para operação.

**Impacto:** `get_income_statement` agora usa `is_internal_user()`. Funções de mutation não são alteradas.

### PEND-002 — Lançamentos financeiros de contratos recorrentes

**Status:** ABERTA

Definir posteriormente se contratos recorrentes gerarão lançamentos automaticamente ou mediante confirmação manual.

### DEC-044 — Ativo/Bem: cadastro patrimonial ≠ ledger

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08F)

**Contexto:** Definir se `financial_assets` alimenta diretamente o BP/DRE ou se permanece como registro operacional.

**Decisão:** `financial_assets` é cadastro operacional. BP e DRE continuam calculados pelo ledger (journal entries). Depreciação gerencial é registrada no cadastro para referência, mas o impacto contábil é feito via posting de journal entry na contabilização.

**Motivo:** Separar cadastro gerencial (vida útil, localização, responsável) da verdade contábil (ledger). Evita divergência entre o que o cadastro calcula e o que o journal entry registra.

**Impacto:** Ledger é fonte única de verdade para BP e DRE. Cadastro de ativos fornece dados operacionais para demonstrações.

### DEC-045 — Depreciação: apenas linha reta no 08F

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08F)

**Contexto:** Definir quais métodos de depreciação suportar no 08F.

**Decisão:** Apenas método de linha reta (STRAIGHT_LINE). Enum `financial_asset_depreciation_method` preparado para extensão futura.

**Motivo:** Simplificar implementação. Método linha reta é o mais comum para bens patrimoniais no contexto PME.

**Impacto:** Cálculo: (valor_aquisição − valor_residual) / vida_util_meses. Extensão para outros métodos pode ser feita sem breaking change.

### DEC-046 — Competência de depreciação normalizada para primeiro dia do mês

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08F.1)

**Contexto:** `post_asset_depreciation` aceitava qualquer `date`, permitindo competência como `2026-06-15`.

**Decisão:** Normalizar `competence_period` para `date_trunc('month', input)::date` (primeiro dia do mês).

**Motivo:** Depreciação é operação mensal. Competência por dia gera ambiguidade e complica idempotência.

**Impacto:** Unique constraint opera sobre `(asset_id, primeiro_dia_do_mes)`. Input `2026-06-15` vira `2026-06-01`.

### DEC-047 — Validação contábil das contas vinculadas ao ativo

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08F.1)

**Contexto:** Um ativo podia receber conta de PASSIVO em `asset_chart_account_id` sem erro.

**Decisão:** Função `validate_asset_accounts()` verifica: asset account = ATIVO, accumulated = ATIVO, expense = DESPESA com `dre_class = 'DEPRECIACAO_AMORTIZACAO'`. Chamada em `create_asset` e `update_asset`.

**Motivo:** Defesa em profundidade. UI filtra contas corretas, mas o banco deve rejeitar invariantes.

**Impacto:** RPCs rejeitam contas inválidas com mensagem descritiva. Trigger não é necessário — validation é na camada de aplicação (RPC SECURITY DEFINER).

### DEC-048 — Resultado do Exercício no BP: Modelo B (dinâmico)

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08F.1)

**Contexto:** Definir como `get_balance_sheet` trata resultado corrente no PL.

**Decisão:** Modelo B — resultado é calculado dinamicamente a partir das contas de resultado (`class IN ('RECEITA','CUSTO','DESPESA')`) e inserido como row adicional no PL. Enquanto não houver rotina de encerramento contábil, não há risco de dupla contagem.

**Motivo:** Simplicidade. Journal de encerramento não existe na fase atual. Se for implementado futuro, `get_balance_sheet` deve excluir contas de encerramento do cálculo dinâmico.

**Impacto:** `dre_result` CTE calcula resultado e o inclui como `row_code = 'RE'` no PL. Proteção contra dupla contagem futura: documentada como deferred.

### DEC-049 — RLS de ativos usa is_internal_user() em vez de authenticated

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08F.1)

**Contexto:** Policy `assets_select_authenticated` permitia que usuário inativo lesse dados.

**Decisão:** Substituir por `is_internal_user()` que verifica `role IN ('admin','equipe') AND active = true`.

**Motivo:** Inativos não devem acessar dados financeiros. Política anterior era overly permissive.

**Impacto:** Usuário inativo recebe SELECT negado em ativos e depreciation postings.

---

### DEC-050 — Conciliação Caixa BP × Cashflow Closing via fixture controlado

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08F.2)

**Contexto:** MICROGATE 08F.2 exige comprovação de que Caixa do BP concilia com Closing Balance do Fluxo de Caixa.

**Decisão:** Criar fixture controlado dentro de transação com rollback para testar conciliação.

**Motivo:** Ambiente remoto sem dados reais. Fixture controlado permite teste reproduzível.

**Impacto:** Teste SQL T01 e T16 verificam conciliação com tolerância < R$ 0,01.

---

### DEC-051 — Equação patrimonial verificada por SQL fixture

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08F.2)

**Contexto:** MICROGATE 08F.2 exige prova de que Ativo = Passivo + Patrimônio Líquido.

**Decisão:** Criar checks SQL que calculam totais diretamente do ledger e verificam equação.

**Motivo:** Validação apenas no frontend não é suficiente para gate contábil.

**Impacto:** Testes T03 e T15 verificam equação patrimonial.

---

### DEC-052 — Resultado DRE = Resultado do Exercício no PL (sem dupla contagem)

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08F.2)

**Contexto:** MICROGATE 08F.2 exige comprovação de que resultado não é contado duas vezes no PL.

**Decisão:** Verificar que resultado líquido da DRE entra no PL exatamente uma vez (Modelo B).

**Motivo:** Modelo B calcula resultado dinamicamente, sem lançamento de encerramento.

**Impacto:** Testes T04 e T17 verificam ausência de dupla contagem.

---

### DEC-053 — Depreciação idempotente confirmada

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08F.2)

**Contexto:** MICROGATE 08F.2 exige confirmação de que duplicate depreciation posting é rejeitado.

**Decisão:** Testar tentativa de posting duplicado e verificar rejeição.

**Motivo:** Idempotência é requisito de segurança contábil.

**Impacto:** Teste T05 confirma rejeição de posting duplicado.

---

### DEC-054 — Integrity run com 8 checks de integridade

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08F.2)

**Contexto:** MICROGATE 08F.2 exige integrity run final.

**Decisão:** Implementar 8 checks: unbalanced journals, orphan lines, duplicate depreciation, invalid accounts, BP mismatch, cash mismatch, duplicate result, invalid classification.

**Motivo:** Verificar integridade referencial e contábil do sistema.

**Impacto:** Testes T11-T18 verificam integridade.

---

### DEC-055 — DMPL deriva do ledger (não de tabela separada)

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08G)

**Contexto:** ETAPA 08G requer DMPL que demonstre mutações do PL.

**Decisão:** DMPL deriva exclusivamente do ledger via `get_statement_of_changes_in_equity()`. Não criar segundo livro contábil.

**Motivo:** Consistência com princípio central: ledger é fonte autoritativa.

**Impacto:** DMPL, DLPA e DVA derivam de journal entries/lines.

---

### DEC-056 — Modelo B para resultado na DMPL/DLPA

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08G)

**Contexto:** DMPL e DLPA precisam demonstrar resultado do exercício.

**Decisão:** Manter Modelo B (resultado calculado dinamicamente) para DMPL e DLPA, sem lançamento de encerramento.

**Motivo:** Consistência com BP (08F) e simplicidade.

**Impacto:** Resultado na DMPL/DLPA reconcilia com DRE via cálculo dinâmico.

---

### DEC-057 — Ajustes manuais são append-only

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08G)

**Contexto:** ETAPA 08G requer lançamentos manuais de ajuste.

**Decisão:** Ajustes criam novos journal entries (append-only). Journal entries existentes não podem ser editadas.

**Motivo:** Integridade do ledger e rastreabilidade.

**Impacto:** Trigger impede UPDATE em journal entries. Correções são feitas via reversal + novo lançamento.

---

### DEC-058 — Notas gerenciais são camada explicativa

**Status:** FECHADA

**Data:** 2026-08-27 (ETAPA 08G)

**Contexto:** ETAPA 08G requer notas vinculadas a demonstrações.

**Decisão:** `financial_notes` é tabela separada que não afeta ledger. Notas são camada explicativa.

**Motivo:** Separação entre dados contábeis e anotações gerenciais.

**Impacto:** Notas podem ser criadas/editadas sem impacto em demonstrações.

---

### DEC-059 — Mock CRM Comercial é referência visual, implementação CRM é autoritativa

**Status:** FECHADA

**Data:** 2026-08-28 (ETAPA CRM 09A)

**Contexto:** Aprovou-se um mock navegável do CRM Comercial como referência de apresentação.

**Decisão:** O mock (`docs/wireframes/crm-comercial-mock.html`) define apresentação; as regras funcionais permanecem definidas pela implementação CRM 08A–08D. Registro formal: `docs/30-crm-09a-design-baseline.md` (CRM DESIGN BASELINE v1).

**Motivo:** Alinhar a interface de produção ao design aprovado sem reconstruir o CRM nem substituir regras funcionais por lógica fictícia.

**Impacto:** Em conflito mock vs regra funcional, a regra funcional vence. Mudanças visuais não alteram arquitetura funcional (Pipeline, Activities First, Lista, Intelligence, segurança, histórico, mobile). Dados fictícios do mock não entram em produção.

---

### DEC-060 — Modelo canônico de posting à vista e por competência

**Status:** FECHADA

**Data:** 2026-08-31 (FINANCE MICROGATE 02)

**Contexto:** O engine tratava `payment_date` como simples atalho para
`status='settled'`. Para Receita, Despesa e Imobilizado, isso executava somente
a perna de liquidação contra AR/AP e omitia o reconhecimento econômico. Ao mesmo
tempo, a DRE filtrava `journal_entry.status='settled'`, embora o reconhecimento
por competência de operações a prazo permaneça na entry `pending`.

**Decisão:** `payment_date` preenchido na criação representa uma operação já
realizada à vista. Receita à vista posta D Caixa/Banco / C Receita; Despesa à
vista posta D Custo/Despesa / C Caixa/Banco; Imobilizado à vista posta D Ativo /
C Caixa/Banco. Essas operações não usam AR/AP transitório. Sem `payment_date`,
Receita, Despesa e Imobilizado são reconhecidos por competência contra AR/AP; a
liquidação posterior movimenta somente Caixa/Banco e o título e usa
`payment_date` como data da entry financeira. A DRE seleciona linhas de contas
de resultado por `competence_date`, independentemente de status, tipo de entry
ou realização financeira. O Fluxo de Caixa continua derivado exclusivamente das
linhas em contas `is_cash=true`. O ledger permanece append-only e idempotente.

**Motivo:** Separar reconhecimento econômico de realização financeira, impedir
AR/AP artificiais em operações à vista e manter Receita/Despesa reconhecidas uma
única vez no período correto.

**Impacto:** A criação canônica usa somente o overload com idempotency key.
Operações à vista não aparecem nas views AR/AP; títulos a prazo permanecem nas
views após liquidação com saldo aberto zero. Cancelamento de transação `settled`
fica explicitamente bloqueado até a correção integral F-07, evitando que o novo
posting direto seja revertido pelo mecanismo incompleto anterior. Cancelamento
de `pending` continua append-only.

**Validação:** 66/66 checks da suíte 08M, 28/28 checks de regressão F-01/F-06 e
15/15 checks de estrutura/segurança da DRE aprovados no Supabase DEV.

---

### DEC-061 — Engine de reversão copy-based com tracking explícito

**Status:** FECHADA

**Data:** 2026-08-31 (FINANCE MICROGATE 03)

**Contexto:** Microgate 02 bloqueou cancelamento de settled para evitar corrupção.
Microgate 03 precisa entregar reversão segura para F-07 (cancelamento de settled
estorna todas as legs), F-05 (update append-only) e F-01 (dedup reversal). A abordagem
original "rebuild one leg by movement type" era insuficiente para settled (leg de
caixa ficava residual). Update_existente adicionava entries sem estornar, gerando
saldos incorretos (100→120 = 220 em vez de 120).

**Decisão:** Reversão é copy-based: select todas as linhas da entry original,
inverter debit↔credit (line por line), copiar todos os metadados (period, category,
competence, asset_id, depreciation_run_id, origin/destination), adicionar
`reversal_of_entry_id` (FK parcial UNIQUE) e `reversal_reason`. Constraint parcial
garante no máximo 1 reversal por original. Trigger valida que reversal_of_entry_id
só pode ser preenchido quando a entry é o reversal (não a original). Fluxos:

- **Cancel pending:** `cancel_financial_transaction` cria reversal da competência
  única → status=cancelled.
- **Reverse settled:** `cancel_financial_transaction` detecta 2+ entries, cria
  reversal de cada uma (competência + caixa, ou competência + AR/AP) →
  status=cancelled.
- **Update append-only:** `update_financial_transaction` (CAS obrigatório) estorna
  todas as entries vigentes via copy-based, depois gera novas entries com os dados
  atualizados. 100→120→150 = 150, nunca 220. Reusa `cancel_financial_transaction`
  para o passo de estorno (evita duplicar lógica).

**Motivo:** Copy-based preserva todos os dimensões (category, competence,
asset_id, depreciation_run_id) sem inferir tipo de movimento. Tracking explícito
(`/reversal_of_entry_id`) permite dedup e auditoria. Reutilizar cancel para
estorno unifica a lógica e reduz superfície de bugs.

**Impacto:** `financial_journal_entries` ganha 2 colunas + 1 FK parcial + 1
trigger. `cancel_financial_transaction` e `update_financial_transaction` são
reescritas. AR/AP views e forecast view são atualizados. 3 RPCs mantêm
SECURITY DEFINER (Admin-only). Nenhuma alteração no modelo de authorization
(COR-14 preservado).

**Validação:** 08N ≥60 checks, 08M 66/66, 08L 28/28, 08E.1 15/15, frontend
455/455, TS=0, build PASS.

---

### DEC-062 — Código canônico de item e presets de categoria

**Status:** FECHADA

**Data:** 2026-09-01

**Contexto:** O catálogo exigia digitação manual de códigos semânticos e nomes livres de categoria, o que aumentava risco de colisão e variações cadastrais.

**Decisão:** Novos itens recebem `code` no PostgreSQL pelo default `generate_catalog_item_code()` e pela sequence `catalog_item_code_seq`, no formato `ITEM-000001`. O código é único, obrigatório, imutável e não pode ser informado por clientes autenticados. Códigos legados são preservados. Categorias canônicas são sugestões centralizadas na UI e só são persistidas quando escolhidas; nomes customizados continuam permitidos por “Adicionar nova categoria”. A unicidade de categoria compara `lower(btrim(name))`.

**Motivo:** Sequências resolvem concorrência sem `COUNT`/`MAX`, códigos neutros não acoplam identidade a nome ou categoria e presets reduzem variações sem povoar o banco com registros não utilizados.

**Impacto:** O frontend não gera nem envia código, mostra o valor como automático/read-only e pesquisa pelo código retornado. A sincronização final da sequence ocorre sob lock e o gerador rejeita perfis inativos. Criação concorrente de categorias iguais resulta em uma única linha pela proteção do banco, com mensagem de negócio para a tentativa duplicada.

---

### DEC-063 — Propostas de preço próprio: RLS exige policy de SELECT e colunas de decisão no grant

**Status:** FECHADA

**Data:** 2026-09-22 (FASE 2A)

**Contexto:** A Fase 2A entrega a estrutura de preços próprios somente no banco. O desenho inicial bloqueava leitura direta (sem policy de SELECT, custo interno mascarado por função `SECURITY DEFINER`) e concedia apenas `sale_price`, `internal_cost` e `decision_notes` ao UPDATE de `authenticated`. Durante a validação, o UPDATE direto de `authenticated` em `own_price_proposals` (e em qualquer tabela com RLS) matchea **0 linhas silenciosamente** — mesmo com policy `using (true) with check (true)`, owner `postgres` e FORCE desligado. Testes de isolamento (tabela mínima, clone com `LIKE INCLUDING ALL`) reproduziram o fenômeno; a adição de uma policy de SELECT restaurou o UPDATE. Conclusão empírica do ambiente: **sob RLS, um papel `authenticated` só consegue atualizar linhas visíveis por uma policy de SELECT do mesmo escopo.**

**Decisão:** `own_price_proposals` passa a ter policy `own_price_proposals_select_internal` para `authenticated` com `using (is_internal_user() and (is_admin() or submitted_by = (select auth.uid())))`, espelhando o escopo da policy de UPDATE. O custo interno permanece oculto pelo grant de coluna (a lista de SELECT não inclui `internal_cost`). O grant de UPDATE é ampliado para `(sale_price, internal_cost, decision_notes, status, approved_by, approved_at)`, de modo que toda transição de estado passe pelo gatilho de guarda (que exige `is_admin()` + GUC `efetiva_os.own_price_approval='on'`), em vez de ser silenciosamente podada pela ausência de privilégio de coluna.

**Motivo:** Sem a policy de SELECT, o próprio fluxo autorizado de reajuste pendente pelo dono da proposta não funciona; sem as colunas de decisão no grant, tentativas de transição de estado viram `permission denied` genérico ou no-op silencioso em vez do erro de negócio rastreável do trigger.

**Impacto:** Leitura direta via RLS fica restrita a owner/admin com escopo idêntico ao UPDATE; `internal_cost` segue somente pelo reader `get_own_price_proposals` (Admin). As asserções de imutabilidade/transição passam a se basear nos erros do trigger (`P0001`/`42501` com mensagem canônica) e a exclusão direta segue bloqueada (sem policy nem grant de DELETE). Os testes da 2A (53/53) validam o comportamento na migration `20260922000100_create_own_pricing_structure.sql`, aplicada no Supabase DEV.

---

### DEC-064 — Fase 2B: RPCs de decisão são o único canal de transição de estado de preço próprio

**Status:** FECHADA

**Data:** 2026-09-22 (FASE 2B, somente banco)

**Contexto:** O gatilho de guarda da 2A exige Admin + GUC `efetiva_os.own_price_approval='on'` para mudar o estado de decisão de uma proposta, mas nenhuma RPC existia — nada podia aprovar/inativar de forma autorizada. Faltava definir o canal seguro e o impacto na tabela comercial e na comparação.

**Decisão:** As RPCs `approve_own_price_proposal(uuid, text)` e `inactivate_own_price_proposal(uuid, text, text default null)` são `SECURITY DEFINER`, exclusivas de Admin, serializadas por `pg_advisory_xact_lock` e validam tela obsoleta por token de snapshot (`own_price_decision_token`, md5 da proposta) + UPDATE com CAS (WHERE nos valores lidos). Sob `set_config('efetiva_os.own_price_approval','on',true)`, a aprovação faz pending→approved e cria/atualiza o preço vigente em `price_list` com `price_origin='own'` e referência à proposta (upsert por `catalog_item_id`, substituindo preço de cotação quando houver — uma linha por item). A inativação faz pending→inactive (rejeição, com observação opcional) e approved→inactive (aposentadoria do preço vigente que referencia aquela proposta). A GUC é restaurada ao valor anterior ao final. `pricing_comparison_v` passa a apresentar preço próprio aprovado como `approved` (sem os todos de revisão de cotação) e expõe `price_origin` e `own_price_proposal_id`.

**Motivo:** Aprovação inativa ou rejeitada precisa ser rastreável (aprovador/data/observação) e jamais silenciosa; o token + CAS evita aprovar um valor reajustado depois que o Admin carregou a tela; o upsert em `price_list` mantém um único preço vigente por item, preservando o modelo de `approve_price()`/`inactivate_price()`; sem a adaptação da view, um preço próprio aprovado apareceria perpetuamente como `review_required` (todos de cotação não se aplicam a serviços próprios).

**Impacto:** A transição de estado passou a existir de forma autorizada e testável (31/31 na suite `2b_own_price_approval.test.sql`). Propostas inativas liberam nova proposta pendente para reajuste (a antiga permanece como histórico). A RPC de inativação não toca o preço vigente de outra proposta quando o item já foi reajustado. A interface (Fase 2B - UI) consumirá `get_own_price_proposals`, `own_price_decision_token` e as duas RPCs, sem UPDATE direto de estado.

---

### DEC-065 — Fase 2C: interface de preço próprio usa insert autorizado + RPCs; recusa = inativação com observação; token de decisão é o GC da tela obsoleta

**Status:** FECHADA

**Data:** 2026-09-22 (FASE 2C, somente interface)

**Contexto:** Com o banco da 2A e as RPCs da 2B prontos, faltava a interface. O Doc 01 (§8) deixa uma ambiguidade: a recusa de uma proposta pendente não define estado próprio de rejeição — o enum `own_price_status` só tem 'pending'/'approved'/'inactive' — então a recusa precisa neutralizar a proposta pendente dentro do vocabulário existente. Também não estava definido como a Equipe leria o custo interno (visível apenas a Admin pelo grant) nem como a tela detectaria que o Admin está decidindo sobre um valor já alterado.

**Decisão:** (1) A interface nunca escreve em `price_list` nem faz UPDATE direto de estado: a criação usa INSERT em `own_price_proposals` (RLS autoriza Equipe) e toda transição usa somente as RPCs `approve_own_price_proposal`/`inactivate_own_price_proposal`. (2) **Recusa de pendente = `inactivate_own_price_proposal` com observação opcional** (`pending→inactive`), sem estado próprio; a rastreabilidade vem de `approved_by`/`approved_at`/`decision_notes`. A aposentadoria de preço aprovado usa a mesma RPC (`approved→inactive`), diferenciada na UI. (3) O token de decisão (`own_price_decision_token`) é buscado com `staleTime: Infinity`; quando indisponível, a tela exibe a mensagem canônica ("A proposta foi alterada desde que você abriu esta tela. Atualize os dados antes de continuar.") e recarrega antes de decidir; falha de mutação invalida o cache de propostas + tabela comercial + comparação/dashboard (sucesso e erro). (4) `internal_cost` não é solicitado à API para não-Admin (a UI apenas oculta; o grant do banco permanece soberano). (5) O catálogo próprio é lido por consulta dedicada (`catalog_items` com `sourcing_type='own'`), sem tocar `catalog.service`.

**Motivo:** Preservar as regras 11/12/14 do Motor (nunca alterar silenciosamente preço aprovado; aprovação exclusiva de Admin; origem rastreável) sem duplicar lógica de transição no cliente; o token impede decidir um valor reajustado; o custo interno continua restrito pelo grant de leitura.

**Impacto:** UI da ETAPA 11 (2C) entregue com 45 suítes/534 testes verdes, incluindo 4 suítes da feature (`own-prices-api`, `own-prices.schemas`, `own-prices-queries`, `own-prices-page`); `npm run build` e ESLint sem erros. `src/types/database.ts` ganhou os tipos da 2A/2B, o mapeamento `Functions` das RPCs novas e as colunas opcionais `price_origin`/`own_price_proposal_id` em `PricingComparisonRow`/`PriceList` (opcionais para não quebrar fixtures de testes existentes). E2E completo não executado nesta sessão por ausência das credenciais `SPRINT0_*`/`E2E_*` no ambiente.

---

### DEC-066 — Fase 2D: integração de preço próprio no Catálogo e na Tabela de Preços

**Status:** FECHADA

**Data:** 2026-09-23 (FASE 2D, somente interface)

**Contexto:** A 2C entregou a UI de propostas próprias isolada, sem integração visual com o resto do Motor. Restavam: origem visível no Catálogo (form, badge, filtro, ação de navegação), linhas `own` corretas na Tabela (fonte, custo interno restrito, validade ausente, sem fornecedor fictício) e rastreabilidade própria no drawer que hoje exibia "Cotação sem referência" para preços próprios. Um bug pré-existente invertia o filtro de origem do Catálogo (option `own` não casava com o tipo `sourcing_own`).

**Decisão:** (1) O filtro de origem do Catálogo é normalizado para o vocabulário do banco (`all`/`own`/`outsourced`), corrigindo a inversão. (2) Itens `own` ganham ação no Catálogo que navega para `/pricing/own-prices` ("Definir preço próprio" quando não há proposta aprovada; "Consultar preço / propor reajuste" quando há — derivado de `useOwnPriceProposals`). (3) A mudança de origem fica disponível na edição do item (form sem `disabled`); o bloqueio de mudança incompatível continua soberano no banco (trigger 2A) e é traduzido por `translateCatalogError` com mensagem clara (spec §3/§9). (4) Na Tabela de Preços, linhas com `price_origin='own'` apresentam Fonte "Próprio — Efetiva", Custo interno somente p/ Admin (lido da RPC `get_own_price_proposals`, já mascarada para não-Admin), Validade "—" e nenhum fornecedor/manual/automática fictício; novo filtro comercial "Origens" (`all`/`own`/`quotation`) convive com o filtro de Fonte manual/automática sem confundi-los. (5) O `ReviewDrawer` recebe `ownProposal` opcional (pai — Tabela — resolve pelo `own_price_proposal_id`) e, para linhas `own`, renderiza apenas rastreabilidade própria (proposta, preço aprovado, custo restrito, aprovador, data, revisão, justificativa, histórico acessível) e esconde ofertas de cotação/previsão/aprovação de cotação; a comparariedade `comparison-page` passa `ownProposal` ausente, caindo no fallback da própria linha mais link para Preços Próprios (histórico completo fica lá).

**Motivo:** Integrity de interface com a 2A/2B sem nova migration nem alteração de RPC: a view já expõe `price_origin`/`own_price_proposal_id`, e o custo interno já é mascarado pela RPC da 2B. A ação de navegação dá à Equipe um caminho claro do Catálogo ao fluxo próprio; a Tabela não expõe custo para não-Admin e não fabrica fornecedor/validade para preço próprio.

**Impacto:** 45 suítes / 542 testes verdes (fix do `catalog.service.test` + novos testes de filtro/ação/forma, Tabela own e drawer próprio); `npm run build` e `tsc --noEmit` limpos; ESLint sem erros nos arquivos da etapa (96 erros pré-existentes fora da etapa permanecem — finance/crm/pdf-utils). E2E completo não executado: credenciais `SPRINT0_*`/`E2E_*` ausentes no ambiente (mesma limitação das ETAPAS 11/2C).

### DEC-067 — Fase 2E: itens próprios bloqueados do fluxo de cotações (guarda no banco, sem interface)

**Status:** FECHADA

**Data:** 2026-09-23 (FASE 2E, somente banco; frontend e Financeiro intocados)

**Contexto:** As fases 2A/2B criaram o fluxo de serviços próprios (enum `pricing_sourcing_type`, propostas, aprovação e reajuste) e a 2C/2D a interface. A auditoria da Fase 2E constatou uma lacuna de integridade: `public.enforce_quotation_item_draft_only()` (trigger `trg_quotation_items_draft_only`) validava que a cotação está em `draft` e que o item do Catálogo está `active`, mas NÃO verificava `sourcing_type` — portanto um item catalogado como serviço próprio (`own`) podia receber cotação de fornecedor pelo fluxo terceirizado, misturando origens em `quotation_items`. Não havia nenhum item nessa condição nos dados do DEV (0 inconsistências).

**Decisão:** (1) Ampliar a função existente `enforce_quotation_item_draft_only()` para, além das validações atuais, exigir `sourcing_type = 'outsourced'` para qualquer inclusão/edição de `quotation_items` — qualquer outro valor (sobretudo `own`, incluindo NULL) é rejeitado; (2) manter o mesmo trigger `trg_quotation_items_draft_only` (BEFORE INSERT OR UPDATE OR DELETE), sem criar trigger novo e sem alterar assinaturas de RPC (`approve_price`/`inactivate_price`); (3) selagem com `revoke all on function ... from public, anon, authenticated` (mesmo padrão da 2A), garantindo que a validação só é exercitada pelo trigger; (4) mensagem de erro em ASCII no banco (`Servicos proprios da Efetiva nao podem ser incluidos em cotacoes de fornecedores.`), por convenção do repositório — o texto oficial com acentuação para UI é: "Serviços próprios da Efetiva não podem ser incluídos em cotações de fornecedores."; (5) NÃO duplicar a guarda de origem do próprio Catálogo: `enforce_catalog_item_sourcing_history()` (2A) continua soberana para mudanças de `sourcing_type` nos dois sentidos quando há histórico.

**Motivo:** A regra de precedência pede ampliar a proteção existente em vez de criar camada paralela. No esquema atual, `quotation_items` responde a RLS com FORCE + policies de `draft`, que bloqueiam silenciosamente UPDATE/DELETE de itens fora de `draft` (0 linhas afetadas, sem erro); o ponto de entrada que precisa de guarda de banco é o INSERT (a policy de INSERT só valida a cotação em draft). Colocar a checagem de origem na mesma função mantém cobertas as três operações e faz o erro valer para qualquer cliente/interface.

**Impacto:** Migration `20260923000100` aplicada apenas no DEV (Push), sem reset operacional e sem tocar PROD. Auditoria: 0 inconsistências operacionais (nenhum `quotation_items` com item próprio; cotações de fornecedor intactas; volume baixo: 12 itens terceirizados, 4 quotation_items, price_list vazia). Suítes SQL: 2E `2e_quotation_own_guard` 21/21, regressão do fluxo tradicional `2e_outsourced_flow_regression` 14/14, 2A `2a_own_price_structure` 53/53, 2B `2b_own_price_approval` 31/31 — todas com ROLLBACK e fixtures isoladas (nenhum dado real alterado). Frontend intocado: `npm test` 45 arquivos / 542 testes verdes; `npx tsc --noEmit` limpo; `npm run build` ok. As suítes históricas `sprint_02`/`sprint_05` não rodam desde a 2A (grants de INSERT por coluna, sem `code`) — drift pré-existente, documentado no LL-060 e coberto pela suíte de regressão do fluxo tradicional.

### DEC-068 — Fase 2H.1: mutações de ativos restritas a Admin e Balanço Patrimonial restrito a usuários internos (correção das vulnerabilidades A1 e A2 da auditoria 2G)

**Status:** FECHADA

**Data:** 2026-09-23 (FASE 2H.1, somente banco DEV; frontend, CRM, regras do Motor de Preços e PROD intocados)

**Contexto:** A auditoria da Fase 2G (COMPLETED_WITH_FINDINGS) identificou duas vulnerabilidades em `financial_assets`/RPCs de ativos e no Balanço Patrimonial: **A1** — as funções `create_asset`, `update_asset`, `dispose_asset` e `post_asset_depreciation` só checavam `auth.uid() IS NOT NULL AND NOT is_admin()`, ou seja, um cliente sem sessão (`auth.uid()` NULL) conseguia executá-las (criar/alterar/dar baixa/contabilizar ativos) — default aberto para NULL; **A2** — `get_balance_sheet` podia ser lida sem autorização (leitura não autorizada do balanço patrimonial).

**Decisão:** (1) Nas 4 RPCs de ativos, o guard passa a ser mandatório e fechado para NULL: `IF public.is_admin() IS NOT TRUE THEN RAISE EXCEPTION ...; END IF;`, com mensagens em ASCII (`Apenas administradores podem cadastrar ativos` / `...alterar ativos` / `...dar baixa em ativos` / `...contabilizar depreciacao`). (2) `get_balance_sheet` converte de SQL para plpgsql (STABLE, SECURITY DEFINER, `search_path=public, pg_temp`) com `RETURN QUERY` e guard `IF public.is_internal_user() IS NOT TRUE THEN RAISE EXCEPTION 'Apenas usuarios internos podem consultar o balanco patrimonial';`. (3) REVOKE EXECUTE explícito das 5 funções de `public` e `anon` ao final da migration, preservando `authenticated` (grant herdado dos parâmetros). (4) Migration corretiva em seguida: no plpgsql de `get_balance_sheet`, diretiva `#variable_conflict use_column` resolve a ambiguidade entre OUT params (`presentation_sign`, `class` etc.) e colunas das CTEs (42702); em `post_asset_depreciation`, as duas linhas do lançamento passam a entrar em um único INSERT multi-row, pois a trigger `validate_journal_entry_balance()` (AFTER FOR EACH ROW) rejeita INSERTs separados de débito e crédito.

**Motivo:** O padrão do Motor de Preços (2A/2E) é "guard mandatório fechado para NULL/falso" (negate FALSE and NULL). Assinaturas do frontend preservadas; nenhuma regra contábil/CRM/Pricing alterada. As duas correções corretivas atendem a descobertas da própria validação (ambiguidade plpgsql só aparece na execução; a trigger de equilíbrio é FOR EACH ROW e exige multi-row — padrão já usado pela suíte 08m).

**Impacto:** Migrations `20260923000200` e `20260923000300` aplicadas apenas no DEV (Push), sem reset e sem tocar PROD. Suíte nova `2h1_asset_balance_security.test.sql` com 26/26 verdes (5 funções sem EXECUTE para anon, guards A1/A2 para anon e equipe, operações admin, balanço admin/equipe, casos base). Grants efetivos verificados por catálogo (`pg_proc`/`aclexplode`): `anon=false`, `public=false`, `authenticated=true` nas 5 funções. Regressão SQL: sprint_03 33/33, sprint_04 28/28, sprint_05 48/48, 2a 53/53, 2b 31/31, 2e_outsourced 14/14, 2e_quotation_own_guard 21/21, 08l 28/28, 08f (reverdejada com sessão admin mock, ver LL-062) — sem regressão; `pricing_schema` mantém as 2 falhas pré-existentes (tests 40/41, hygiene de security definer de funções Finance/CRM/Ativos, fora do escopo 2H.1). Frontend: `npm test` 45 arquivos / 542 testes verdes; `npx tsc --noEmit` limpo; `npm run build` ok. Suítes legadas 08c/08m/08n/08e1/08g/08g1 permanecem com drift pré-existente da Etapa 08 (fora do escopo).

---

### DEC-069 — Fase 2H.2: hardening de EXECUTE em helpers de trigger e default privileges (correção das vulnerabilidades A3 e A6 da auditoria 2G)

**Status:** FECHADA

**Data:** 2026-09-23 (FASE 2H.2, somente banco DEV; frontend, CRM, regras do Motor de Preços e PROD intocados)

**Contexto:** A auditoria da Fase 2G também identificou: **A3** — o helper de trigger `prevent_supplier_code_change()` (SECURITY DEFINER, RETURNS trigger, chamado por `trg_suppliers_code_immutable` em `public.suppliers`) possuía ACL `{=X, postgres=X, anon=X, authenticated=X, service_role=X}`, ou seja, EXECUTE para anon e PUBLIC — a única função privilegiada do schema public nesse estado, enquanto as irmãs (`prevent_catalog_item_code_change`, `enforce_catalog_item_sourcing_history`, `assert_active_quotation_integrity`) já seguiam o padrão `{postgres=X, service_role=X}`; **A6** — `pg_default_acl` do schema public (owner postgres, objtype 'f') concedia EXECUTE de funções novas a `anon` automaticamente.

**Decisão:** (1) `REVOKE EXECUTE ON FUNCTION public.prevent_supplier_code_change() FROM public, anon, authenticated` — alinhando ao padrão das funções irmãs (somente `postgres` + `service_role`). A invocação via trigger (`BEFORE UPDATE ON suppliers`) é interna e não exige EXECUTE na role executora — comprovado por probe (`TRIGGER_STILL_BLOCKS`). (2) `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon` — remove o auto-grant de anon para funções novas da pipeline; a extensão efetivamente suportada pelo PostgreSQL: REVOKE de PUBLIC via default privileges é **no-op** (o EXECUTE público é intrínseco ao `acldefault()` de funções e não pode ser removido por default ACL — provado por probe `NEW_FN: PUBLIC:EXECUTE,...` persistir em todas as variantes GRANT/REVOKE). O combate ao PUBLIC é feito pelo REVOKE explícito por função (padrão do repositório) + invariante de regressão.

**Motivo:** Padrão DEC-031/internalizado ("revogar public e anon explicitamente por função"); o trigger chama o helper internamente e continua funcionando (validado em DEV pós-migration). Default privileges corrigem a regeneração de `anon:X` para funções novas; o resíduo PUBLIC é comportamento intrínseco do PostgreSQL e coberto pela suíte de regressão (nenhuma security definer executável por anon/PUBLIC).

**Impacto:** Migration `20260923000400_harden_supplier_code_trigger_execute_and_default_acl.sql` aplicada apenas no DEV (Push). Suíte nova `2h2_execute_and_default_acl_security.test.sql` com 27/27 verdes (ACL exata do helper `{postgres, service_role}`; anon/authenticated/PUBLIC sem EXECUTE; as 5 funções 2H.1 protegidas com grants authenticated preservados; invariantes de catálogo: 0 security definer no public executável por anon E por PUBLIC, 0 helper de trigger executável por PUBLIC; default privileges sem anon; função nova da pipeline sem entrada anon na ACL literal; trigger ainda bloqueia edição de FOR-*; função de probe descartada no ROLLBACK). Regressão SQL: 2h1 26/26, sprint_02 156/156, sprint_03 33/33, sprint_04 28/28, sprint_05 48/48, 2a 53/53, 2b 31/31, 2e_quotation_own_guard 21/21, 2e_outsourced 14/14, catalog_auto_code 11/11 — sem regressão; `pricing_schema` mantém a falha pré-existente (test 40, hygiene de security definer de funções Finance/CRM/Ativos, fora do escopo 2H.2); 09a PART B verdes em comportamento (B5 "falha" apenas por expectativa malformada legada — errcode capturado é `P0001` com a mensagem correta; trigger bloqueia de fato) e PART A segue como drift transacional legado. Frontend: `npm test` 45 arquivos / 542 testes verdes; `npx tsc --noEmit` limpo; `npm run build` ok.

---

### DEC-070 - Fase 2H.3: hardening de search_path em todas as security definers do public (correcao do achado A4 da auditoria 2G)

**Status:** FECHADA

**Data:** 2026-09-23 (FASE 2H.3, somente banco DEV; frontend, CRM, regras do Motor de Precos e PROD intactos)

**Contexto:** A auditoria da Fase 2G (COMPLETED_WITH_FINDINGS) identificou o achado **A4**: 25 funcoes SECURITY DEFINER do schema `public` declaravam `SET search_path = 'public, pg_temp'` (padrao antigo, herdado das Etapas 02-08). Esse valor permite hijack de funcoes/tabelas do `pg_temp` durante a execucao privilegiada de uma security definer - vetor classico de escalation (temp tables de sessao podem sombrear objetos do public). As demais 29 security definers ja declaravam `search_path=""`. A normalizacao deste lote encerra o hardening de hygiene de security definer iniciado em 2H.1 (executor/autorizacao) e 2H.2 (ACL de EXECUTE) - e, por consequencia, desbloqueia os testes 40/41 do `pricing_schema` que permaneciam pendentes por dependerem exatamente dessa hygiene.

**Decisao:** (1) **Inventario real em DEV**: 54 security definers no public; 25 com `search_path` incluindo pg_temp (lista exata da auditoria), 29 ja vazias. (2) **Auditoria de corpos** (`pg_get_functiondef`) das 25: apenas `create_manual_journal_adjustment` referencia simbolo nao qualificado (`gen_random_uuid()`); as demais 24 usam `public.*`, `auth.uid()`, parametros e built-ins do `pg_catalog` - seguras com search_path vazio. `gen_random_uuid` existe no `pg_catalog` (core, oid 3432) e em `extensions` (pgcrypto, 16460); nao qualificada, resolve para `pg_catalog` (pesquisado implicitamente primeiro) - comportamento preservado. (3) **Migration** `20260923000500`: re-emite `create_manual_journal_adjustment` com `SET search_path TO ''` + qualificacao explicita `pg_catalog.gen_random_uuid()` (zero mudanca de comportamento) e reaplica REVOKE de anon/public + GRANT a authenticated; nas outras 24, `ALTER FUNCTION ... SET search_path = ''`. Assinaturas, overloads e grants preservados. (4) Duas funcoes ja carregavam `{search_path="",TimeZone=UTC}` (price_decision_token, own_price_decision_token) - sem alteracao de configuracoes adicionais.

**Motivo:** Padrao DEC-031/2H.2: revogar public e anon explicitamente e preservar grants definidos por parametro. `CREATE OR REPLACE FUNCTION` foi usado somente onde o corpo precisou de tratamento (unica referencia nao qualificada); nas demais, ALTER do proconfig evita redefinicao de corpo e preserva comentarios/historia. Re-verificacao de REVOKE apos qualquer re-emissao e parte obrigatoria do padrao.

**Impacto:** Migration `20260923000500_harden_security_definer_search_path.sql` aplicada apenas no DEV (Push; dry-run transacional antes). Post-flight: 54 security definers preservadas, 0 com pg_temp (antes 25), search_paths distintos apenas `{search_path=""}` (52) e `{search_path="",TimeZone=UTC}` (2), `create_manual_journal_adjustment` com `pg_catalog.gen_random_uuid` e ACL `{postgres, authenticated, service_role}` intacta. Suite nova `2h3_search_path_security.sql` com 20/20 verdes. Regressao SQL: `pricing_schema` 46/46 checks sem falhas (teste 40 search_path vazio + teste 41 anon sem EXECUTE agora PASS - antes pendentes), sprint_03 33/33, sprint_04 28/28, sprint_05 48/48, 08l 28/28, 2a 53/53, 2b 31/31, 2h1 26/26, 2h2 27/27, sprint_07_crm 55/55, catalog_auto_code 11/11 - sem regressao. Legados 08m/08n (drift transacional/sintaxe da Etapa 08) e 09a (depende de pgtap ausente na sessao) seguem documentados como drift pre-existente; 08e 46/50 (4 falhas de formula/label pre-existentes), 08d 5 falhas "no data" (espera dados que o ambiente nao tem). Frontend intacto: `npm test` 45 arquivos / 542 testes verdes; `npx tsc --noEmit` limpo; `npm run build` ok.


---

### DEC-071 — Fase 3C.1: histórico de preços próprios em drawer dedicado, reutilizado em Preços Próprios e Tabela de Preços (rastreabilidade), consumindo read-only o backend das 2A/2B

**Status:** FECHADA

**Data:** 2026-09-24 (FASE 3C.1, frontend e E2E no DEV; banco e PROD intocados)

**Contexto:** o histórico de preços próprios existia apenas como o conjunto consumido pela rastreabilidade de linhas own (get_own_price_proposals), sem visual dedicado. A fase precisava expor cronologia, vigência, comparação com o preço anterior e custo interno (restrito a Admin) tanto em /pricing/own-prices quanto pela ação "Rastreabilidade" da Tabela de Preços, sem alterar o contrato de dados (migrations 20260922000100/20260922000200 — leitura read-only).

**Decisão:** (1) criar OwnPriceHistoryDrawer reutilizável: lista cronológica decrescente de propostas, badge Preco vigente na proposta vigente, bloco de comparação com o preço aprovado anterior, justificativas, e custo interno via RPC mascarada (null para Equipe); (2) em Preços Próprios, nova ação por linha Ver historico abre o drawer com currentProposalId para o badge; (3) na Tabela de Preços, a rastreabilidade das linhas own expõe Ver historico; (4) no review-drawer do comparativo, fallback Consultar historico quando a linha own não carrega histórico via prop; (5) responsividade validada por loop E2E escopado à feature: drawer fechado vs aberto deve manter o document.documentElement.scrollWidth (openWidth <= closedWidth + 1) e o próprio dialog sem overflow horizontal (scrollWidth <= clientWidth + 1);

**Motivo:** o drawer é a primitiva consistente do repo para contexto lateral; a RPC existe e já mascara custo — nenhum contrato precisa mudar; medir o documento fechado vs aberto evita atribuir à feature o overflow pré-existente da tabela min-w-[1100px] (compravado no baseline HEAD e documentado no LL-067).

**Impacto:** cinco arquivos alterados (own-prices-page, own-price-history-drawer novo + tests, review-drawer, price-list-page) e um E2E permanente novo com fixture isolada e cleanup zero-resíduo. Frontend: 566 testes verdes, 
px tsc -b limpo, 
pm run build ok. E2E completo (55 testes): 50 passed + 5 failed — as 5 falhas são exatamente a suite pré-existente (4× crm-mobile + 1× pricing-rules-team), sem relação com a fase. Banco DEV e PROD não tocados. Documentado em LL-067.

---

### DEC-072 — Fase 3C.2: elegibilidade terceirizado/ativo nas cotações + correção do overflow de página pré-existente em Preços Próprios

**Status:** FECHADA

**Data:** 2026-09-24 (FASE 3C.2, frontend e E2E no DEV; banco e PROD intocados)

**Contexto:** o editor de cotações listava no seletor de itens todos os itens do Catálogo Efetiva, incluindo itens `own`. O banco já bloqueia a inserção de itens próprios em `quotation_items` (trigger DEC-067) com erro ASCII, mas o frontend deixava o usuário chegar até esse erro sem orientação prévia; além disso, a página /pricing/own-prices com dados ultrapassava a largura da viewport em determinados breakpoints (problema pré-existente documentado no LL-067, não causado pelas fases 3C.1/3C.2).

**Decisão:** (1) no seletor de itens do editor de cotações, oferecer apenas itens `active` e com `sourcing_type = "outsourced"`, preservando itens próprios/inativos já vinculados a cotações existentes (sufixo "inativo - histórico" / "serviço próprio") e bloqueando a ativação quando houver item próprio (checklist "Apenas itens terceirizados nas linhas", erros traduzidos a partir da mensagem do backend ASCII e acentuações); (2) `hasActiveCatalog` passa a exigir ao menos um item `outsourced` ativo; (3) corrigir o overflow de página pré-existente das ações de linha de Preços Próprios ancorando o span sr-only "Acoes" no th (relative px-4 py-3) e habilitando quebra de texto na coluna do cartão mobile (min-w-0 + break-words), sem aplicar overflow-x-hidden global; (4) DROPPED: não injetar erro do backend no DOM nos E2E — o caminho backend já é coberto pela suíte SQL e a tradução por teste unitário, e a injeção via DOM é frágil com a reconciliação de options do React.

**Motivo:** alinhar o frontend à regra de negócio já imposta no banco (evitar que o usuário erre no submit e receba erro de API); itens vinculados a cotações existentes não podem sumir do seletor ao editar; erro de API só carrega message (sem SQLSTATE confiável), portanto a tradução precisa casar com o texto exato; medidas locais de overflow (acentrado no th, sem mudar TableShell) eliminam o extravasamento sem abrir mão do scroll horizontal local das tabelas largas (460+ colunas de ações) nem vetam o scroll de página no mobile.

**Impacto:** sete fontes + testes alterados (quotation-items-grid, quotation-editor-page, quotation.service/translateQuotationError, quotation.types/sourcing_type no Pick do item de linha, own-prices-page, own-price-proposal.spec.ts, playwright.config) e um E2E permanente novo (quotation-eligibility.spec.ts) com fixture isolada, marker e cleanup zero-resíduo. Frontend: 569 testes verdes, `npx tsc --noEmit` limpo, `npm run build` ok. E2E escopo: overflow de Preços Próprios verde em chromium e team-chromium (loop 375/390/768/1024/1280/1440 com dados), quotation-draft, quotation-eligibility e own-price-history verdes; suite completa chromium: 29 passed + 3 failed (ui-stability TEST 4/5 em uma execução carregada — revertido na rerun isolada: TEST 4 passou com e sem as mudanças, confirmando flakiness de ambiente, sem relação com a fase). Banco DEV e PROD não tocados. Documentado em LL-068.
