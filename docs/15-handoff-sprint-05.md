# Handoff — Sprint 5 / ETAPA 05

## ETAPA 05 — STATUS

COMPLETED_WITH_FINDINGS

## Escopo executado

- Seleção explícita de fonte automática ou alternativa elegível por Admin, sem edição livre de custo, regra ou preço final.
- Aprovação e inativação autoritativas pelas RPCs `approve_price(uuid, text, uuid)` e `inactivate_price(uuid, text)`.
- Token CAS `decision_token` revalidado após o advisory lock para rejeitar oferta, regra ou aprovação obsoleta.
- Snapshots preservados em `price_list`: fonte, custo, regra/tipo/valor, preço final, validade, melhor oferta/custo, origem manual, aprovador e data.
- Status efetivo `approved`, `review_required` e `inactive`, com motivo estruturado para fonte inelegível, melhor custo alterado, regra alterada ou ausente.
- Reativação somente por nova aprovação explícita com token fresco.
- Comparação ampliada sem confundir menor custo, preço sugerido e preço comercial aprovado.
- Nova Tabela de Preços Efetiva em `/pricing/prices`, com uma linha corrente por item aprovado, busca, filtros, origem, status e rastreabilidade em desktop/mobile.
- Equipe somente leitura na UI e no banco; anônimo sem acesso.

## Git

Branch: `main`.

Commits técnicos:

- `980fd10 feat: protect commercial price approvals with CAS`;
- `814f02c feat: implement commercial price decisions and table`;
- `94eb2db test: cover commercial price approval flows`.

## Banco/Supabase

Projeto DEV: `bxviuzluxcijbqqbpyzb`.

Migrations aplicadas:

- `20260824000100_add_price_approval_cas.sql`.
- `20260824000110_harden_price_traceability.sql`.

Contrato corrente:

- `price_decision_token(p_catalog_item_id uuid) returns text`;
- `approve_price(p_catalog_item_id uuid, p_expected_decision_token text, p_source_quotation_item_id uuid default null) returns price_list`;
- `inactivate_price(p_catalog_item_id uuid, p_expected_decision_token text) returns price_list`;
- `pricing_comparison_v` permanece `security_invoker = true` e passou a expor snapshots comerciais, status persistido, motivo de revisão, cotação de origem, status do item de catálogo e `decision_token`;
- `price_list` permanece única por `catalog_item_id`, sem histórico analítico paralelo e sem escrita direta para `authenticated`;
- funções de decisão usam `SECURITY DEFINER`, `search_path = ''`, autorização Admin e valores integralmente calculados no PostgreSQL.

Aplicação remota:

```text
supabase migration list --linked
supabase db push --linked --dry-run
supabase db push --linked
```

Cada dry-run indicou exclusivamente a migration incremental esperada; os pushes foram concluídos e o lint remoto não encontrou erros.

## Concorrência

O teste remoto de duas sessões usou os arquivos:

- `sprint_05_concurrency_setup.sql`;
- `sprint_05_concurrency_session_a.sql`;
- `sprint_05_concurrency_session_b.sql`;
- `sprint_05_concurrency_cleanup.sql`.

Resultado observado:

```text
session_b_result: pricing_rule_changed
session_a_result: stale_approval_rejected
concurrency_cleanup: fixture_removed
```

A sessão A leu e guardou o token; a sessão B alterou a regra e confirmou; a sessão A tentou aprovar com a expectativa antiga e recebeu conflito. Isso encerra o finding concorrencial aberto na Sprint 4.

## Frontend

- `src/features/pricing/comparison/`: tipos, query, mutations, tradução de conflito, status comercial, seleção de fonte, snapshots e ações Admin.
- `src/features/pricing/price-list/`: página responsiva da tabela comercial e testes.
- `src/types/database.ts`: `PriceList`, status/motivos, campos completos da view e assinaturas RPC.
- `src/app/router.tsx` e `src/app/app-shell.tsx`: rota e navegação para `/pricing/prices`.
- TanStack Query invalida comparação e ofertas após aprovação, inativação ou conflito.
- A prévia de fonte automática usa `suggested_price`; para fonte manual, a interface informa que o valor autoritativo será calculado no servidor ao aprovar.

## Segurança

- Admin: seleciona fonte elegível, aprova, atualiza por nova aprovação e inativa.
- Equipe: consulta comparação, tabela e rastreabilidade; não vê controles e recebe erro ao chamar as RPCs de mutação.
- Anônimo: sem SELECT nas relações protegidas e sem EXECUTE nas novas assinaturas.
- Frontend envia somente item, token e ID opcional da fonte; não envia custo, regra, acréscimo, preço, aprovador nem data.
- Teardown E2E remove `price_list` antes de regras/cotações/catálogo e limita o bypass de triggers ao prefixo aleatório validado `E2E_S2_*`.

## Testes

SQL remoto:

- Etapa 05: 48/48 em `sprint_05_price_approval.test.sql`;
- regressão do schema: 40/40 em `pricing_schema.test.sql`;
- regressão Sprint 4: 28/28 em `sprint_04_rules.test.sql`;
- duas sessões remotas: mudança confirmada em B e aprovação obsoleta rejeitada em A;
- `supabase db lint --linked --schema public --level warning`: sem erros.

Frontend e E2E:

- Vitest: 142/142 em 20 arquivos;
- Playwright remoto: 10/10, incluindo Admin, Equipe e mobile;
- ESLint: aprovado;
- TypeScript/Vite build: aprovado.

## Bundle

| Métrica | Sprint 4 | Sprint 5 | Delta |
| --- | --- | --- | --- |
| Chunk principal | 563,00 kB / 164,60 kB gzip | 563,35 kB / 164,72 kB gzip | +0,35 kB / +0,12 kB gzip |
| Tabela de preços lazy | — | 11,26 kB / 3,12 kB gzip | novo |
| Drawer de decisão lazy compartilhado | — | 10,78 kB / 3,21 kB gzip | novo isolamento |
| Comparação lazy | 32,30 kB / 7,31 kB gzip | 29,36 kB / 6,78 kB gzip | -2,94 kB / -0,53 kB gzip |

O aviso do Vite para o chunk principal acima de 500 kB permanece não bloqueante.

## Decisões e aprendizados

- `DEC-029`: token CAS para decisões comerciais de preço.
- `LL-024`: lock serializa a escrita, mas não protege a intenção lida.

## Findings

- O chunk principal compartilhado permanece acima de 500 kB, embora as novas rotas estejam lazy-loaded.
- O Supabase DEV continua sem snapshot físico/PITR habilitado; o ponto de retorno operacional permanece o histórico de migrations e o snapshot lógico externo já registrado.
- `price_list` representa somente o registro comercial atual; histórico analítico/versionado continua fora do MVP.

## Próximo passo recomendado

ETAPA 06 — Dashboard básico, QA final e revisão PWA, somente após autorização explícita.
