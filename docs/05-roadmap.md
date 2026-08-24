# 05 — Roadmap do Efetiva OS

## Estado geral

**Baseline funcional:** v0.2  
**Baseline técnico:** v0.3  
**Status atual:** Sprint 2 concluida; aguardando autorizacao explicita para a ETAPA 03.

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

### Sprint 4 — Regras de preço + cálculo + revisão

**Status:** PLANNED

Escopo:

- `margin_rules`;
- regra global;
- regra por categoria;
- regra por item;
- percentual;
- valor fixo;
- hierarquia item → categoria → global;
- preço sugerido;
- drawer de revisão;
- seleção manual de fonte para Admin.

Gate:

- cálculo correto;
- sem regra = sem aprovação;
- seleção manual rastreada;
- Equipe sem permissão para alterar regra.

---

### Sprint 5 — Tabela comercial + aprovação

**Status:** PLANNED

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

- nova cotação não altera preço aprovado;
- revisão necessária funciona;
- origem rastreável até fornecedor/cotação/item.

---

### Sprint 6 — Dashboard básico + QA + PWA

**Status:** PLANNED

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

- fluxo ponta a ponta validado;
- critérios de aceite concluídos;
- PWA instalável;
- RLS validado;
- documentação atualizada.

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
