# CLIENTES-CONTRATOS-22 — correção direcionada do XLSX financeiro

## Resultado: PASS_WITH_REVIEW / pronto para revisão, não publicado

O checkout CC21 foi encontrado e seu tree/patch conferidos antes de uso:
`891bc1d3a6785d2192c3c7d70b1e6a593fad9242`.
Ele permaneceu preservado em `C:/Users/1cori/AppData/Local/Temp/opencode/efetivaos-cc21-audit`.
Novo checkout isolado: `C:/Users/1cori/AppData/Local/Temp/opencode/efetivaos-cc22-importer`.
Base Git: `c999baeb8ae40606289678364aba1ee8fb77ae59`.
Nenhum commit/push/deploy, acesso ao Supabase, migration ou escrita de dados.

## 1. Auditoria do uso anterior

Referências originais diretas no src:

| Arquivo | Uso |
| --- | --- |
| src/features/finance/lib/import-utils.ts | XLSX.read, sheet_to_json e escrita do modelo XLSX; CSV via PapaParse |
| src/features/finance/lib/export-utils.ts | aoa_to_sheet, book_new, book_append_sheet, write; exportações financeiras |
| src/features/finance/lib/import-utils.audit.test.ts | Fixtures XLSX/BIFF8 e regressões de normalização |

Chamadores: `pages/import-wizard.tsx` (entrada CSV/XLS/XLSX), exportações em
transactions/payables/receivables e exportStatement. `import-persist.ts` usa
resultado/metadata, não importa o parser. Execução no navegador, não na Edge nem
no banco. Código original escolhia primeira folha com !ref e convertia os dados
com `defval:null,raw:true`. Datas ficavam como seriais Excel para normalização
existente; números permaneciam números. CSV mantinha strings, BOM e fallback
Windows-1252/UTF-16. Cabeçalhos desconhecidos eram mapeados manualmente.

Não havia limites explícitos no parser para tamanho/linhas/colunas ou timeout.
FileReader processava na thread da UI; exceções síncronas no onload não eram
capturadas de modo a sempre rejeitar a Promise. O wizard já apresentava mensagens
de falha, sem gravar registros antes de preview/confirmação.

Testes prévios relevantes: 17 import-utils, 66 import-utils.audit, 6 import-persist
e 6 export-utils. A suíte global tinha 828 casos, mais 4 regressões CC21 à parte.
Migration local `20260828000500_create_import_tables.sql` documenta bucket
finance-imports com 10485760 bytes e MIME CSV/XLS/XLSX; não foi executada nem
consultado o projeto remoto para definir os novos limites.

## 2. Alternativas e procedência

| Opção | Manutenção/licença/dependências | Compatibilidade e risco | Decisão |
| --- | --- | --- | --- |
| SheetJS CE 0.20.3 oficial | Documentação oficial aponta CDN, não npm 0.18.5; Apache-2.0; tarball sem dependências transitivas nem install hooks, inclui tipos | Mesmas APIs read/write e XLS/BIFF + XLSX; após fixes 0.19.3/0.20.2. Exige codepage explícito no worker ESM para BIFF5 CP1252 | Selecionada, menor alteração funcional; distribuição fixada em vendor e lock |
| ExcelJS 4.4.0 | MIT, último stable npm consultado publicado em 2023-10-19; biblioteca pública com tipos e bundle browser, mas manutenção não é presumida pela popularidade | APIs/modelo de célula/datas diferentes; suporta XLSX/CSV, não XLS/BIFF equivalente. Auditoria isolada do lock alternativo retornou 2 pacotes moderate (exceljs/uuid, GHSA-w5hq-g745-h8pq). Não integrado nem executado no candidato | Rejeitada antes de qualquer retirada do formato XLS. Bundle integrado não medido, pois falha no requisito funcional e exigiria outro parser |
| Manter 0.18.5 apenas com worker/limites | Mantém distribuição npm vulnerável | Limita efeitos/recursos, mas não remove as duas falhas no parser efetivamente utilizado | Não selecionada |

Fonte oficial: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
Tarball: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

- SHA-256 observado: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`.
- SRI no lockfile e vendor/README: SHA-512 do mesmo arquivo HTTPS, 2409319 bytes.
- Hash fixado garante reprodução do arquivo revisado, não assinatura independente
  do mantenedor. Licenças incluídas no tarball preservadas.
- CVE-2023-30533 / GHSA-4r6h-8v6p-xvw6: vulnerável <0.19.3.
- CVE-2024-22363 / GHSA-5pgg-2g8v-p4x9: vulnerável <0.20.2.
- 0.20.3 está fora de ambos os intervalos. Também feita consulta explícita por
  nome/versão ao serviço npm para xlsx 0.20.3 e fflate 0.8.3, não somente audit do
  caminho file:. Nenhum aviso conhecido retornado. Não é garantia de zero falhas futuras.

## 3. Implementação e compatibilidade

- Manifest usa `xlsx: file:vendor/xlsx-0.20.3.tgz`; tarball incluído para npm ci
  independente do CDN. Oito dependências exclusivas antigas do XLSX removidas do
  lock. Nenhuma versão alheia atualizada.
- Fflate **0.8.3**, já presente via jsPDF, foi promovido a dependência direta
  (MIT), sem mudar versão/adicionar nó, para inspeção DEFLATE limitada em fluxo.
- `import-file-parser.ts`: decodificação/CSV/planilha e controles de recursos.
  `import-file-reader.ts`: FileReader + worker transferível, uma leitura por vez,
  rejeição de falhas/timeout e descarte do worker em todos os desfechos normais.
- `import-file.worker.ts`: recebe somente bytes e formato; não recebe credenciais,
  IDs financeiros ou referências. Configura codepage oficial para XLS legado.
- `src/types/xlsx-codepage.d.ts`: declaração mínima do asset ESM oficial sem tipos.
- `import-utils.ts` reexporta as mesmas APIs. Trecho de mapeamento/validação de
  linhas em diante e export-utils/import-persist permanecem byte-a-byte iguais ao
  CC21. Sem alteração de cadastro, referência contábil, saldo, idempotência ou RPC.
- Vazio válido/header-only continua sem gerar lançamentos; tipos inválidos de
  data/dinheiro continuam erros de linha da validação financeira existente.
  Booleanos reais de Excel em colunas extras também são preservados; o tipo
  ParsedRow foi ajustado para representar esse valor que o parser já pode emitir.
- Primeiro sheet realmente preenchido é escolhido: BIFF pode declarar !ref=A1
  numa folha vazia. Uma folha com cabeçalho não é confundida com ausência de dados.
- CSV (; e vírgula), XLS/BIFF5 CP1252, XLS/BIFF8 e XLSX foram testados. Fixtures
  geradas com 0.18.5 e resultados esperados associados são sintéticos, sem dados reais.
- HTML/texto renomeado como XLS e ZIP não OOXML são agora recusados, não tratados
  como planilha binária. Não há retirada de XLS/BIFF real ou troca de formato.
  Macros/ZIP cifrado, ZIP64 e containers ambíguos/inseguros são recusados; não se
  promete suportar qualquer conteúdo que uma extensão .xls/.xlsx possa esconder.
- Mensagens existentes de extensão incompatível e erro de leitura preservadas;
  novos controles têm mensagens específicas. Erro não retorna import truncado.

## 4. Controles e testes de segurança

| Controle | Limite / evidência |
| --- | --- |
| Arquivo antes de ler/alocar worker | 10 MiB, alinhado ao limite do bucket no SQL local |
| Volume selecionado | 10000 linhas de dados, leitura limitada às primeiras 10002 linhas físicas (não truncar silenciosamente), 100 colunas, área máxima 250000 células, 32767 caracteres/célula |
| ZIP | Até 2048 entradas, 16 MiB por entrada e 64 MiB expandidos; conferir diretório/local headers, nomes, métodos, tamanhos reais e CRC |
| DEFLATE hostil | Entrada comprimida enviada em blocos de 1024 bytes, verificar saída incremental sem guardar todo ZIP expandido; rejeitar metadados mentirosos/saída acima do anunciado |
| Cabeçalhos perigosos | Recusar __proto__, prototype e constructor (incluindo variações de caixa/espaço), antes da projeção; linhas internas com protótipo nulo |
| Conteúdo ativo | Sem avaliador de fórmula, DOM innerHTML, execução de macro ou fetch de hyperlinks. Fórmula somente com valor cacheado, sem recalcular |
| Isolamento/tempo | Worker novo/descartável, prazo total de 15 s e uma leitura ativa; timeout aborta leitura, termina worker e permite retry; browser sem worker falha fechado |
| Erros | Arquivo vazio/corrompido/truncado, CRC inválido, extensão inválida, dimensões excedidas, headers desconhecidos/perigosos, data/dinheiro inválidos e retry testados |

Há mitigação proporcional de memória/CPU, não quota absoluta de heap do processo
do navegador nem prova de resistência contra todo arquivo possível. Valores
legítimos acima dos limites devem ser divididos; nenhum ajuste automático de dados
ou descarte silencioso de linhas foi implementado. XLS/CFB não usa as mesmas
cotas de descompressão ZIP; tem limite de entrada, sheetRows/dimensões e worker.

## 5. Regressão e achados durante desenvolvimento

- npm ci PASS, manifest/lock/tarball consistentes.
- Importador/persistência/exportador: **135/135 PASS** (inclui 40 casos novos).
- Suíte global: **868/868 PASS**, 62 arquivos (828 anteriores + 40 novos).
- CC21 segurança: **4/4 PASS**, preservando suas três correções.
- Navegador Chromium, harness **compilado por Vite**, preview somente 127.0.0.1:
  **7/7 PASS**. XLS/BIFF5 CP1252, XLS/BIFF8, XLSX, CSV, erro/retry, headers perigosos,
  10000 linhas com heartbeat na UI e zero solicitações externas. Não foi testado
  contra frontend publicado/Supabase nem usado interceptador para fingir parser.
- Primeiro teste BIFF5 em browser identificou necessidade de codepage ESM; foi
  corrigida e o caso passou. Testes iniciais também corrigiram caminho de fixture
  no jsdom e transporte de acentos do gerador sintético; não foi ocultada falha
  de compatibilidade. Fixtures CP1252 são descritas em e2e/fixtures/finance-cc22-README.
- TypeScript, build e lint escopado: PASS. Lint global preexistente não foi
  corrigido fora do escopo, conforme regra CC21. Aviso de chunk >500 kB permanece.
- npm audit --omit=dev: **0** pacotes sinalizados. npm audit: **20**, todos apenas
  desenvolvimento (2 critical, 4 high, 11 moderate, 3 low), iguais aos residuais
  CC21. Não afirmar que 20 pacotes são 20 CVEs nem promover todos a risco do Pages
  estático. Diagnóstico da toolchain permanece no docs/44; revisão própria indicada.
- DOMPurify **3.4.17**, fast-uri **3.1.9**, Zod **4.6.6** preservados no lock.

## 6. Bundle, isolamento e limites da aprovação

Comparação dos arquivos JavaScript dist contra o build CC21:

- Antes: aproximadamente 3,29 MB; soma gzip 0,99 MB, 129 arquivos JS.
- Depois: aproximadamente 4,04 MB; soma gzip 1,26 MB, 130 arquivos JS.
- Delta aproximado: **+746 kB**, **+275 kB gzip** (soma por arquivo, não tráfego
  medido no CDN). Worker: aproximadamente 837 kB / 307 kB gzip. Valores exatos da
  rodada final em `artifacts/contracts-22/bundle-comparison.json`.
- Custo explícito do parsing fora da UI e das codepages legadas. Worker é estático
  e gerado pelo Vite; o precache PWA pode baixá-lo na instalação. Não foi escondido
  esse custo como se não houvesse aumento de bundle.

Somente correção autorizada do importador, dependência/vendor, testes e docs se
somam ao pacote CC21. Connect, Contratos, router, Edge, migrations e regras
financeiras abaixo do parsing permanecem iguais ao CC21. Workspace original e
checkout CC21 não foram sobrescritos. Nenhum acesso a EfetivaConnect.

Artefatos locais em `artifacts/contracts-22/`: distribuição/hash, metadados das
alternativas/advisories, auditorias npm, diff de dependências, logs de testes/build/
lint, browser-security.json, bundle-comparison.json, package-validation.json e
release-package.json/patch. O pacote candidato não inclui esses artefatos nem
segredos. O tarball vendor é distribuição de dependência autorizada, não artefato
de dados de clientes. Varredura estática de segredos não é prova contra todo
formato desconhecido; nenhum segredo privilegiado foi necessário nesta etapa.

## Relatório final

```text
EFETIVAOS_CLIENTES_CONTRATOS_22 = PASS_WITH_REVIEW
XLSX_USAGE_AUDIT = PASS
SELECTED_SOLUTION = SheetJS CE 0.20.3 oficial vendorizado + parser limitado em worker
XLSX_VULNERABILITY = RESOLVED (duas CVEs alvo)
IMPORTER_COMPATIBILITY = PASS
VALID_XLSX_IMPORT = PASS
MALICIOUS_FILE_HANDLING = PASS
FINANCIAL_DATA_INTEGRITY = PASS (regras/regressão local; sem acesso ou escrita remota)
DOMPURIFY_FIX_PRESERVED = YES
FAST_URI_FIX_PRESERVED = YES
ZOD_FIX_PRESERVED = YES
PRODUCTION_VULNERABILITIES = 0
DEVELOPMENT_VULNERABILITIES = 20 (pacotes sinalizados)
UNIT_TESTS = 868/868
SECURITY_TESTS = 40/40 unitários CC22 + 7/7 navegador + 4/4 CC21
TYPECHECK = PASS
BUILD = PASS
LINT_SCOPE = PASS
GIT_PACKAGE_ISOLATION = PASS
DATABASE_CHANGES = NO
COMMIT_PUSH = NO
DEPLOY_EXECUTED = NO
READY_FOR_FRONTEND_RELEASE_REVIEW = YES
```

PASS_WITH_REVIEW registra os alertas dev residuais, custo de bundle/limites e
ausência de validação remota nesta etapa; não reabre o bloqueio XLSX do CC21.
Próximo passo: revisar/aprovar o tree exato para publicação em gate autorizado,
reconfirmar backend e depois executar Pages/E2E produtivo com fixtures controladas.
Não publicar automaticamente nem executar testes de escrita remota como parte CC22.
