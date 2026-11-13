# CLIENTES-CONTRATOS-21 — auditoria direcionada de dependências

## Resultado: BLOCKED para publicação / remediação parcial validada

Base remota conferida: `c999baeb8ae40606289678364aba1ee8fb77ae59`.
Entrada: tree CC19 `3442d48bed5d03cacad5a775803a8f0758d33693`.
Checkout de trabalho: `C:/Users/1cori/AppData/Local/Temp/opencode/efetivaos-cc21-audit`.
Nenhum commit, push, deploy, acesso ao Supabase ou mudança de dados nesta etapa.
As alterações locais originais de Connect e Financeiro foram preservadas.

## Método e contagens

Auditadas separadamente a base main e a entrada CC19, antes de qualquer correção.
Ambas retornaram os mesmos alertas. npm ci instalado a partir do lockfile;
advisories conferidos também na API pública GitHub e releases dos mantenedores.

| Auditoria | Antes (main = CC19) | Depois (CC21) |
| --- | --- | --- |
| npm audit --omit=dev | 4 pacotes: 1 critical, 3 high | 1 pacote high, 0 critical |
| npm audit | 24: 3 critical, 7 high, 11 moderate, 3 low | 21: 2 critical, 5 high, 11 moderate, 3 low |
| Somente desenvolvimento, por diferença de pacotes | 20 | 20: 2 critical, 4 high, 11 moderate, 3 low |

Contagens npm são de **pacotes sinalizados**, incluindo metavulnerabilidades,
não de CVEs únicos. O único pacote produtivo restante, xlsx, possui dois advisories.
Não foi usado npm audit fix ou --force. Não houve upgrade geral de toolchain.

## VULNERABILITY_DETAILS — quatro pacotes produtivos

Todos já existem na mesma versão no main. Contratos não adiciona seus imports,
modos vulneráveis ou novos pontos de entrada. As mudanças CC21 reduzem a exposição,
mas não eliminam o problema preexistente do importador financeiro.

| Pacote / severidade inicial | Direto/transitivo e cadeia | Correção mínima disponível / executada | Alcance efetivo |
| --- | --- | --- | --- |
| dompurify 3.4.14 / critical (máximo dos 5 avisos) | Transitivo opcional: raiz → jspdf 4.2.1 → dompurify; jspdf-autotable também usa jsPDF como peer | 3.4.17, patch da mesma linha, executada só no lockfile | Instalado/bundle opcional produtivo; não há chamada a jsPDF.html ou DOMPurify no src. PDF financeiro usa primitivas jsPDF/autoTable. Contratos lê PDFs prontos, não converte HTML. Os modos vulneráveis abaixo não são utilizados. |
| fast-uri 3.1.6 / high | Transitivo: raiz → @hookform/resolvers 5.9.1 → peer opcional ajv 8.20.0 → fast-uri; também vite-plugin-pwa → workbox-build → ajv | 3.1.9 cobre os 7 avisos, executada só no lockfile; mantém ^3.0.1 exigido pelo Ajv | Classificado produtivo/ambos por peer opcional, mas src usa @hookform/resolvers/zod, não Ajv nem fast-uri. Cadeia Workbox executa no build com configuração local confiável. Não foi identificado fluxo de URL do usuário para esses métodos. |
| zod 4.4.3 / high | Direto: raiz → zod; peers de @hookform/resolvers e uso também pelo eslint-plugin-react-hooks | 4.6.6, primeira corrigida, executada; piso manifest elevado de ^4.1.11 a ^4.6.6 | Produção e desenvolvimento. Validação cliente Auth/CRM/Preços/Financeiro; objetos escalares no Financeiro e formulários controlados pela UI. Array de itens da cotação sem max continua dependendo de limites do chamador; não se presume que a atualização crie limites automaticamente. Nenhum endpoint servidor Zod foi identificado. |
| xlsx 0.18.5 / high | Direto: raiz → xlsx | Poluição de protótipo corrigida em 0.19.3; ReDoS em 0.20.2 (distribuição oficial SheetJS fora do npm). npm continua em 0.18.5, sem fixAvailable. **Não alterado.** | Produção, na leitura XLS/XLSX do Financeiro: parseFile → parseXLSX → XLSX.read → sheet_to_json. Arquivo malicioso aberto por usuário autenticado pode consumir CPU/congelar a aba ou explorar poluição de protótipo. Exportação isolada não é o vetor da poluição. Contratos não usa XLSX. |

### Advisories DOMPurify (sem CVE atribuído na consulta)

| GHSA | Severidade npm | Condição para exploração | Primeira correção |
| --- | --- | --- | --- |
| GHSA-p98j-92pf-mc4p | low | IN_PLACE com hook que remove nó e deixa handlers ativos em árvore destacada | 3.4.16 |
| GHSA-6688-9rhm-gjv2 | low | IN_PLACE retorna raiz rawtext removida; serialização e reinserção materializam markup atacante | 3.4.16 |
| GHSA-cg2g-xh64-v4q7 | critical | SAFE_FOR_TEMPLATES + modo que retorna DOM + shadow root controlado + avaliação posterior por template engine | 3.4.17 |
| GHSA-mrv2-3pqr-j5jr | high | IN_PLACE + hook remove pai/irmão, preservando handlers em subárvore destacada | 3.4.17 |
| GHSA-c6gr-qvv4-5v3f | low | PARSER_MEDIA_TYPE XHTML e allowlist de animate/set + attributeName, seguido de clique no link sanitizado | 3.4.17 |

Release 3.4.17 confirma os fixes. Nenhuma configuração citada foi encontrada no src.
Atualização defensiva pequena: mesma API pública de sanitização; regressão de
string comum e do shadow root passou. Nenhum código financeiro foi adaptado.

### Advisories fast-uri

| GHSA / CVE | Severidade npm | Condição / consequência | Primeira correção 3.x |
| --- | --- | --- | --- |
| GHSA-qw65-cvwx-89v3 / CVE-2026-84292 | high | Port não numérico controlado na serialização injeta autoridade; política de destino pode divergir do cliente HTTP | 3.1.7 |
| GHSA-58mr-gqgx-xq4g / CVE-2026-84394 | high | Bracket malformado no host e política de host baseada em representação diferente da usada pelo cliente | 3.1.7 |
| GHSA-hrr3-gc8f-f4qj / CVE-2026-86472 | moderate | Host scheme-relative percent-encoded comparado de modo case-sensitive contorna política | 3.1.8 |
| GHSA-w74x-v6f9-j3xg / CVE-2026-110306 | moderate | Scheme percent-encoded é normalizado para javascript/data após checagem apenas da string bruta | 3.1.9 |
| GHSA-xhq7-xmqj-769h / CVE-2026-110095 | low | Normalizar referência relativa antes de resolver altera semântica do caminho/chave de autorização | 3.1.9 |
| GHSA-wjr9-j795-jxcr / CVE-2026-110180 | moderate | Host com delimitadores/controles ambíguos provoca divergência de canonicalização | 3.1.9 |
| GHSA-333x-w4r6-6crp / CVE-2026-110725 | low | reference:suffix não padrão em conteúdo não confiável emite colon inicial como scheme ativo | 3.1.9 |

Fixes intencionalmente rejeitam URIs malformadas; URIs válidas mantêm a API.
Sem consumidor funcional identificado no src. Regressões cobrem port e scheme
forjados e URL HTTPS normal. Não foi alegada reprodução de todos os sete vetores.

### Zod: GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404

Acúmulo de issues de validação em coleções enormes pode esgotar memória. O release
4.6.6 descreve a antecipação das verificações de tamanho para arrays, sets e maps.
Há diferença de ênfase entre a descrição ampla do advisory e o fix: o teste
direcionado comprova rejeição de array com max antes de validar os elementos.
**Coleções sem limite continuam sem limite**; não afirmar proteção universal
contra qualquer entrada grande. Na aplicação a validação é local, não um servidor
que aceita arrays remotos arbitrários. Nenhum novo schema ou fluxo de entrada foi
adicionado por Contratos. Atualização compatível 4.x validada pelos 828 testes,
inclusive schemas/formulários financeiros e de Auth, sem mudança funcional nesses
módulos. Release cita correção de tipos de record, não uma migração de major.

### SheetJS: bloqueio específico, não aceitação automática de risco

- GHSA-4r6h-8v6p-xvw6 / CVE-2023-30533: prototype pollution ao ler arquivo preparado,
  versões <0.19.3. Exportação sem leitura de arquivos arbitrários não é o vetor.
- GHSA-5pgg-2g8v-p4x9 / CVE-2024-22363: ReDoS, versões <0.20.2.
- O parser efetivamente recebe arquivos do usuário e executa na thread da aba.
  Autenticação não torna o conteúdo confiável; ausência de servidor Node em Pages
  limita o alvo imediato ao navegador, não elimina o risco.
- Distribuição corrigida indicada nos advisories: https://cdn.sheetjs.com/.
  O npm não fornece versão corrigida. Não foi baixado/instalado tarball externo,
  substituído parser, removida dependência, bloqueado importador ou alterado Financeiro.
  A documentação oficial https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
  confirma o registry em 0.18.5 e oferece o tarball oficial 0.20.3 como opção a avaliar.
- Migrar exigiria revisar procedência/integridade/licença, APIs read/write e
  comportamento de datas, números e arquivos XLS/XLSX; testes do importador e
  exportador precisariam ser repetidos em avaliação específica.
- **Necessária decisão adicional:** autorizar essa avaliação/correção financeira
  ou aceitar expressamente o risco preexistente para este release. Não houve tal
  aceitação nesta etapa; READY_FOR_FRONTEND_RELEASE=NO por esse motivo.

## Desenvolvimento: análise separada, sem upgrade indiscriminado

Os 20 pacotes abaixo ficam fora de audit --omit=dev. Todos preexistem no main e
não mudaram com Contratos ou CC21. Pages serve dist estático, não Vite dev server,
Vitest, ESLint ou Workbox build. Isso não isenta máquinas de desenvolvimento/CI;
usar apenas código/configurações confiáveis, sem expor servidores de teste/dev à
rede não confiável. Não foi aplicada aceitação definitiva de risco da toolchain.

| Pacote(s), versão e severidade | Advisory/fix disponível | Condição e decisão |
| --- | --- | --- |
| vitest 3.2.7 (critical), tinypool 1.1.1 (critical) | GHSA-5gmw-xhrv-c9v3 / CVE-2026-104848 (2.1.1); GHSA-85c8-ppgw-ccpr / CVE-2026-104849 (2.1.2) | Cadeia vitest → tinypool. Gadget de RCE pressupõe poluição de protótipo/opções do worker controladas. npm test executa vitest run com testes locais, sem dados de clientes. Não forçar tinypool 2.x em Vitest 3; revisão separada da toolchain. |
| @vitest/mocker 3.2.7 (moderate); vitest acima herda aviso | GHSA-82fw-gwwq-j7x9 / CVE-2026-84373 (Vitest/mocker 4.1.11); GHSA-qxg6-89mg-rqv8 / CVE-2026-112949 (mocker 4.1.12) | Mock redirect/registro manual controlado por atacante em servidor de browser tests. Config atual usa jsdom e vitest run, sem browser server. Não faz parte do runtime Pages. Não fazer major de Vitest só para zerar contagem. |
| brace-expansion 1.1.18, 2.1.4, 5.0.9 (high) | GHSA-q2hr-2g5m-vwhr / CVE-2026-102277: 1.1.21/2.1.7/5.0.12; GHSA-qhr7-859c-m2p7 / CVE-2026-102278: 1.1.20/2.1.6/5.0.11; GHSA-6j4f-fj2g-mc7p / CVE-2026-102276: 1.1.19/2.1.5/5.0.10 | Cadeias de minimatch/glob/filelist de build/lint; recursão/expansão patológica requer padrões controlados por atacante. Padrões do projeto são fixos, não enviados por usuários em produção. Mantido fora da correção produtiva. |
| deepmerge 4.3.1 (low); @rollup/plugin-node-resolve 16.0.3 (low, herdado) | GHSA-gcqx-w48m-w2h4 / CVE-2026-93753, sem first_patched_version informado | Workbox build → plugin-node-resolve → deepmerge. Merge de objetos com chave de protótipo controlada. Configuração de build local confiável; não recebe payloads da UI. Não fazer downgrade do PWA sugerido pelo audit. |
| glob 11.1.0 (moderate) | GHSA-3g3m-2fjr-6pw4 / CVE-2026-118773; 14.0.2, mais alerta herdado minimatch | Workbox build → glob. Traversal continua após AbortSignal; precisa busca/padrões de custo elevado controlados externamente. Build usa padrões locais fixos. Não introduzir major transitive incompatível. |
| minimatch 10.2.6 (moderate, duas cópias) | GHSA-g3hv-75wg-m249 / CVE-2026-118764; 11.0.1 | Workbox/glob e typescript-estree. Amplificação globparts com padrão patológico; sem entrada de cliente nessa ferramenta. Corrigir em revisão própria de lint/build. |
| js-yaml 4.3.1 (high) | GHSA-2883-xcg3-v3hh / CVE-2026-84375; 4.3.2 | ESLint/config e ferramenta de build. YAML malicioso com merges vazios explora CPU. Não há importador YAML produtivo identificado. Patch futuro possível, mas não necessário para Contratos; nenhuma entrada YAML externa processada nesta etapa. |
| serialize-javascript 7.1.0 (low) | GHSA-m5mm-p8h7-m29v / CVE-2026-115897; 7.1.3 | Workbox → @rollup/plugin-terser → serialize-javascript. Função controlada contendo fechamento de script, serializada e inserida em HTML. Build não serializa funções enviadas pelo usuário. Não confundir output do build com servidor de serialização. |
| source-map-js 1.2.1 (high) | GHSA-68fv-2mgg-jv7q / CVE-2026-93749; 1.2.2 | PostCSS/build consome sourcemaps. Offsets maliciosos em mapa indexado causam DoS. Nenhum upload de sourcemap em produção; dependências/source de build precisam ser confiáveis. Não ampliar o patch produtivo. |
| vite 8.2.2 e 7.3.6 (high) | GHSA-698v-4r3x-3vcv (CVE-2026-112943), GHSA-r825-w8mm-5pxw (CVE-2026-112944), GHSA-587h-7wmj-h5pm (CVE-2026-112942), GHSA-9jrq-w75r-8gcw (CVE-2026-112945), GHSA-rq7h-c2jc-7f22 (CVE-2026-112946), GHSA-vfpm-58rq-9qcg (CVE-2026-112947); fixes 8.2.4/7.3.7 nas linhas afetadas | Vite direto, Vitest e vite-node. Endpoints dev/launch-editor expostos + editor/Windows permitem injeção; middleware/origens/paths especiais permitem leitura/XSS. Não existem no Pages estático. Config não define servidor público e vitest usa jsdom. Atualização própria recomendada, não upgrade geral aqui. |
| typescript-eslint e @typescript-eslint/{eslint-plugin,parser,type-utils,typescript-estree,utils}, todos 8.67.0 (6 pacotes moderate) | Herança minimatch; sem novo GHSA próprio | Entrada são arquivos/config/padrões de lint. Não são runtime nem upload da aplicação. Não usar sugestão automática de downgrade para 8.36.0 sem análise. |
| vite-plugin-pwa 1.3.0 e workbox-build 7.4.1 (2 pacotes moderate) | Herança de glob/minimatch e plugin-node-resolve/deepmerge | Plugins de build, não o service worker executado no browser. Fixes de dependências precisam respeitar APIs e geração do SW; não trocar PWA para zerar metavulnerabilidades. |

Cadeias completas por nó, versões afetadas/corrigidas e descrições originais de
cada advisory estão nos JSONs de evidência. Alertas herdados não são contados
novamente como CVEs independentes. Em dev, npm sugere em alguns casos majors ou
downgrades, não adotados. Nenhum alerta dev foi classificado automaticamente como
risco de acesso produtivo ao banco ou ao Pages estático.

## Lint: três conjuntos separados

1. **Contratos:** nenhum erro introduzido; lint de todos os arquivos JS/TS do
   pacote e do novo teste de segurança passou.
2. **main:** export limpo da base com a mesma toolchain reproduz exatamente os
   diagnósticos do candidato (61 erros/12 avisos, mesmas linhas/regras/mensagens
   normalizadas). Nenhuma correção funcional alheia foi feita.
3. **Workspace original:** executado lint separado e classificados os arquivos
   com diagnósticos fora da allowlist do pacote; 21 arquivos, incluindo baseline
   e possíveis diferenças locais, registrados sem alterar esses arquivos.

`npm run build` é `tsc -b && vite build`, não chama lint. Não há workflows GitHub
versionados no main/candidato. Check-run observado do main é Cloudflare Pages,
success. Não há evidência de exigência global de lint no CI observado; não foi
certificada configuração administrativa inacessível do Pages. Por autorização
CC21, erros globais comprovadamente preexistentes não são bloqueador isolado.

## Regressão, isolamento e segredos

- npm ci PASS após alteração: consistência manifest/lock e integridade dos pacotes.
- Somente três nós instaláveis mudaram no lock; nenhum pacote adicionado/removido.
  Manifest mudou apenas o piso Zod, sem promover transitivas a diretas/overrides.
- npm test: **828/828 PASS**, 61 arquivos; inclusive Financeiro/Auth/CRM.
- `node --test scripts/test-contracts-21-dependencies.test.mjs`: **4/4 PASS**.
- `tsc -b`: PASS; Vite build/PWA: PASS, com aviso de chunk >500 kB preexistente.
  Build usou URL pública produtiva e placeholder anon, sem credencial privilegiada.
- Lint escopado: PASS. Diagnósticos globais iguais aos do main: não regressão.
- Edge: `deno check --frozen --config deno.json index.ts` PASS;
  `deno audit --frozen`: **No known vulnerabilities found**. SDK permanece
  2.112.3, lock inalterado. Nenhum deploy ou teste remoto realizado.
- Varredura estática de segredos do pacote/dist e isolamento são registrados em
  `package-validation.json`/`release-package.json` nos artefatos locais CC21.
  Não é certificado de ausência de qualquer formato desconhecido de segredo.
- Código Connect, Financeiro, router, connect-health, migrations e função Edge
  permanecem byte-a-byte iguais ao pacote CC19; Connect/Financeiro/router também
  iguais ao main. Dependências compartilhadas corrigidas têm regressão local verde,
  mas isso não equivale a E2E produtivo. Trabalho local misturado não foi incluído.

## Evidências e preparação de publicação

Em `artifacts/contracts-21/` do workspace original:

- `base-{all,production}.json`, `before-{all,production}.json`, `after-{all,production}.json`;
- `production-advisories.json`, `all-advisories.json`, `all-dependency-chains.json`;
- `registry-*.json`, `metadata-*.json`, `release-notes.json`, `lockfile-diff.json`;
- `unit-tests.log`, `security-regression.log`, `typecheck.log`, `build.log`;
- `scoped-lint.log`, `base-lint-diagnostics.json`, `candidate-lint-diagnostics.json`;
- `original-workspace-lint.json`, `local-excluded-lint.json`, `main-check-runs.json`;
- `deno-check.log`, `deno-audit.log`, `summary.json`;
- `package-validation.json`, `release-package.json` e patch do tree preparado.

O pacote preparado é **candidato bloqueado**, não liberação aprovada. Contém o
CC19 e somente correções/de documentação/teste CC21. Não inclui artefatos, .env,
scripts de operação produtiva CC20 ou alterações locais alheias. Novo tree exige
reconfirmação antes de publicação futura; nenhum commit/push foi autorizado aqui.

## Relatório final

```text
EFETIVAOS_CLIENTES_CONTRATOS_21 = BLOCKED
CRITICAL_VULNERABILITIES_BEFORE = 1
HIGH_VULNERABILITIES_BEFORE = 3
PRODUCTION_VULNERABILITIES_AFTER = 1 (xlsx; dois advisories)
DEVELOPMENT_VULNERABILITIES_AFTER = 20 (pacotes; inclui avisos herdados)
SECURITY_REMEDIATION = REVIEW
CONTRACTS_LINT = PASS
UNIT_TESTS = 828/828 (+4/4 regressões de segurança)
TYPECHECK = PASS
BUILD = PASS
GIT_PACKAGE_ISOLATION = PASS
PRODUCTION_DATABASE_WRITES = NO
COMMIT_PUSH = NO
DEPLOY_EXECUTED = NO
READY_FOR_FRONTEND_RELEASE = NO
```

Próximo passo: avaliação específica do XLSX financeiro ou aceitação expressa do
risco residual pelo proprietário. Não decidir isso pela redução de 4 para 1.
