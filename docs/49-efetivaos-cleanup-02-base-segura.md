# EFETIVAOS-CLEANUP-02 — base produtiva isolada e proteções preventivas

Data: 2026-11-13. Somente EfetivaOS. Nenhuma remoção Connect, execução SQL,
conexão Supabase, migration, commit/push ou deploy nesta etapa.

## 1. Resultado e limites

Base isolada criada no commit produtivo exato, sem importar trabalho local antigo.
As duas entradas operacionais solicitadas foram aposentadas nesta cópia:
reset SQL contém somente negação executável e runtime de março contém somente
política de negação. Seus corpos originais permanecem em comentários integrais,
com integridade verificada por SHA-256. Não há flag de bypass produtivo nem
reativação por declaração de ambiente descartável.

As migrations históricas continuam intactas. Um preflight **offline e separado**
recusa seu replay por nome ou fingerprint; o plano completo atual é bloqueado.
Não foi criado provisionador capaz de executar o restante nem exclusão silenciosa
de migrations. O preflight não intercepta CLI/painel SQL manual ou as cópias antigas
preservadas. **Proteção global de todos os caminhos destrutivos não foi concluída.**

## 2. Git, isolamento e preservação

| Item | Confirmação |
| --- | --- |
| Repositório | `https://github.com/Rodrigo-Kotlin/efetivaos.git` |
| HEAD do workspace original | `c999baeb8ae40606289678364aba1ee8fb77ae59`, branch `main` |
| `origin/main` e último remoto por `git ls-remote` | `9761f7419a201dfe1def1d209d7d27272b5038e8` |
| Base exata do novo worktree | `9761f7419a201dfe1def1d209d7d27272b5038e8` |
| Tree da base | `ea46222dd6b625c413b2d96c785d88f1ec51d780` |
| Branch local criada | `chore/efetivaos-cleanup` |
| Worktree original | `D:/PWA PROJETOS/efetivaos` |
| Novo worktree / diretório ativo da sessão | `C:/Users/1cori/AppData/Local/Temp/opencode/efetivaos-cleanup-02` |

Criação autorizada: `git -c core.autocrlf=false worktree add -b
chore/efetivaos-cleanup <novo-diretório> <SHA-aprovado>`. Nenhum reset, clean,
stash, pull, alteração de branch/HEAD original ou cópia de fontes locais foi
usado. Os metadados Git compartilhados ganharam a branch e o registro de worktree;
isso não altera o conteúdo do workspace original. Nenhum outro worktree preexistente
foi modificado.

### 2.1 Inventário original preservado

O snapshot anterior `cleanup01-baseline.json` foi relido: **877/877 hashes iguais**.
O relatório 48 acrescentou um arquivo desde aquela baseline, totalizando **878
arquivos não ignorados** na entrada desta etapa: 604 rastreados e 274 não rastreados.
Havia 14 arquivos rastreados modificados, sem staged changes:

- `docs/04-decision-register.md`, `docs/05-roadmap.md`, `docs/06-learning-log.md`;
- `package.json`, `package-lock.json`, `src/app/router.tsx`;
- `src/features/connect/api/connect-api.ts`, `connect-route.tsx`,
  `hooks/use-connect-foundation.ts`, `pages/connect-foundation-page.tsx`;
- `src/features/crm/pages/ClientDetails.tsx`, `src/types/database.ts`;
- `supabase/config.toml`, `supabase/tests/connect_foundation_security.test.sql`.

Os 274 não rastreados incluem artefatos CC15–24/Financeiro/Playwright,
documentação de Contratos/Connect/auditoria 48, scripts e configurações locais,
E2E, fontes/testes CRM/Contratos, página de entrada Connect, Edge de descarte,
migrations e testes SQL locais. A listagem completa e o status por arquivo estão
no snapshot externo `cleanup02-original-snapshot.json`, junto de hashes dos
878 arquivos, HEAD, status, índice e hashes dos envs ignorados, **sem seus valores**.
O relatório 48 continua no workspace original e não foi copiado para a base nova.

### 2.2 Nenhuma contaminação da base

A nova cópia iniciou limpa com **653 arquivos versionados**, obtidos apenas do
SHA aprovado. Não foram copiados `.env.local`, `.env.test.local`, `node_modules`,
artefatos locais ou vínculo `supabase/.temp/project-ref` do workspace original.
Não há junction/symlink para dependências antigas.

Não existem na cópia nova `src/features/connect/pages/connect-entry-page.tsx`
nem as três migrations Connect 2.1 `20261029000200`, `20261029000300`,
`20261029000400`. Os cinco arquivos de frontend Connect publicados, suas rotas,
menu e health function permanecem sem alteração. Connect **não foi removido**.

## 3. Integridade das funcionalidades publicadas

Todo `src/`, `public/`, `assets/`, `vendor/`, `supabase/functions/`, as **94
migrations**, os testes publicados e `package-lock.json` foram comparados com
o snapshot da base; nenhum recebeu alteração nesta etapa. Configurações funcionais
Vite/PWA, Vitest, TypeScript, Playwright e Supabase também estão intactas;
ESLint recebeu somente o escopo Node de ferramentas descrito na seção 7.
`package.json` ganhou somente dois comandos de verificação, sem mudança de
dependencies/devDependencies ou versões.

| Componente | Evidência preservada |
| --- | --- |
| Contratos | API/queries, `client-contracts.tsx`, integração ClientDetails e testes publicados, sem diff |
| PDF/descarte contratual | `supabase/functions/discard-client-contract-document/{handler.ts,index.ts,deno.json,deno.lock}` e configuração JWT intactos; não republicados |
| SheetJS CE | `xlsx` 0.20.3 instalado do tarball versionado; SHA-256 `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8` |
| Parser seguro | `import-file-parser.ts`, reader, worker, suporte codepage BIFF5 e testes/fixtures CC22 intactos |
| Dependências corrigidas | DOMPurify 3.4.17, fast-uri 3.1.9, Zod 4.6.6, fflate 0.8.3; lock exato preservado |
| Migrations contratuais homologadas | Criação, Storage, RPC/eventos, upload e descarte, hashes iguais à base |
| Infra de frontend | Auth, providers, router, Vite/PWA, redirects, ícones e manifest sem diff |

Instalação independente: `npm ci --ignore-scripts --no-audit --no-fund` com cache
externo específico; 714 pacotes instalados, exit 0. Nenhum lifecycle script foi
executado. Não se reutilizou node_modules antigo. Node local v24.15.0, npm 10.4.0;
Node 22 do Pages não foi reproduzido nem reconfigurado nesta etapa.

## 4. Proteção das duas operações antigas

### 4.1 Reset operacional SQL

Risco original: `supabase/scripts/reset_operational_data.sql` identificava
`bxviuzluxcijbqqbpyzb` como DEV; desabilitava quatro triggers de imutabilidade/
integridade, apagava tabelas CRM/Financeiro/Preços sem filtro, reiniciava sequences
e fazia COMMIT. Contagens/backup no comentário não verificavam a identidade real
do servidor. A execução manual privilegiada poderia destruir histórico real.

Proteção atual:

- único SQL ativo é `DO ... RAISE EXCEPTION USING ERRCODE='42501' ...`;
- corpo original completo entre marcadores de comentário de bloco;
- nenhuma instrução DML/DDL/COMMIT ativa depois da negação;
- teste offline exige ausência de `/*`/`*/` internos que encerrariam a quarentena,
  ausência de sufixo executável e hash exato do original arquivado;
- mesmo um cliente que continue após o erro encontra apenas comentário.

Não foi executado o SQL para verificar isso; a validação é estática. Um wrapper
JavaScript **não** é alegado como proteção da execução SQL manual. Retirar os
comentários/recriar o arquivo histórico é modificação deliberada de fonte, não
operação suportada. O workspace original continua contendo a versão antiga,
conforme a exigência de preservação.

### 4.2 Runtime financeiro de março

Risco original: `scripts/finance/run-march-2026-runtime-test.mjs` gerava arquivo
SQL com identidade Admin fixa, chamava importador autoritativo e invocava
`npx supabase db query --linked --file ...`, sem confirmar o projeto vinculado.
BEGIN/ROLLBACK textual dependia do comportamento do runner e não tornava segura
uma chamada mutante em destino errado. O relatório 33/DEC-078 já documenta risco
histórico de rollback externo não honrado em outro período.

Agora o código ativo tem apenas import de `denyLegacyOperation` e sua chamada
incondicional. O código antigo permanece comentado e conferido pelo hash
`9b70376a092ad2dd50e025549913e5e751ec78b5ac643814b175188851317dab`.
Não lê manifest, não escreve SQL, não apaga temporários e não importa CLI/SDK
executável. Os testes **não invocam essa entrada**, nem via subprocesso/import.

### 4.3 Política fail-closed

`scripts/safety/operational-policy.mjs` implementa precondições puras:

- negação por ausência/invalidade de Project Ref explícito;
- produção negada inclusive com maiúsculas/espaços; flags de força não existem;
- CI negado pela presença de marcadores, até `CI=false`, `0` ou vazio;
- URL exata vinculada ao ref, sem userinfo, fallback `--linked` ou destino herdado;
- conflito em SUPABASE/E2E/HML project refs/URLs causa bloqueio;
- declaração `DISPOSABLE:<ref>` obrigatória para qualquer análise futura;
- **ainda assim, entradas legadas sempre terminam em erro**. A declaração não
  autoriza operação nem prova que um servidor remoto seja descartável.

Não foram fornecidos secrets/projetos reais aos testes. Todos os casos de destino
usam strings locais e o código produtivo somente como identificador proibido.

## 5. Análise precisa das migrations históricas

### 5.1 `20260828000110_financial_dashboard_tests.sql`

SHA-256 preservado:
`e4d2c6dc0d84fe1e6d737af4d01ba9ed8c5f609b40cf48b076ab96e03fedc678`.

O bloco DO tenta criar, nas linhas originais 33–99:

| Objeto sintético | Quantidade/conteúdo |
| --- | --- |
| Plano de contas | Dez contas `T8H-001` a `T8H-010`: Caixa, Banco, Clientes, Fornecedores, Receita, Custo, Despesa, Capital Social, Depreciação Acumulada, Despesa de Depreciação |
| Transações | Três `settled`: Receita Teste 08H-1 R$10.000,00 em 15/08/2026; Caixa Teste 08H-1 R$5.000,00 em 16/08; Despesa Teste 08H-1 R$3.000,00 em 17/08; competência 01/08 |
| Journal entries | **Quatro**: competência da receita, caixa recebido, competência da despesa e caixa da despesa |
| Journal lines | **Seis**: três pares débito/crédito de 10.000, 5.000 e 3.000; a entry de competência da despesa não recebe linhas nesse código |

Dependências: tabelas/constraints/triggers/roles da fundação Financeira e engine,
defaults de IDs/auditoria, `get_financial_dashboard` e suas dependências de
AR/AP/cashflow/DRE/BP. Os dados são inseridos diretamente nas tabelas, não por
um gerador isolado de fixtures nem pelo fluxo canônico de negócio.

Persistência/replay:

- não há rollback/limpeza no arquivo; `Cleanup complete.` é apenas NOTICE;
- falhas de asserção incrementam contador e emitem NOTICE; **não abortam**;
- se o DO terminar normalmente e o runner confirmar a transação, as fixtures
  persistem; uma exceção não capturada pode reverter o DO inteiro. Não presumir
  sucesso de inserção diante de guards/constraints/assinaturas atuais;
- `ON CONFLICT(code) DO NOTHING` só evita duplicar as contas. Transações/journals
  não têm idempotência própria aqui; novo replay bem-sucedido adiciona fatos
  novamente e pode reutilizar contas preexistentes do mesmo código;
- débitos e créditos iguais não tornam o dado real. Se persistido, afeta contas,
  relatórios, saldos e histórico; há ainda uma entry sem partidas nesse roteiro.

**Correção de precisão em relação ao resumo da auditoria 01:** são quatro journal
entries, não três. Não foi consultado o banco para determinar presença atual.
Não há proposta de hard delete de ledger ou correção de dados nesta etapa.

### 5.2 `20260828000300_08b2_lancamentos_tests.sql`

SHA-256 preservado:
`5ac99a8f1eb9e0a1de01eef2a1f3625436d165f45c9d32ab57520aab343e9ad7`.

É um DO com 38 verificações, não uma alteração de schema. Escolhe arbitrariamente
primeiro usuário Auth, duas contas financeiras ativas e uma categoria. Sem duas
contas, retorna SKIP normalmente. T01–T04 tentam criar operações sintéticas de
R$1.000,00, R$500,00, R$200,00 e R$300,00, descrições `Teste receita T01`/
`Teste T02`/`Teste T03`/`Teste T04`, datas 01–04/08/2026. T03 tenta liquidar em
10/08; T04 cancelar. Faz deletes manuais em linhas/entries/transações pelos IDs.

Dependências/drift:

- chama `create_manual_journal_adjustment` com **13 argumentos**; a assinatura
  publicada encontrada tem nove e retorna ID da **journal entry**, não cabeçalho
  da transação. O teste trata o retorno como transaction ID;
- chama `settle_transaction`/`cancel_transaction`, nomes sem definição encontrada
  nas migrations publicadas; as rotinas canônicas têm nomes financeiros distintos;
- consultas a catálogo/analytics também dependem de schema/contratos antigos.

Sem executar, não afirmar resultado runtime de overloads externos ao repositório.
No schema representado pelas fontes, as chamadas incompatíveis tendem a falhar e
ser capturadas; isso **não** torna o roteiro correto para provisioning.

Transações/exceções:

- o comentário promete BEGIN/ROLLBACK, mas não há rollback SQL externo real;
- cada `BEGIN ... EXCEPTION` é uma subtransação: uma exceção reverte as mudanças
  daquele bloco, inclusive criação se um delete disparar trigger de imutabilidade;
- por isso não é correto afirmar persistência inevitável nem que uma falha de
  cleanup sempre deixa a criação daquele mesmo bloco confirmada;
- por outro lado, NOTICE de FAIL não reverte nada, deletes podem afetar zero
  linhas sem erro, e blocos anteriores que terminaram normalmente podem persistir
  quando o DO/runner confirmar; o arquivo não exige `v_fail=0` por exception;
- usar ID de entry como ID de transação pode tornar a suposta limpeza ineficaz;
  contornar triggers para forçar cleanup violaria o ledger append-only.

Replay/reprovisionamento pode falhar silenciosamente, pular testes ou produzir
efeitos divergentes conforme schema/dados/roles. **Não reaplicar, adaptar em
produção ou usar como teste de aceitação do ledger.**

### 5.3 Bloqueio separado e seus limites

`supabase/quarantine/legacy-operations.json` registra base, nomes e hashes.
`provisioning-policy.mjs` lê recursivamente a árvore desta cópia, recusa symlinks,
planos ausentes/inválidos e as migrations por nome ou conteúdo normalizado
LF/CRLF/BOM; cópia renomeada de conteúdo igual também é bloqueada.
`check-provisioning.mjs` expõe apenas essa inspeção, sem adaptador de execução.

`npm run safety:provisioning` é o preflight suportado para avaliar um futuro fluxo,
não um `db push`. O plano completo atual é negado; não se criou “plano filtrado”
para executar as demais migrations. Um futuro baseline de reprovisionamento deve
ter desenho e autorização próprios, preservando histórico e sem ledger fictício.

**Limite material:** os dois arquivos imutáveis continuam SQL executável quando
enviados diretamente a um banco. O verificador não bloqueia `supabase db push`,
`supabase db reset`, `psql -f`, painel/Management API ou SQL reescrito à mão. Nenhum
controle de permissão/credencial remoto foi alterado. Alegar impossibilidade
universal de replay seria falso e incompatível com a preservação exigida.

## 6. Testes e regressão

Foram criados **34 testes offline** em `scripts/safety/operational-safety.test.mjs`:
destino ausente/inválido/produtivo, flags sem bypass, dez tipos de marcador CI,
URL/ref conflitantes, confirmação descartável, aposentadoria mesmo com declaração
válida, bloqueio antes do leitor/adapter injetado, integridade das quarentenas,
negação SQL sem sufixo ativo, hashes das migrations, nomes substituídos, conteúdo
renomeado CRLF/BOM, plano vazio/inválido e árvore real bloqueada.

As entradas de reset/março **não foram executadas**, nem importadas pelos testes;
foram lidas como texto. As funções de política/inspeção não possuem conexão ou
executor SQL. Nenhum Supabase CLI, psql, Docker, projeto remoto ou dado real foi
usado. A primeira rodada acusou dois testes de limite de comentário do reset;
o fechamento foi movido ao EOF real, sem relaxar as asserções. Rodada final: **34/34**.

Instalação/build/typecheck/testes usam apenas este worktree. Para build e testes
frontend foram definidos valores em memória para URL `https://cleanup-offline.invalid`
e chave-placeholder sem credencial. **Esse dist é de regressão, não de deploy**;
nenhum env secreto foi criado/copiado. Testes E2E/SQL de integração não executados.

| Gate executado | Resultado |
| --- | --- |
| TypeScript app e configurações Node | PASS, ambos exit 0; `--noEmit --incremental false` |
| `npm run build` | PASS, exit 0; executa também `tsc -b` e gera PWA no dist desta cópia |
| `npm test -- --no-file-parallelism --maxWorkers 1` | PASS, **868/868 testes em 62 arquivos**, 192,28 s |
| `npm run test:safety` | PASS, **34/34**, sem executar as entradas operacionais |
| Regressão CC21 de dependências | PASS, **4/4**; DOMPurify, fast-uri, Zod, somente memória/jsdom |
| Lint escopado dos scripts/entrada/config ESLint | PASS, exit 0, com `--max-warnings 0` |
| `npm audit --omit=dev --json` | PASS, exit 0, **zero vulnerabilidades conhecidas** |
| `git diff --check` | PASS, exit 0 |

Total executado: **906/906 testes** (868 frontend + 34 segurança operacional +
4 regressões de dependências). Os 34 testes foram repetidos após os ajustes
finais de validação de nomes/planos. Não foi executado lint global nem alegado
seu saneamento; a baseline de erros fora do escopo da auditoria 01 não foi
refatorada. Alertas npm de desenvolvimento não foram corrigidos ou suprimidos.

Build inclui worker `import-file.worker-DedTvJIr.js` de 836,41 kB e precache de
143 entradas / 4.142,80 KiB. Aviso de chunk >500 kB e três avisos de largura de
tabela dos testes PDF não causaram falha. Esses bytes são do build de regressão
com domínio `.invalid`, não artefato produtivo liberado.

## 7. Alterações limitadas ao worktree isolado

Modificados:

- dois pontos de entrada legados (somente negação + arquivo histórico comentado);
- `package.json`: apenas `test:safety` e `safety:provisioning`;
- `eslint.config.js`: globals Node restritos aos novos scripts/entrada de março,
  sem desabilitar regras nem alterar a baseline do frontend;
- `docs/04-decision-register.md`, `05-roadmap.md`, `06-learning-log.md`: anexos
  ADR-CLEANUP-02, gate e aprendizado, sem apagar histórico.

Adicionados: os quatro arquivos `scripts/safety/*.mjs`, manifest/README de
quarentena e este relatório. Nenhuma dependência removida/atualizada. Nenhum arquivo
excluído. Nenhum arquivo funcional de frontend/Edge/migration alterado.

## 8. Riscos remanescentes e próximo gate

1. Migrations históricas diretamente executáveis e cópias antigas no workspace
   preservado não podem ser neutralizadas por um wrapper nesta cópia.
2. O preflight precisa ser obrigatório em qualquer futuro workflow provisionador;
   nenhum workflow mutante foi criado, publicado ou validado nesta etapa.
3. Outras ferramentas antigas, por exemplo `scripts/verify-supabase.mjs`, possuem
   operações Auth reais e não se tornaram seguras por proximidade com estes guards.
   Não executadas nem alteradas; uma garantia global exigiria escopo adicional.
4. Nenhuma verificação runtime de RLS/descarte hospedado foi repetida; a integridade
   da fonte publicada foi conferida, não o estado administrativo remoto.
5. Nenhum provisionamento, remoção de fixtures, reparo contábil ou descontinuação
   Connect foi implicitamente autorizado. Não reabrir exigência de backup/restore
   dispensada no release contratual para tentar contornar esses limites.

Próximo gate deve distinguir explicitamente **remoção frontend sem banco** de
provisionamento/execução operacional. Não declarar segurança global concluída
enquanto houver execução manual fora do controle do preflight. Nenhum bypass de
produção deve ser criado para “concluir” o gate.

## 9. Fechamento

### 9.1 Integridade final

- Workspace original: **878/878 arquivos preexistentes intactos**, incluindo os
  877 da auditoria e o relatório 48; zero caminhos novos/removidos. Os hashes dos
  dois envs ignorados, HEAD, status completo e índice Git também permaneceram iguais.
- Worktree isolado: **646 dos 653 arquivos da base sem alteração**; sete arquivos
  rastreados modificados, exatamente a allowlist da seção 7; sete adicionados.
  Zero ausentes/excluídos e zero alterações inesperadas.
- Todas as **94 migrations**, toda fonte funcional src/Edge, assets, vendor,
  lockfile e configurações publicadas essenciais sem diff. Históricos SQL não
  receberam guards inseridos, comentários novos, renomes ou alterações de bytes.
- Branch/HEAD da cópia isolada continuam na base aprovada, com alterações
  **não commitadas**. Nenhum staged change, push ou deploy.

Recibos externos em `C:/Users/1cori/AppData/Local/Temp/opencode/`:

- `cleanup01-baseline.json`: referência dos 877 arquivos da auditoria anterior;
- `cleanup02-original-snapshot.json`: inventário/status/hashes originais, inclusive
  envs somente por hash; nenhum valor de segredo;
- `cleanup02-isolated-baseline.json`: hashes dos 653 arquivos da base aprovada;
- `cleanup02-integrity-receipt.json`: comparação das duas cópias;
- `cleanup02-install.log`, `cleanup02-typecheck.log`, `cleanup02-build.log`,
  `cleanup02-unit-tests.log`, `cleanup02-scoped-lint.log`;
- `cleanup02-safety-tests-final.log`, `cleanup02-security-regression.log`;
- `cleanup02-production-audit.json`.

Arquivos redirecionados pelo PowerShell podem usar UTF-16/BOM. O recibo final de
integridade também deve ser relido ao retomar o trabalho: não assumir que mudanças
posteriores do proprietário fazem parte desta baseline.

### 9.2 Status solicitado

```text
EFETIVAOS_CLEANUP_02 = PASS_WITH_REVIEW

PRODUCTION_BASE = 9761f7419a201dfe1def1d209d7d27272b5038e8
ISOLATED_WORKTREE = PASS
ORIGINAL_WORKSPACE_PRESERVED = YES

CONTRACTS_PRESERVED = YES
FINANCIAL_SECURITY_FIXES_PRESERVED = YES

DANGEROUS_SCRIPTS_GUARDED = REVIEW
HISTORICAL_MIGRATIONS_PRESERVED = YES
DATABASE_WRITES = NO

UNIT_TESTS = 906/906
TYPECHECK = PASS
BUILD = PASS
PRODUCTION_AUDIT = PASS

FILES_DELETED = 0
COMMIT_PUSH = NO
DEPLOY_EXECUTED = NO

READY_FOR_CONNECT_REMOVAL = NO
```

**Interpretação:** os dois pontos de entrada desta cópia estão neutralizados e a
base produtiva foi preparada e validada. `REVIEW` não significa que um valor de
ambiente permite executar o reset/março: não permite. Significa que migrations
imutáveis enviadas manualmente, outras ferramentas não abrangidas e as rotinas
no workspace original ainda são caminhos fora deste controle. Por exigência do
critério final, **não se declarou a proteção destrutiva global concluída** nem
se liberou automaticamente a remoção Connect.

**Próximo passo:** revisar esses limites e aprovar expressamente um gate de
remoção **somente de código frontend Connect**, nesta branch/worktree, sem SQL,
provisionamento ou ferramentas operacionais. Uma liberação geral de provisionamento
continua bloqueada e exige desenho separado; não se resolve removendo migrations
aplicadas, reparando ledger ou criando bypass de produção. Nenhuma dessas ações
foi executada ou autorizada por este relatório.
