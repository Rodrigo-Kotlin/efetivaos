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

## Pendências ainda abertas

### PEND-001 — Nome definitivo do sistema

**Status:** ABERTA

`Efetiva OS` permanece nome de trabalho.

### PEND-002 — Lançamentos financeiros de contratos recorrentes

**Status:** ABERTA

Definir posteriormente se contratos recorrentes gerarão lançamentos automaticamente ou mediante confirmação manual.
