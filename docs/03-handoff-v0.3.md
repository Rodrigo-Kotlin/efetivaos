# Handoff — Projeto Efetiva OS v0.3

> Documento técnico histórico recebido no Gate 00.1. Para o estado executado da Sprint 0 e as adaptações incrementais validadas, consulte `docs/09-handoff-sprint-00.md` e `docs/04-decision-register.md`.

## 1. Estado do projeto

O **Efetiva OS** é um PWA interno de gestão administrativa da Efetiva SST, separado do Efetiva Gestão. A baseline funcional continua sendo a especificação v0.2 do Motor de Preços. A v0.3 transforma essa baseline em desenho técnico de banco/Supabase e wireframes revisáveis, sem ampliar o escopo comercial do MVP.

## 2. Baseline preservada

- Stack: React + TypeScript + Vite + Tailwind + Supabase + Cloudflare Pages.
- TanStack Query para server state.
- Zustand apenas para estado de UI compartilhado.
- TanStack Table para tabelas operacionais.
- React Hook Form + Zod para formulários/validação.
- shadcn/ui como base composável customizada pelos tokens Efetiva.
- Multiusuário desde o início.
- Perfis funcionais: `admin` e `equipe`.
- Supabase Auth + RLS obrigatório em todas as tabelas sensíveis.
- PWA instalável, sem offline-first para dados transacionais.
- Code-splitting por rota desde o início.

## 3. Motor de Preços — fluxo v1

`fornecedor → cotação → itens → comparação → regra de acréscimo → preço sugerido → revisão → aprovação → tabela comercial`

Decisões funcionais da v0.2 permanecem válidas:

1. Cotação é cabeçalho/documento com múltiplos itens.
2. Comparação ocorre por `catalog_item_id`.
3. Catálogo Efetiva é a referência canônica.
4. Usar “acréscimo sobre custo”, não margem genérica.
5. Tipos: percentual sobre custo ou valor fixo.
6. Hierarquia: item → categoria → global.
7. Cotação vencida fica no histórico e não disputa.
8. Cotação sem validade pode disputar com alerta.
9. Menor custo vigente é a sugestão automática.
10. Admin pode selecionar outra fonte elegível.
11. Nova cotação nunca sobrescreve preço aprovado.
12. Aprovação é explícita e restrita ao Admin.
13. Fonte vencida ou nova referência relevante gera revisão necessária.
14. Preço aprovado rastreia fonte, regra, snapshots, aprovador e data.
15. Dinheiro usa `numeric/decimal`, nunca float.
16. CUB/NR-4 permanece na Fase 2.
17. Arquivo original pode ser anexado sem OCR/IA no MVP.

## 4. Artefatos v0.3

### 4.1 Migration SQL/Supabase
Artefato original: `docs/archive/EFETIVA_OS_v0.3_Pacote_Tecnico.zip`
Migration incremental validada: `supabase/migrations/20260823000200_create_pricing_schema.sql`

Inclui:

- enums de papel, status de cotação, escopo/tipo de regra e status de preço;
- `profiles` integrado ao Supabase Auth;
- helpers `current_app_role()`, `is_internal_user()` e `is_admin()`;
- tabelas `suppliers`, `catalog_categories`, `catalog_items`, `quotations`, `quotation_items`, `margin_rules`, `price_list`;
- constraints e índices;
- triggers de auditoria e ciclo de vida;
- views de candidatos, ranking, menor custo e comparação;
- função `resolve_margin_rule(item_id)`;
- RPCs `approve_price(item_id, source_quote_item_id?)` e `inactivate_price(item_id)`;
- políticas RLS para Admin/Equipe;
- bucket privado `supplier-quotes` e políticas de Storage.

### 4.2 Protótipo navegável
Arquivo: `docs/wireframes/motor-precos-v0.3.html`

Rotas/telas representadas:

- Comparação
- Tabela de Preços
- Cotações
- Nova cotação
- Fornecedores
- Catálogo
- Regras de preço
- Drawer de revisão

O HTML é um protótipo estático, sem backend, destinado à validação de navegação, densidade de informação e hierarquia visual.

### 4.3 Documento técnico
Arquivo: `docs/02-projeto-tecnico-v0.3.docx`

Contém arquitetura, modelo lógico, dicionário de dados, constraints, índices, views, RPCs, RLS, rotas, wireframes, estados de UI, responsividade, estratégia de testes e sequência de implementação.

## 5. Refinamentos técnicos fechados na v0.3

### DT-01 — Mapeamento progressivo em rascunho
`quotation_items.catalog_item_id` pode ser `NULL` enquanto a cotação está em `draft`. A ativação exige 100% dos itens mapeados.

### DT-02 — Um item canônico por cotação
No MVP, o mesmo `catalog_item_id` só pode aparecer uma vez por cotação. Isso evita dupla contabilização acidental do mesmo item.

### DT-03 — Preço unitário normalizado
A v1 assume que `unit_price` já representa o custo comparável na unidade canônica do Catálogo Efetiva. Conversão de pacote/lote, faixas, quantidade, frete, impostos e tributos não entram na v1.

### DT-04 — Status efetivo derivado
A UI consome `effective_status` da `pricing_comparison_v`. Vencimento e necessidade de revisão dependentes da data são calculados em leitura e não dependem de cron job para permanecer corretos.

### DT-05 — Snapshot do melhor custo na aprovação
`price_list` guarda também:

- `best_quotation_item_id_at_approval`
- `best_cost_at_approval`

Isso permite distinguir corretamente uma fonte manual legítima de uma mudança posterior do menor custo.

### DT-06 — Aprovação server-side
A aprovação deve passar pela RPC `approve_price()`. O frontend não envia `final_price` como verdade; a função valida perfil Admin, elegibilidade, regra, calcula e grava snapshots.

### DT-07 — Sem hard delete histórico
Registros que integram histórico não devem ser apagados fisicamente. Exceção operacional: linhas de `quotation_items` ainda em cotação `draft` podem ser removidas.

### DT-08 — Fornecedor inativo
Inativar fornecedor bloqueia novas cotações. Para remover uma cotação já ativa da disputa, a cotação deve ser cancelada explicitamente; inativar o fornecedor não reescreve o histórico da cotação.

## 6. Objetos de leitura que o frontend deve usar

### `quotation_item_candidates_v`
Expõe itens com fornecedor/cotação, validade e flags:

- `is_expired`
- `validity_not_informed`
- `is_eligible`

### `ranked_quotation_items_v`
Ranking por `catalog_item_id` usando:

1. menor `unit_price`;
2. em empate, maior validade conhecida;
3. depois, cotação recebida mais recentemente.

### `best_quote_per_item_v`
Uma linha por item com a melhor oferta elegível atual.

### `pricing_comparison_v`
Contrato principal da tela de Comparação. Deve entregar, entre outros:

- item/categoria/unidade;
- quantidade de ofertas elegíveis;
- menor custo/fornecedor atual;
- regra comercial resolvida;
- preço sugerido;
- preço aprovado e snapshots;
- `effective_status`;
- `review_reason`.

## 7. Segurança / RLS

### Equipe
- SELECT/INSERT/UPDATE em fornecedores, catálogo e cotações conforme ciclo de vida.
- CRUD de linhas apenas enquanto a cotação estiver em `draft`.
- SELECT da tabela comercial.
- Sem CRUD direto em `margin_rules`.
- Sem aprovação/inativação de preço.

### Admin
- Mesmo acesso operacional da Equipe.
- Gerencia regras comerciais.
- Aprova/inativa preços por RPC.
- Pode remover arquivos do Storage privado.

### Anônimo
- Nenhum acesso às tabelas do Motor de Preços.

## 8. Storage

Bucket privado: `supplier-quotes`

- Tipos previstos: PDF, JPG/JPEG, PNG e WEBP.
- Limite inicial: 10 MB por arquivo.
- Usuários internos autenticados podem ler/enviar/atualizar arquivos autorizados.
- Delete restrito ao Admin.

## 9. Rotas propostas

- `/pricing` → redirect para comparação
- `/pricing/comparison`
- `/pricing/prices`
- `/pricing/quotations`
- `/pricing/quotations/new`
- `/pricing/suppliers`
- `/pricing/catalog`
- `/pricing/rules` — Admin

## 10. Testes obrigatórios antes do React definitivo

Rodar em projeto Supabase de desenvolvimento:

- T-DB-01: duas cotações ativas → menor custo correto.
- T-DB-02: menor oferta vence → próxima é sugerida sem apagar histórico.
- T-DB-03: sem validade → elegível + alerta.
- T-DB-04: item > categoria > global.
- T-DB-05: sem regra → aprovação falha claramente.
- T-DB-06: cálculos percentual/fixo.
- T-DB-07: Equipe não altera regra nem `price_list`.
- T-DB-08: Equipe cria/edita draft, não ativa com item sem mapa.
- T-DB-09: ativa fica imutável salvo cancelamento.
- T-DB-10: fonte manual grava `manual_source=true` e snapshot do melhor custo.
- T-DB-11: nova oferta mais barata gera `review_required` sem alterar preço aprovado.
- T-DB-12: fonte aprovada vencida gera `review_required` por data.
- T-DB-13: fornecedor inativo bloqueia nova cotação e preserva histórico.
- T-DB-14: anon não lê tabelas do módulo.
- T-DB-15: Storage privado; Equipe não remove arquivo, Admin remove.

## 11. Ordem recomendada daqui para frente

1. Revisar o documento técnico v0.3 e o protótipo HTML.
2. Criar/usar um projeto Supabase **de desenvolvimento**.
3. Executar `supabase/migrations/20260823000200_create_pricing_schema.sql` nesse ambiente.
4. Criar duas contas de teste: uma Admin e uma Equipe.
5. Rodar T-DB-01 a T-DB-15 e corrigir qualquer incompatibilidade real do PostgreSQL/Supabase.
6. Congelar a migration v1 após os testes.
7. Iniciar Sprint 0 do frontend.
8. Seguir Sprint 1 → 6 conforme o documento técnico.

## 12. Observação de validação

A migration foi preparada e revisada estruturalmente no ambiente de geração, mas **não foi executada contra uma instância real do PostgreSQL/Supabase nesta etapa**. Ela deve ser tratada como migration candidata pronta para teste em desenvolvimento, não como migration de produção já homologada.

## 13. Próximo gate

Só iniciar implementação React definitiva após:

- revisão/aprovação dos wireframes;
- migration executada em Supabase de desenvolvimento;
- RLS validado com Admin/Equipe;
- T-DB-01 a T-DB-15 aprovados.
