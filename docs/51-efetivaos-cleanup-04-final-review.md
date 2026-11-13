# EFETIVAOS-CLEANUP-04 — limpeza pontual e revisão final do pacote

Data: 2026-11-13. Alterações locais no worktree de limpeza; **sem commit, push ou deploy**.

## 1. Escopo, base e integridade

Worktree: `C:/Users/1cori/AppData/Local/Temp/opencode/efetivaos-cleanup-02`.
Branch `chore/efetivaos-cleanup`, HEAD/base `9761f7419a201dfe1def1d209d7d27272b5038e8`.

Verificação de entrada, antes de qualquer edição:

- as cinco exclusões Connect do CLEANUP-03 e os arquivos alterados/anexados
  anteriores conferiram exatamente com o recibo `cleanup03-integrity-receipt.json`
  (caminhos, exclusões e hash do relatório 50);
- **190 arquivos protegidos** conferidos byte a byte contra a base aprovada:
  `supabase/migrations/` (94), `supabase/functions/`, `vendor/`, `e2e/`,
  `docs/wireframes/`, `supabase/tests/`, `src/types/database.ts` e
  `supabase/seed.sql` — **zero divergências**;
- Contratos (API, queries, página, integração, testes) e parser financeiro seguro
  (`import-file-parser/reader/worker`, codepage, testes e fixtures CC22) intactos;
- workspace original `D:/PWA PROJETOS/efetivaos`: **878/878 arquivos intactos**,
  HEAD, índice, status completo e hashes dos dois envs ignorados inalterados.

Nenhuma divergência encontrada; a etapa prosseguiu. Não houve pull, reset, clean,
stash, SQL, migration, conexão ao Supabase ou acesso ao EfetivaConnect.

## 2. Dependências desnecessárias

### 2.1 Verificação de ausência de uso

Busca em todo o repositório (manifests, configs, scripts, fontes, docs de
referência) por `eslint-plugin-import`, `eslint-import-resolver-typescript`,
`import/resolver` e regras `import/*`:

- `eslint.config.js` não registra o plugin `import` nem `settings['import/resolver']`;
- nenhuma regra `import/*` está ativa; o plugin, mesmo instalado, não produzia
  diagnóstico algum;
- nenhuma fonte, script ou teste importa esses pacotes;
- nenhum pacote do `package.json` depende deles.

Confirmada a ausência de uso **antes** da remoção.

### 2.2 Remoção e consistência do lockfile

Removidos de `package.json`: `eslint-plugin-import` e `eslint-import-resolver-typescript`.

O lockfile foi regenerado pelo próprio npm (`npm install --package-lock-only`) a
partir do lockfile anterior e do novo `package.json`, com cache externo e sem
lifecycle scripts. Auditoria do delta:

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Nós de pacotes no lockfile | 830 | 781 |
| Nós removidos | — | 55 (família `eslint-plugin-import`, `unrs-resolver`, `eslint-import-resolver-*`, `tsconfig-paths`, `get-tsconfig` e dependências exclusivas) |
| Versões retidas alteradas | — | **0** |
| Linhas de produção alteradas | — | **0** |
| Dependências diretas de produção alteradas | — | **0** |

Risco encontrado e tratado: a regeneração reescreveu a estrutura de
`@tailwindcss/oxide-wasm32-wasi`,whose dependências de bundle passaram de
metadados inline para nós aninhados. Verificado que o pacote **preservou**
`resolved`, `integrity`, `cpu: ["wasm32"]`, `optional: true` e
`bundleDependencies`; os seis nós aninhados são exatamente as dependências de
bundle declaradas, todas `dev`. A regeneração foi repetida em diretório isolado,
sem `node_modules`, e o resultado foi **byte a byte idêntico** — é determinístico.

`npm ci --ignore-scripts` executado com o novo lockfile: **exit 0**, 675 pacotes
instalados (714 antes), confirmando a remoção efetiva da árvore.

### 2.3 Comparação de diagnósticos ESLint

Lint global executado antes e depois da remoção, com o mesmo comando e
configuração, comparado arquivo a arquivo:

| | Antes | Depois |
| --- | ---: | ---: |
| Erros | 61 | 56 |
| Avisos | 12 | 12 |
| Arquivos com diagnóstico | 20 | 17 |

A diferença de 5 erros é **exclusivamente** a limpeza de símbolos da Etapa 3
(detalhada abaixo). **Nenhum diagnóstico novo**; nenhuma regra mudou de
comportamento; `eslint-plugin-import` nunca produziu diagnóstico.

### 2.4 Preservação das correções de segurança

| Pacote | Estado | Evidência |
| --- | --- | --- |
| SheetJS CE | 0.20.3 vendorizado | `file:vendor/xlsx-0.20.3.tgz`; SHA-256 do tarball `8dc73fc3…9fe8`; `vendor/` intacto |
| DOMPurify | 3.4.17 | instalado e testado (4/4) |
| fast-uri | 3.1.9 | instalado e testado (4/4) |
| Zod | 4.6.6 | instalado e testado (4/4) |
| fflate | 0.8.3 | dependência direta preservada; parser/worker intactos |
| `@tailwindcss/oxide-wasm32-wasi` | 4.3.3 | metadados de plataforma preservados |

Nenhuma outra biblioteca foi atualizada, rebaixada ou removida.

## 3. Limpeza de símbolos não utilizados

Os cinco achados do compilador foram revisados individualmente:

| # | Local | Achado | Decisão |
| --- | --- | --- | --- |
| 1 | `src/components/shared/metric-card.test.tsx` | `MemoryRouter` importado e não usado | Removido o import. O componente não usa router. |
| 2 | `src/features/crm/pages/indicators-drawer.tsx` | `CrmPipelineAnalytics` importado e não usado | Removido do import de tipos; o tipo é inferido pelo hook. |
| 3 | `src/features/finance/lib/pdf-utils.test.ts` | variável `doc` ociosa | **Cobertura aumentada, não reduzida.** O teste criava um PDF e não verificava nada. Substituído por asserção real: `doc.save` é espiado e `downloadPdf` deve chamá-lo com `relatorio.pdf`. |
| 4 | `src/features/finance/lib/pdf-utils.ts` | parâmetro `data` não usado em `didDrawPage` | Removido o parâmetro; o callback mantém o rodapé por página. |
| 5 | `src/features/pricing/own-prices/own-prices-api.ts` | tipo `PriceList` importado e não usado | Removido do import de tipos. |

Correção adicional no mesmo arquivo já alterado (`pdf-utils.ts`): `let startY`
passou a `const` e o `as any` de `lastAutoTable` passou a tipagem explícita
(`jsPDF & { lastAutoTable?: { finalY?: number } }`). Erros pré-existentes do lint
nesse arquivo; corrigidos porque o arquivo estava no escopo, sem mudança de
comportamento (mesma leitura de `finalY`, mesmo fallback `startY + 10`).

**Cinco símbolos removidos** (itens 1, 2, 4, 5 e a variável `doc` do item 3),
mais duas correções de lint no arquivo já tocado.

Os **quinze exports suspeitos** da auditoria 48 (`useCrmOpportunity`,
`clientStatusOptions`, `createFinancialParty`, `exportStatement`,
`useCreatePaymentMethod`, `PaymentMethodFormValues`, `commercialStatusLabel`,
`ComparisonValidityNote`, `OfferGroup`, `OwnPriceReajusteFormData`, entre outros)
**permanecem intactos**: a exclusão automática deles não foi autorizada. Registrado
como pendência para gate futuro, com a mesma ressalva da auditoria 48 — ausência
de import estático não prova ausência de consumidor.

## 4. Navegação DFC

Constatação apurada: na base aprovada **não existia** rota `/finance/dfc`. A rota
canônica registrada era `/finance/cash-flow-statement`, e tanto o App Shell
quanto o Dashboard Financeiro apontavam para ela — portanto **não havia link
quebrado**; havia sim uma única URL canônica longa e sem nenhum alias.

A instrução recebida foi priorizar `/finance/dfc` como rota canônica, preservando
compatibilidade com links antigos. Implementado:

- `/finance/dfc` → página DFC (rota canônica);
- `/finance/cash-flow-statement` → `Navigate to="/finance/dfc" replace`,
  dentro do `ProtectedRoute` (mesmo fluxo de Auth, loading e perfil ativo);
- App Shell e Dashboard Financeiro passam a apontar para `/finance/dfc`.

Nenhuma fórmula, relatório contábil, RPC ou regra financeira foi tocada; apenas
caminhos de navegação. Cobertura adicionada em `src/app/router.test.tsx`:
rota canônica servida, URL antiga redirecionada com `replace` e link do shell
apontando para a rota canônica.

## 5. Mocks e fixtures — organização, não exclusão

Nenhum arquivo foi excluído nesta frente. Reclassificação do inventário da
auditoria 48 para a árvore vigente:

| Categoria | Quantidade | Tratamento |
| --- | ---: | --- |
| Mocks de Vitest (`vi.mock`, `vi.mocked`, `vi.stubGlobal`) | 43 arquivos `.test.*` | Preservados integralmente |
| Fixtures binárias de regressão (`e2e/fixtures/finance-cc22-*`) | 8 arquivos (XLS/XLSX/JSON/README) | Preservados; não movidos |
| Suíte E2E (`e2e/*.spec.ts`, `e2e/importer-22.html`) | 5 arquivos | Preservados |
| Testes de segurança do importador | `import-file-security.test.ts`, `import-utils.audit.test.ts` | Preservados |
| Dados sintéticos de Contratos | `contracts-api.test.ts`, `document-discard-backend.test.ts` | Preservados |
| Wireframes aprovados | `docs/wireframes/crm-comercial-mock.html` + 6 PNGs + `motor-precos-v0.3.html` | Preservados; são referência de design (DEC-059) |
| Seed estrutural | `supabase/seed.sql` | Preservado (sem dados demonstrativos) |
| Evidências e manifests | `artifacts/` (140 versionados), `docs/` | Preservados; nenhum recibo, patch ou manifest removido |
| Ferramentas de fixture (scripts) | `scripts/contracts-20-fixtures.mjs`, `contracts-24-fixtures.mjs` | Preservados; são ferramentas de gate, não mocks de UI |

O único arquivo cujo nome contém "test-helper" (`import-worker.test-helper.ts`)
é importado **apenas** por arquivos `.test.ts`. Isso motivou a regra de fronteira.

### 5.1 Regra automatizada de fronteira de imports

`scripts/safety/import-boundaries.mjs` + `scripts/safety/check-import-boundaries.mjs`
( comando `npm run safety:imports` ) implementam verificação **offline**, por AST
do TypeScript, que proíbe em código produtivo de `src/` o import de:

- `__mocks__/`;
- `__test-utils__/`;
- `src/test/` (bootstrap compartilhado de testes);
- `e2e/`;
- módulos `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx` e `.test-helper.ts`.

Regras de projeto:

- **não bloqueia imports válidos entre módulos de teste**: arquivos `.test.*` e
  `.spec.*` são explicitamente isentos da restrição, e assim seguem importando
  `import-worker.test-helper.ts` e demais helpers;
- considera imports estáticos, `import type`, re-exports e `import()` dinâmico;
- resolve alias `@/`, caminhos relativos, `index.ts(x)` e as extensões usuais;
- falhou fechado: violação faz o processo terminar com código 1 e mensagem por
  arquivo e motivo;
- não executa build, rede, banco ou escrita.

Situação atual: **222 arquivos produtivos verificados, zero violações**.

Cobertura por sete testes offline próprios
(`scripts/safety/import-boundaries.test.mjs`): classificação de cada família,
resolução de specifier, coleta de四种 tipos de import, bloqueio de import
produtivo de artefato de teste, permissão de import entre módulos de teste,
ausência de falso positivo em código produtivo e ausência de reação a meras
palavras "mock"/"fixture" em identificadores.

## 6. Artefatos temporários e `.gitignore`

Duas regras específicas adicionadas:

```text
/artifacts/playwright-report/
/artifacts/playwright-results/
```

Justificativa: as saídas do Playwright são geradas localmente (`outputDir` e
`reporter.outputFolder` em `playwright.config.ts`) e não pertencem ao histórico
versionado. O padrão de raiz `/playwright-report/` já existia, mas não cobria
os caminhos reais dentro de `artifacts/`.

`artifacts/` **não** foi ignorado: há **140 arquivos versionados** nessa pasta
(recibos de publicação CC15–24, patches de recuperação, bundles, manifests
financeiros e evidências de auditoria) que devem continuar versionados.
Nenhum arquivo foi apagado; `git clean` não foi executado. Os oito arquivos
não rastreados de `artifacts/playwright-*` do workspace **original** permanecem
intactos e inalterados — a regra nova vale para o worktree de limpeza.

Nenhum cache ou dependência foi removida. `node_modules/`, `dist/`,
`supabase/.temp/`, `.wrangler/` e `test-results/` seguem ignorados como antes.

## 7. Tamanho do bundle — explicação do chunk principal

O crescimento de 17.630 bytes no chunk principal **não é regressão**. Análise por
AST de módulos por chunk, comparando a base aprovada com o estado CLEANUP-03,
em builds idênticos e sem configuration manual de chunks:

| Observação | Valor |
| --- | ---: |
| Chunk principal antes | 555.760 bytes (`index-DWbX_Q2M.js`) |
| Chunk principal depois | 573.390 bytes (`index-Bi-ve9mb.js`) |
| **Crescimento do chunk principal** | **+17.630** |
| Módulos **removidos** do principal | 9.581 bytes (5.358 de Connect; 4.223 de `mutationObserver`/`useMutation`, que eram exclusive do Connect) |
| Módulos **absorvidos** pelo principal | 47.646 bytes |
| Neto na contagem de módulos | +38.065 |
| **Fecho estático inicial** (entrada + imports estáticos recursivos) | **609.150 → 603.886 bytes (−5.264)** |
| **Fecho transitivo** (entrada + todos os chunks alcançáveis) | **3.140.724 → 3.128.701 bytes (−12.023)** |
| Total do bundle (todos os arquivos emitidos) | 4.266.096 → 4.253.426 bytes (−12.670) |

**Causa:** com Connect removido, o chunk compartilhado `useQuery-C7rgYMwm.js`
(23.004 bytes) deixou de ter um segundo consumidor — ele era importado por 13
chunks. Sem outro consumidor, o agrupador incorporou seus módulos TanStack Query
(`query.js`, `queryObserver.js`, `utils.js`, `retryer.js`, `infiniteQueryBehavior.js`,
`useBaseQuery.js` e outros) ao chunk principal. Não houve duplicação de módulo
(nenhum módulo aparece em dois chunks) nem código novo.

**Conclusão:** o custo real de download inicial **diminuiu** 5.264 bytes; o
crescimento do chunk principal é reagrupamento, não inchaço. O total do bundle
também diminuiu. Nenhuma estratégia de chunking, lazy loading ou dependências foi
alterada para produzir números menores, conforme instruído.

Estado final desta etapa (após limpeza de símbolos e rota DFC):

| Métrica | CLEANUP-03 | CLEANUP-04 |
| --- | ---: | ---: |
| Total do bundle | 4.253.426 bytes | 4.253.467 bytes (+41) |
| JS total | 4.023.526 bytes | 4.023.567 bytes (+41) |
| Chunk principal | 573.390 bytes | 573.462 bytes (+72) |
| Fecho estático inicial (entrada + imports estáticos recursivos) | 3.128.739 bytes | 3.128.737 bytes (−2) |
| Precache PWA | 141 entradas | 141 entradas |

O delta de 41 bytes no total e de 72 bytes no chunk principal corresponde à rota
canônica do DFC e ao redirecionamento compatível; o fecho estático inicial ficou
2 bytes menor. Nenhuma estratégia de chunking foi alterada.

Verificações no bundle final: nenhum chunk Connect, nenhuma assinatura
`connect_*`/`EfetivaConnect`/`ConnectFoundationPage`/`useConnectAccess` no JS
emitido, nenhuma referência ao chunk aposentado no service worker, worker
financeiro com **hash idêntico** ao publicado (836.410 bytes), PWA gerando
`sw.js`, `workbox-*.js` e manifest. Aviso de chunk >500 kB permanece, não bloqueante.

## 8. Regressão geral

| Verificação | Resultado |
| --- | --- |
| Vitest completo | **PASS — 894/894 testes, 63 arquivos**, 195,53 s |
| Testes de segurança operacional (CLEANUP-02) | **PASS — 41/41** (34 guards + 7 de fronteira de imports) |
| Testes de dependências CC21 (DOMPurify/fast-uri/Zod) | **PASS — 4/4** |
| Testes do Connect removido | **PASS — incluídos nos 894** (shell 16, rotas 21, Auth 8) |
| Testes de navegação DFC | **PASS — 3 novos** (rota canônica, URL antiga, link do shell) |
| TypeScript app e configs Node | **PASS**, exit 0, sem emissão |
| Build de produção | **PASS**, exit 0; PWA com 141 entradas / 4.130,63 KiB |
| Lint escopado (13 arquivos alterados/adicionados) | **PASS**, exit 0, `--max-warnings 0` |
| `npm audit --omit=dev` | **PASS**, exit 0, **zero vulnerabilidades conhecidas** |
| `npm ci` com o novo lockfile | **PASS**, exit 0, 675 pacotes |
| Integridade do importador financeiro | **PASS** — worker com hash idêntico ao publicado; fixtures CC22 intactas |
| Rotas de Contratos | **PASS** — detalhe de cliente e formulário de contrato reais acessíveis nos testes de rota |
| PWA | **PASS** — manifest, ícones, SW e Workbox gerados; precache sem Connect |

Total de testes executados: **939** (894 frontend + 41 segurança operacional + 4
regressões de dependências). Nenhum teste anterior foi removido ou desabilitado.

Ambiente: Node v24.15.0, npm 10.4.0, lockfile do pacote, `npm ci` próprio. Para
build/testes foram usados os valores públicos de regressão em memória
(`https://cleanup-offline.invalid` e placeholder sem credencial). Nenhum env real
foi criado ou copiado; nenhuma chamada autenticada, E2E remoto ou SQL foi executado.

Não foram executados scripts mutantes (`reset_operational_data.sql`,
`run-march-2026-runtime-test.mjs`) nem E2E que gravem em produção.

Sobre `git diff --check`: o único apontamento restante é `package-lock.json`
(74 linhas). O lockfile é versionado com **CRLF**, convenção já presente no blob
publicado — `git show --check` do commit produtivo aprovado (`9761f74`) e do
commit de Contratos (`20883c3`) reporta os mesmos avisos de "trailing whitespace"
em `package-lock.json` e `docs/`. Com `core.whitespace=cr-at-eol` o resultado é
**exit 0**. As duas linhas em branco no fim de `docs/04` e `docs/06`, introduzidas
por esta etapa, foram removidas. Nenhum padrão de quebra de linha do repositório
foi alterado.

## 9. Manifesto do pacote consolidado

### A. Segurança — CLEANUP-02

| Tipo | Arquivos |
| --- | --- |
| Modificados | `eslint.config.js`, `package.json`, `scripts/finance/run-march-2026-runtime-test.mjs`, `supabase/scripts/reset_operational_data.sql` |
| Adicionados | `scripts/safety/check-provisioning.mjs`, `operational-policy.mjs`, `operational-safety.test.mjs`, `provisioning-policy.mjs`, `supabase/quarantine/README.md`, `supabase/quarantine/legacy-operations.json` |
| Excluídos | nenhum |

### B. Remoção do frontend Connect — CLEANUP-03

| Tipo | Arquivos |
| --- | --- |
| Modificados | `src/app/app-shell.tsx`, `src/app/router.tsx`, `src/app/app-shell.test.tsx` |
| **Excluídos (5)** | `src/features/connect/api/connect-api.ts`, `connect-route.tsx`, `hooks/use-connect-foundation.ts`, `pages/connect-foundation-page.tsx`, `types/connect-types.ts` |
| Adicionados | `src/app/router.test.tsx` |

### C. Limpeza pontual — CLEANUP-04

| Tipo | Arquivos |
| --- | --- |
| Modificados | `package.json`, `package-lock.json`, `.gitignore`, `src/app/router.tsx`, `src/app/app-shell.tsx`, `src/app/app-shell.test.tsx`, `src/app/router.test.tsx`, `src/components/shared/metric-card.test.tsx`, `src/features/crm/pages/indicators-drawer.tsx`, `src/features/finance/lib/pdf-utils.ts`, `src/features/finance/lib/pdf-utils.test.ts`, `src/features/finance/pages/finance-dashboard-page.tsx`, `src/features/pricing/own-prices/own-prices-api.ts` |
| Adicionados | `scripts/safety/import-boundaries.mjs`, `import-boundaries.test.mjs`, `check-import-boundaries.mjs` |
| Excluídos | nenhum |

### D. Documentação

| Tipo | Arquivos |
| --- | --- |
| Modificados | `docs/04-decision-register.md` (ADR-CLEANUP-02/03/04), `docs/05-roadmap.md`, `docs/06-learning-log.md` (LL-CLEANUP-02/03/04) |
| Adicionados | `docs/49-efetivaos-cleanup-02-base-segura.md`, `docs/50-efetivaos-cleanup-03-connect-frontend.md`, `docs/51-efetivaos-cleanup-04-final-review.md` |

### O que o pacote NÃO altera

Comprovado por comparação de hash contra a base aprovada (190 arquivos
protegidos, zero divergências):

- **migrations aplicadas** — nenhuma alterada, nenhuma adicionada, nenhuma removida;
- **Edge Functions publicadas** — `discard-client-contract-document` e
  `connect-health`/`_shared/http.ts` intocadas; nenhuma republicação;
- **banco Supabase** — nenhuma escrita, nenhuma migration, nenhum dado alterado;
- **regras financeiras** — fórmulas, DRE, DFC, BP, DMPL, DLPA, DVA, GL e ledger
  intocados; a única mudança em Financeiro é o caminho de URL do DFC;
- **dados de clientes** — Contratos, clientes, contatos e documentos intocados;
- **código do projeto independente EfetivaConnect** — não acessado nem alterado;
- **dependências de produção** — nenhuma versão alterada; SheetJS CE 0.20.3,
  DOMPurify 3.4.17, fast-uri 3.1.9, Zod 4.6.6 e fflate 0.8.3 preservados;
- **workspace original** — 878 arquivos intactos.

## 10. Riscos residuais

1. **Guards de SQL histórico não são proteção global.** As duas migrations em
   quarentena continuam sendo SQL executável se enviadas diretamente a um banco.
   O preflight bloqueia o replay **offline e por plano**, e não intercepta
   `supabase db push`, `supabase db reset`, `psql -f`, painel/Management API nem
   SQL reescrito à mão. As cópias antigas permanecem no workspace original, por
   exigência de preservação.
2. **Objetos Connect no backend continuam implantados.** Tabelas `connect_*`,
   RLS, RPCs, dados, usuários, `connect-health` e `_shared/http.ts` seguem
   existentes. A descontinuação cobre apenas o frontend. Qualquer desativação
   requer inventário de consumidores externos e autorização própria.
3. **`connect_integration_links` e contatos Connect permanecem** no schema, sem
   consumidor frontend; são residuais do backend, não do bundle.
4. **Fronteira de imports é verificador local**, não regra de compilação; um
   import de artefato de teste por caminho não coberto (ou escrito fora do
   padrão) escaparia. Deve rodar em CI antes de virar publicação.
5. **Quinze exports suspeitos permanecem** sem uso comprovado, por decisão
   explícita; limpeza futura exige evidência adicional, não remoção automática.
6. **Lint global segue com 56 erros e 12 avisos** pré-existentes e fora do
   escopo (`no-explicit-any` 35, regras de hooks, `only-export-components`).
   A dívida não foi refatorada; apenas o escopo alterado está limpo.
7. **Validação é offline.** Não houve E2E com dados reais, verificação
   visual em navegadores/breakpoints, RLS remoto ou auditoria administrativa do
   Supabase. Os PASS de módulo indicam regressão local e integridade de fonte,
   não validação operacional em produção.
8. **Node local v24.15.0** difere do Node 22 configurado no Pages; não foi
   padronizado nesta etapa.
9. **Chunk principal acima de 500 kB** permanece (573 kB), com aviso não
   bloqueante. A otimização real exige medição e gate próprios; não foi
   iniciada.
10. **Artefatos do Playwright** continuam no disco do workspace original; apenas
    a regra de ignore foi adicionada. Nenhuma remoção foi executada.

## 11. Plano de publicação e reversão — somente código frontend

**Pré-condições:** revisão humana deste manifesto e dos relatórios 49 e 50;
decisão explícita sobre o escopo do release; conferência do `git diff` completo
contra a base aprovada.

**Publicação sugerida (exclusivamente código frontend):**

1. Revisar as alterações localmente (`git diff 9761f74`), conferindo o manifesto
   das seções A–D e a lista de exclusões.
2. Executar, na árvore exata a ser publicada: `npm ci`, `npm run typecheck`
   via build, `npm test`, `npm run test:safety`, `npm run safety:imports`,
   `npm run safety:provisioning` e `npm audit --omit=dev`.
3. Commitar em coesão: um commit de segurança (CLEANUP-02), um de remoção do
   frontend Connect (CLEANUP-03) e um de limpeza pontual (CLEANUP-04), com a
   documentação junto. Evitar squash que esconda a separação dos grupos.
4. Push para `main` e deixar a integração GitHub → Cloudflare Pages publicar,
   conforme o processo já aprovado no CC24.
5. Após a publicação, verificar o check do Pages, o HTTP 200 em produção e um
   smoke **somente leitura** de rotas (login, `/`, `/pricing`, `/crm/clients`,
   `/finance`, `/finance/dfc` e a URL antiga `/finance/cash-flow-statement`).
6. A URL antiga do Connect deve redirecionar ao início **após autenticação**,
   sem carregar o módulo Connect.

**Reversão (exclusivamente código frontend):**

- reversão por commit no Git: `git revert` do commit de CLEANUP-03 e/ou
  CLEANUP-04 conforme o escopo da falha, seguido de novo deploy;
- o bundle anterior (com Connect) está no histórico e no deploy anterior do
  Pages; a reversão de código restaura a rota e o menu;
- a Edge Function de descarte contratual, o schema e os dados **não** são
  afetados por qualquer destes commits — a reversão é puramente de frontend;
- **não** há reversão de dados a环境污染: nenhuma etapa tocou o banco.

**Fora do escopo da publicação:** migrations, Edge Functions, objetos Connect,
dados, usuários, projeto EfetivaConnect, provisionamento e os limites
operacionais do item 10.1.

## 12. Status final

```text
EFETIVAOS_CLEANUP_04 = PASS_WITH_REVIEW

CONNECT_REMOVAL_PRESERVED = YES
UNUSED_DEPENDENCIES_REMOVED = 2
UNUSED_SYMBOLS_CLEANED = 5
DFC_NAVIGATION_FIXED = PASS

MOCKS_PRODUCTION_RISK = PASS
TEST_FIXTURES_PRESERVED = YES

MAIN_CHUNK_GROWTH_EXPLAINED = YES
BUNDLE_SIZE_BEFORE = 4253426
BUNDLE_SIZE_AFTER = 4253467

UNIT_TESTS = 894/894
SAFETY_TESTS = 41/41
TYPECHECK = PASS
BUILD = PASS
LINT_SCOPE = PASS
PRODUCTION_VULNERABILITIES = 0

ORIGINAL_WORKSPACE_PRESERVED = YES
DATABASE_CHANGES = NO
EDGE_FUNCTION_CHANGES = NO
COMMIT_PUSH = NO
DEPLOY_EXECUTED = NO

READY_FOR_PRODUCTION_RELEASE = YES
```

`MOCKS_PRODUCTION_RISK = PASS`: nenhum mock, fixture ou fallback fictício foi
removido, nenhum artefato de teste foi movido, a fronteira de imports está
automatizada e verificada, e a varredura do bundle final não encontra dados
simulados no JavaScript emitido.

`PASS_WITH_REVIEW` reflete os riscos residuais da seção 10 — sobretudo os
limites dos guards de SQL histórico e dos objetos Connect no backend, a dívida de
lint fora do escopo e a ausência de validação remota —, não uma falha do
escopo executado.

**Próximo passo:** revisão humana do pacote consolidado e decisão sobre
publicação do código frontend. Nenhuma ação adicional foi executada ou
autorizada por este relatório.
