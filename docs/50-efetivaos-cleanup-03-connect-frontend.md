# EFETIVAOS-CLEANUP-03 — remoção do Connect exclusivamente do frontend

Data: 2026-11-13. Alterações locais; publicação não autorizada.

## 1. Escopo e base

Worktree autorizado e usado:
`C:/Users/1cori/AppData/Local/Temp/opencode/efetivaos-cleanup-02`.
Branch `chore/efetivaos-cleanup`, HEAD/base
`9761f7419a201dfe1def1d209d7d27272b5038e8`, tree produtivo
`ea46222dd6b625c413b2d96c785d88f1ec51d780`.

A autorização CLEANUP-03 resolve a pendência de autorização **somente frontend**
do relatório 49. Não autoriza nem declara resolvidos provisionamento, SQL manual,
scripts antigos fora de escopo ou desativação de backend. Não foi usado pull,
reset, clean, stash, commit/push, deploy ou acesso a Supabase/EfetivaConnect.

Pré-flight: 660 arquivos não ignorados na cópia isolada (653 rastreados + sete
arquivos adicionados no CLEANUP-02), com as sete alterações rastreadas do gate
anterior. Nenhuma diferença não autorizada em fontes funcionais publicadas,
Financeiro, Contratos, lockfile, vendor, migrations ou Edge. O snapshot inicial
CLEANUP-03 foi gravado fora do repositório antes das edições/exclusões.

## 2. Remoção controlada

### App Shell

`src/app/app-shell.tsx`: removidos apenas item EfetivaConnect, ícone/import
exclusivo, `useConnectAccess`, sua consulta global, filtro e dependência de memo
específicos. Permanecem grupos, rotas de CRM/Clientes/Financeiro/Preços, regras
Admin/Equipe, logout, providers compartilhados, sidebar colapsável e drawer mobile.
O shell não precisa mais consultar memberships/permissões Connect para renderizar.

### Rotas e compatibilidade de URLs

`src/app/router.tsx`: guard e lazy import Connect removidos. As duas entradas
históricas passam a ser somente:

```text
connect                 → Navigate to="/" replace
connect/:organizationId → Navigate to="/" replace
```

Ambas continuam sob o `ProtectedRoute` existente, dentro do shell:

- autenticado com perfil ativo → início autenticado;
- visitante → login com `state.from`, depois retorno pela URL histórica e início;
- loading/perfil ausente ou inativo → bloqueio Auth existente, não contornado;
- `replace` remove a URL aposentada da posição atual do histórico;
- query/hash legados não são propagados para o início;
- caminhos desconhecidos, inclusive `/connect/<org>/rota-inexistente`, continuam
  no fluxo 404; nenhum wildcard Connect foi introduzido.

As entradas de compatibilidade não carregam página/guard/hook/API Connect.
Consultas normais da página inicial (CRM/Preços) continuam permitidas; não se
confunde “nenhuma consulta Connect” com desligamento de todos os dados do sistema.

### Fontes exclusivas excluídas — cinco

| Caminho | Consumidores anteriores / evidência para exclusão |
| --- | --- |
| `src/features/connect/api/connect-api.ts` | Consumido apenas pelos hooks exclusivos; nenhum outro módulo dependia dessa API |
| `src/features/connect/connect-route.tsx` | Import estático exclusivo no router; consumidor retirado |
| `src/features/connect/hooks/use-connect-foundation.ts` | Shell, guard e página Connect; consumidores removidos ou também exclusivos |
| `src/features/connect/pages/connect-foundation-page.tsx` | Lazy import exclusivo no router; registro retirado |
| `src/features/connect/types/connect-types.ts` | Aliases/labels da API/página/hooks exclusivos; sem consumidor restante fora da feature |

A busca depois do desacoplamento mostrou apenas referências internas entre esses
cinco arquivos; E2E não os importava. Typecheck/grafo/build verificam a ausência
de consumidores pendentes. Os cinco arquivos eram byte-idênticos à base aprovada
antes da exclusão; não continham alterações locais do proprietário. Seus blobs
permanecem no Git/base, sem commit desta remoção. Nenhum outro arquivo funcional
foi excluído. A página Connect 2.1 não publicada nunca existiu nesta cópia.

`src/types/database.ts` foi mantido **inteiro e inalterado**, inclusive `Connect*`
e tabelas `connect_*`. São contratos do schema histórico, não consultas runtime.
Auth, Supabase client, TanStack Query, componentes compartilhados e dependências
npm não foram removidos ou refatorados.

## 3. Regressão e prova de ausência de execução Connect

### Testes de shell e navegação

- `src/app/app-shell.test.tsx`: 16 testes, preservando os 11 anteriores e somando
  cinco casos de ausência Connect/menus/Financeiro/drawer mobile Admin e Equipe.
  O mock do hook descontinuado foi retirado; acessos Supabase inesperados falham.
- `src/app/router.test.tsx`: 19 testes novos sobre a **árvore real exportada pelo
  router**, com createMemoryRouter, shell/guards/login/home/pricing reais.
- `src/features/auth/protected-route.test.tsx`: oito testes existentes executados
  sem edição, incluindo loading, perfil ausente/inativo e autorização Admin/Equipe.

Total focado: **43/43**. Cobertura: as duas URLs antigas para Admin/Equipe,
query/hash, login/retorno após autenticação, replace/Voltar, loading/inativo,
404, rotas preservadas e drawer mobile que fecha após navegar.

O teste de Contratos navega pela rota real de detalhe de cliente, renderiza
`ClientDetails` e `ClientContracts` reais e abre o formulário vinculado ao cliente
para os dois perfis, sem salvar. Apenas APIs de dados são doubles offline; não
há alteração nesses componentes. Nos testes de rota, corpos de CRM/listagem e
dashboard financeiro são doubles de navegação; suas funcionalidades são cobertas
pelas suítes próprias da regressão completa, não inferidas desses placeholders.

Todos os testes novos verificam ausência de chamadas Supabase inesperadas e de
query keys Connect; a suíte de navegação também proíbe `fetch`. Não foram criados
usuários, contratos, documentos, batches, ledger ou fixtures em bancos reais.

A primeira rodada encontrou ajustes necessários **no harness novo**: opções de
Testing Library, grupo Principal inicialmente recolhido, título correto de Preços
e incompatibilidade entre AbortSignal jsdom e Request nativo do Node. O teste usa
o AbortController nativo compatível, sem mockar as rotas ou permitir rede. Nenhuma
alteração de Auth/CRM/Financeiro/Preços foi feita para acomodar os testes.

### Grafo de runtime

Análise com AST TypeScript, entrada `src/main.tsx`, resolução de alias/relativos,
imports estáticos, imports dinâmicos e `new URL` do worker; imports somente de
tipos excluídos do grafo runtime:

- 150 arquivos alcançáveis na medição após remoção;
- zero módulos `src/features/connect/` alcançáveis;
- zero chamadas `.from('connect_*')`/`.rpc('connect_*')` no runtime e em toda a
  fonte não teste analisada;
- worker financeiro seguro continua alcançável;
- strings de URLs legadas no router são compatibilidade intencional, não módulo.

Recibo externo: `cleanup03-frontend-graph.json`. Resultados do bundle, regressão
completa e integridade final são consolidados no fechamento deste relatório.

## 4. Estruturas preservadas e etapa posterior

Nenhuma alteração em `supabase/` nesta etapa. Permanecem:

- `supabase/functions/connect-health/index.ts`;
- `supabase/functions/_shared/http.ts` e `CONNECT_ALLOWED_ORIGINS` backend;
- todas as 94 migrations, inclusive Foundation Connect;
- tabelas/tipos/RLS/RPCs e demais objetos representados pelo schema;
- usuários, memberships, contatos, auditoria e todos os dados remotos;
- função de descarte contratual, configuração Deno/JWT/CORS e migrations homologadas;
- proteções/quarentena/scripts de segurança entregues no CLEANUP-02.

Health function/helper e eventual desativação de objetos Connect são apenas
candidatos para gate futuro, após inventário de consumidores externos. Não houve
consulta administrativa nem inferência de que esses objetos deixaram de existir.
O projeto independente EfetivaConnect não foi acessado ou modificado.

Todo `src/features/crm/`, `src/features/finance/`, `src/features/pricing/`, Auth,
tipos de banco, SDKs/providers, assets e vendor permanecem como na base publicada.
SheetJS CE 0.20.3, parser/reader/worker/codepage e correções DOMPurify/fast-uri/Zod
foram preservados; package.json e package-lock não mudam neste gate.

## 5. Histórico e documentação

ADR-CLEANUP-03 registra a descontinuação exclusivamente do frontend. O roadmap
identifica o plano CONNECT-1 como histórico, sem apagar ADR-001/002/003 ou fingir
que o módulo nunca foi publicado. O learning log registra a retirada da query
global e a compatibilidade de deep links sob Auth. O relatório 49 permanece
intacto como registro do gate anterior; sua pendência de autorização é resolvida
pelo pedido explícito CLEANUP-03, não por reescrita retroativa.

## 6. Fechamento e limites de validação

### 6.1 Regressão executada

| Verificação | Resultado |
| --- | --- |
| TypeScript app / configs Node | PASS, ambos exit 0, sem emissão |
| Build temporário e build padrão `npm run build` | PASS, ambos exit 0; arquivos finais dist iguais por SHA-256 à saída temporária |
| Vitest completo | **892/892, 63 arquivos**, 191,16 s |
| Shell + navegação + Auth focados | **43/43**, já incluídos nos 892; não somados duas vezes |
| Guards/quarentena CLEANUP-02 | **34/34**, somente offline, sem executar entradas legadas |
| Regressões DOMPurify/fast-uri/Zod | **4/4**, somente memória/jsdom |
| Lint dos quatro arquivos app alterados/adicionados | PASS, exit 0, `--max-warnings 0` |
| `npm audit --omit=dev` | PASS, exit 0, zero vulnerabilidades conhecidas |
| `git diff --check` | PASS |

Total único: **930/930 testes** (892 frontend + 34 segurança operacional + quatro
regressões de dependências), contra 906 no CLEANUP-02. Foram adicionados 24 testes
frontend: cinco do shell e 19 de rotas. Nenhum teste anterior foi excluído.

Distribuição da suíte frontend aprovada: Financeiro **422**, Pricing **251**,
CRM/Contratos **122**, Auth **9**, company-lookup **20**, app/shared/routes/hooks
**68**. A marcação PASS dos módulos significa regressão **local/offline** e
integridade da fonte; não significa novo teste de Auth/RLS/Storage hospedado.

Os comandos de build/teste usaram exatamente os valores públicos de regressão
em memória do CLEANUP-02 (`https://cleanup-offline.invalid` e placeholder sem
credencial), Node v24.15.0, npm 10.4.0 e o mesmo lockfile/dependências instaladas.
Não houve instalação/upgrade nesta etapa. **O dist local é de regressão, não
artefato autorizado para deploy.**

Limites: nenhum E2E mutante/remoto, SQL, chamada ao banco, teste visual completo
em navegadores/breakpoints ou validação operacional em produção foi realizado.
Lógica do drawer foi testada com Radix/DOM; CSS de layout do shell e fontes de
outros módulos não mudaram. Aviso de chunk >500 kB e os avisos já existentes de
largura de PDF permanecem; lint global/dívida técnica não foram refatorados.

### 6.2 Bundle comparável ao CLEANUP-02

Método: somar bytes brutos de **todos os arquivos gerados** em dist, incluindo
HTML, JS, CSS, imagens/ícones, manifest, SW e Workbox. Excluídos node_modules,
fontes, docs, logs e temporários. Não é medição de transferência HTTP nem apenas
download inicial. A lista de arquivos/bytes/hashes do dist CLEANUP-02 foi salva
antes da primeira edição; os totais abaixo têm o mesmo método e ambiente.

| Métrica | Antes — CLEANUP-02 | Depois — CLEANUP-03 |
| --- | ---: | ---: |
| Arquivos emitidos | 146 | 144 |
| **Bundle total, bytes** | **4.266.051** | **4.253.426** |
| Arquivos JS, incluindo SW/Workbox | 130 | 128 |
| JS bruto, bytes | 4.035.667 | 4.023.526 |
| CSS bruto, bytes | 66.513 | 66.108 |
| Precache PWA, entradas | 143 | 141 |
| Chunk Connect, bytes | 8.599 | **não emitido** |
| Worker financeiro, bytes | 836.410 | **836.410, mesmo hash** |

Diferença total: **−12.625 bytes (−0,296%)**. Não foi exigida nem prometida uma
redução específica. O dist padrão foi reconstruído ao final para que preview
local não continuasse servindo o Connect do build antigo. A baseline anterior
permanece registrada no recibo externo, não em arquivos antigos misturados ao build.

**Achado de desempenho para revisão, não ocultado:** o chunk principal passou de
`index-DWbX_Q2M.js` / **555.760 bytes** para `index-Bi-ve9mb.js` / **573.390 bytes**
(+17.630), enquanto o total diminuiu e a partição de chunks mudou. Isso não
autoriza afirmar melhora do carregamento inicial. Nenhuma configuração manual de
chunks foi adicionada para forçar números menores; eventual otimização exige
medição e gate próprios.

Verificação do candidato final: nenhum arquivo Connect emitido, nenhuma assinatura
de consulta/serviço `connect_*`, `EfetivaConnect`, `ConnectFoundationPage` ou
`useConnectAccess` no JS gerado e nenhuma referência ao chunk aposentado no SW.
SW, runtime Workbox, manifest, ícones, HTML e worker financeiro continuam presentes.
Precache final: 141 entradas / 4.130,58 KiB. Não houve alteração do modo prompt,
offline banner ou política de cache; backend e dados transacionais não ganharam
cache novo. A produção publicada **não foi alterada** e só receberá a remoção
após um release explicitamente autorizado e ativação da versão PWA correspondente.

### 6.3 Integridade e deltas autorizados

Do snapshot inicial de 660 arquivos desta cópia:

- alterados somente `src/app/app-shell.tsx`, `router.tsx`, `app-shell.test.tsx` e
  anexos documentais em `docs/04-decision-register.md`, `05-roadmap.md`,
  `06-learning-log.md`;
- excluídos exatamente os cinco arquivos exclusivos enumerados na seção 2;
- adicionados somente `src/app/router.test.tsx` e este relatório;
- 649 arquivos preexistentes intactos, cinco exclusões autorizadas e seis
  modificações autorizadas; zero alterações adicionais.

As ferramentas, guards, metadados de quarentena, package/lock, config ESLint e
relatório 49 do CLEANUP-02 permaneceram iguais por hash. Todas as fontes
CRM/Contratos/Financeiro/Preços/Auth e toda a árvore Supabase/types de banco
permaneceram iguais à entrada do gate/base publicada.

Workspace original `D:/PWA PROJETOS/efetivaos`: **878/878 arquivos não ignorados
intactos** (incluindo os 877 da auditoria 01), HEAD/status/índice iguais ao snapshot
de preservação e hashes dos dois envs ignorados inalterados. Nenhum arquivo foi
adicionado lá. Alterações desta etapa existem somente no worktree autorizado.

### 6.4 Recibos externos e reversão

Em `C:/Users/1cori/AppData/Local/Temp/opencode/`:

- `cleanup03-before-source.json`, `cleanup03-integrity-receipt.json`;
- `cleanup03-before-bundle.json`, `cleanup03-after-bundle.json`,
  `cleanup03-bundle-comparison.json`, `cleanup03-frontend-graph.json`;
- `cleanup03-navigation-tests-final.log`, `cleanup03-unit-tests.log`,
  `cleanup03-safety-tests.log`, `cleanup03-dependency-security.log`;
- `cleanup03-typecheck-final.log`, `cleanup03-node-typecheck.log`,
  `cleanup03-scoped-lint-final.log`, `cleanup03-production-audit.json`;
- `cleanup03-build.log`, `cleanup03-final-dist-build.log` e a saída temporária
  `cleanup03-build/`, igual ao dist final desta etapa.

Logs PowerShell podem usar UTF-16/BOM. Nenhum segredo foi incluído em relatório
ou recibos. Git mantém os cinco arquivos excluídos no commit-base; uma reversão
futura deve ser focada neste gate, sem reset/checkout de arquivos inteiros sobre
trabalho local, sem remover a proteção CLEANUP-02 e sem prometer reversão de dados.

### 6.5 Status final

```text
EFETIVAOS_CLEANUP_03 = PASS_WITH_REVIEW

CONNECT_MENU_REMOVED = PASS
CONNECT_ROUTES_REMOVED = PASS
CONNECT_QUERIES_REMOVED = PASS
CONNECT_FRONTEND_FILES_REMOVED = 5

OLD_CONNECT_URL_REDIRECT = PASS
APP_SHELL_REGRESSION = PASS
AUTH_REGRESSION = PASS
CRM_CONTRACTS_REGRESSION = PASS
FINANCIAL_REGRESSION = PASS
PRICING_REGRESSION = PASS

CONNECT_CHUNK_REMOVED = YES
BUNDLE_SIZE_BEFORE = 4266051
BUNDLE_SIZE_AFTER = 4253426

UNIT_TESTS = 930/930
TYPECHECK = PASS
BUILD = PASS
LINT_SCOPE = PASS
PRODUCTION_AUDIT = PASS

ORIGINAL_WORKSPACE_PRESERVED = YES
DATABASE_CHANGES = NO
COMMIT_PUSH = NO
DEPLOY_EXECUTED = NO

READY_FOR_CLEANUP_RELEASE_REVIEW = YES
```

`CONNECT_ROUTES_REMOVED=PASS` refere-se às rotas de negócio/guard/páginas; os dois
redirecionamentos de compatibilidade foram mantidos propositalmente. O status
PASS_WITH_REVIEW explicita aumento do chunk principal, limite dos testes offline
e pendências operacionais/backend fora do escopo. Nada disso autoriza publicação
automática ou remoção de dados.

**Próximo passo:** revisão do pacote local combinado CLEANUP-02/03 e do escopo de
release. Parar aqui. Commit/push, deploy, E2E com dados reais e qualquer alteração
de Edge/schema dependem de autorização específica; nenhuma foi executada.
