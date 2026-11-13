# CLIENTES-CONTRATOS-19 — Edge Function hospedada na homologação

## Escopo executado

Data: 2026-11-12. Exclusivamente `xktbqykxmfuuzepfnjns`.
Nenhuma operação no projeto atual, nenhuma migration, Git commit/push, publicação
Pages, criação de projeto/serviço pago ou backup. A dispensa da ADR-CC18 continua
vigente. Schema HML previamente homologado foi preservado.

Função: `discard-client-contract-document`.
Endpoint real:
`https://xktbqykxmfuuzepfnjns.supabase.co/functions/v1/discard-client-contract-document`.

Preflight HML: zero usuários, clientes, documentos e objetos; nove migrations,
incluindo upload/descarte; bucket privado e versionamento DISABLED.

## Publicação autorizada, sem Docker

Origem HML configurada: **somente `http://127.0.0.1:4185`**.
Não foi liberado wildcard, localhost alternativo, origem opaca null, domínio
produtivo ou domínio de terceiros. A origem corresponde ao frontend local usado
na homologação, não é permissão de acesso ao banco por si só.

Executados com project-ref HML explícito:

```text
supabase secrets set --project-ref xktbqykxmfuuzepfnjns CONTRACT_DISCARD_ALLOWED_ORIGINS=http://127.0.0.1:4185
supabase functions deploy discard-client-contract-document --project-ref xktbqykxmfuuzepfnjns --use-api
```

Deploy nominal a partir do export limpo CC18, sem --prune/deploy global. CLI
confirmou destino HML e somente essa função. verify_jwt permanece true. Não foi
necessário alterar o handler nem desativar o gateway JWT.

Inputs e hashes: `artifacts/contracts-19/deployment-source.json`. Metadata:
`deployment.json`. Os hashes dos arquivos publicados correspondem ao pacote CC18.
Esse recibo identifica os inputs do deploy; não se apresenta como atestação
criptográfica do bundle interno produzido pela plataforma.

## Autenticação, autorização e credenciais

- Gateway JWT ativo; teste de token inválido antes de qualquer ação.
- Auth.getUser verifica o bearer no Auth; apikey isolada/anon JWT não autentica
  usuário real para descarte.
- SQL revalida perfil ativo/role, autoria, contrato, estado e caminho canônico.
- Admin/Equipe descartam somente incompletos próprios; Admin não ganha override
  sobre documento de outro criador. Outro contrato/path/bucket/actor forjado é negado.
- Begin/finish permanecem service-only; RLS/grants/owners/search_path conferidos.
- Chave privilegiada somente no runtime hospedado e no tooling Node confiável
  de fixtures. Nunca incluída em VITE, browser, resposta HTTP, relatório ou Git.
  O frontend usa chave pública e JWT do usuário. Defaults SUPABASE_* injetados
  pela plataforma funcionaram sem copiar credenciais entre projetos.

## CORS, headers e métodos

OPTIONS sem bearer foi exercitado como preflight real. Resposta válida 204, origem
exata, métodos POST/OPTIONS e headers authorization/apikey/content-type/x-client-info.
Headers extras e DELETE não aparecem nas permissões anunciadas. GET/PUT/PATCH/
DELETE autenticados são negados por 405, sem mutação.

Origem não configurada recebe 403 sem ACAO. CORS não substitui Auth/RLS: chamadas
server-side sem Origin ainda exigem JWT de usuário e autorização SQL.

A primeira rodada teve uma asserção de teste incorreta: exigia Vary exatamente
Origin. O gateway adiciona Accept-Encoding; o valor real era
`Accept-Encoding, Origin`, correto pela semântica HTTP. O teste foi corrigido
para exigir o token Origin, mantendo igualdade estrita da origem permitida e
lista limitada de métodos/headers. **Nenhuma policy/handler foi relaxada**.
Respostas de sucesso têm Cache-Control no-store.

## Testes reais e prova de remoção

`scripts/test-client-contracts-19.mjs` usa o endpoint HTTPS hospedado. Não importa
o handler nem inicia backend local. Faz requests Auth/SQL/Storage reais, sessões
Admin/duas Equipes/inativo e chamadas sem autenticação, duplicatas, concorrência,
interrupção e retomada. Não aplica migrations.

`playwright.cc19.config.ts` / `e2e/contracts-19.spec.ts` usam frontend React local
e função hospedada real. Não há route.fetch/fulfill, proxy de descarte ou mock de
CORS; requests continuam para seu URL original. O guard de tráfego bloqueia
qualquer outro hostname Supabase. Chromium desktop/mobile verifica Admin/Equipe,
pending/failed removidos e ready preservado.

Sucesso exige mais que HTTP 200: JSON confirma storage_api_absent; registro SQL
removido; storage.objects sem metadado; listagem administrativa ausente; GET
autenticado devolve statusCode 404; tombstone api_absent com timestamp. Ready
mantém registro e hash dos bytes. Eliminação física interna do provedor continua
não atestada, e physical_erasure_verified=false é intencional.

Limpeza remove somente árvore do cliente e paths/IDs fictícios da rodada, com
sign-out/deleção das contas e conferência global de resíduos HML. Função e CORS
ficam configurados; schema é preservado. Não foi aberto DELETE para usuários nem
executado DELETE SQL em storage.objects.

Evidências: `runtime.json`, `playwright.json`, `postflight.json`, snapshots de
rodadas anteriores e metadata em `artifacts/contracts-19/`. Artefatos textuais
são sanitizados antes de encerrar.

## Procedimento posterior no projeto atual — NÃO executado

1. Obter autorização específica para banco/backend/Git e reconfirmar em leitura
   `bxviuzluxcijbqqbpyzb`, main/base, ledger, inventário e hashes. Backup permanece
   dispensado; não criar projeto ou iniciar recuperação como condição.
2. Aplicar somente `20261111000400` → `20261112134840`, com ledger na mesma
   transação, pelo lote revisado
   `artifacts/contracts-18/production-migration-bundle.sql`. Não reaplicar as três
   anteriores. Guard divergente/aplicação prévia exige leitura/replanejamento,
   nunca apagar dados ou executar db push/reset global.
3. Conferir versões, RLS/grants, RPCs, trigger, bucket e clientes/outros módulos
   preservados. Em erro SQL, rollback transacional; resposta de rede incerta
   exige conferir commit real antes de repetir. Não reabrir policies inseguras.
4. Do checkout limpo aprovado, com autorização, configurar/publicar **somente**:

   ```text
   supabase secrets set --project-ref bxviuzluxcijbqqbpyzb CONTRACT_DISCARD_ALLOWED_ORIGINS=https://efetivaos.pages.dev
   supabase functions deploy discard-client-contract-document --project-ref bxviuzluxcijbqqbpyzb --use-api
   ```

   As chaves do projeto atual são injetadas pelo runtime; não copiar keys da HML.
   Não usar --no-verify-jwt, --prune, deploy global, config push ou secret no Pages.
5. Validar gateway, origem produtiva, autenticação/autorização, ready e descarte
   recuperável no destino, com smoke/fixtures expressamente autorizados e teardown
   por IDs. Só então aprovar commit e push main do pacote Contratos isolado.
6. Acompanhar deployment Pages do SHA aprovado, conferir assets/rotas/ambiente e
   executar smoke autorizado. Monitorar 5xx, órfãos e reservas antigas.
7. Falha mantém frontend anterior; depois de publicar, contingência é suspensão,
   correção forward ou reversão de código autorizada. Não prometer recuperar
   bytes excluídos, restaurar automaticamente ou desfazer controles de segurança.

## Resultado final e limpeza

Função ID `87e0d537-6aca-4a62-aef3-e4d1aa3c6fe6`, versão **1**, status **ACTIVE**,
verify_jwt=true. Código de backend não precisou de correção/redeploy; só a asserção
do teste Vary foi ajustada à semântica de lista de headers.

- Rodada final: **19/19 checks hospedados** aprovados, zero falhas/retries de
  transporte nesta rodada e **4/4 E2E** (Chromium, 1440 e 390 px, Admin/Equipe).
- Histórico E2E: **12/12 execuções** aprovadas nas três rodadas, sempre sem proxy.
- Primeira rodada API/SQL: 17/18, com a asserção Vary excessivamente estrita.
- Segunda: 18/19, com timeout de transporte em uma rejeição de origem, sem
  resposta/status e sem documento criado nesse caso. A causa de infraestrutura
  não foi atribuída ao handler sem evidência.
- Rechecagem limitada a uma tentativa extra somente para erro de transporte na
  matriz de rejeição sem documentos existentes. Nenhuma resposta HTTP inesperada
  ou falha de autorização foi ignorada/repetida automaticamente; chamadas reais
  de descarte não receberam esse mecanismo. A rodada final não usou retries.
- Não houve ampliação de CORS, desativação de JWT ou alteração de policies para
  fazer o teste passar. Handler e migrations continuam com os hashes aprovados.

Pós-flight final: **zero** usuários Auth, profiles, clientes, contratos,
documentos, eventos, objetos Storage, discards, attempts e objetos contratuais
órfãos. Cleanup administrativo tocou somente IDs/paths fictícios registrados,
inclusive ready de teste, não documentos existentes. Função/CORS permanecem na
HML; não foi alterado o schema homologado.

Typecheck dos novos testes/config e ESLint escopado aprovados. Recibos, fonte e
testes hospedados integram o pacote de release preparado; os resultados não
equivalem a deploy/validação produtiva. O manifesto final fica em
`artifacts/contracts-19/release-package.json`, fora do commit.

**Review remanescente, não bloqueante:** monitorar timeouts/transporte durante a
janela de liberação. Também não se certifica eliminação física interna de bytes,
versões/caches do provedor; o nível confirmado é ausência de metadado/API e
registro removido com auditoria, preservando a declaração physical_erasure_verified=false.

```text
EFETIVAOS_CLIENTES_CONTRATOS_19 = PASS_WITH_REVIEW
HOMOLOGATION_EDGE_FUNCTION = DEPLOYED
CORS_VALIDATION = PASS
AUTHENTICATION = PASS
AUTHORIZATION = PASS
PENDING_DISCARD = PASS
FAILED_DISCARD = PASS
READY_PROTECTION = PASS
ORPHAN_PREVENTION = PASS
TEST_DATA_CLEANUP = PASS
PRODUCTION_WRITES = NO
PRODUCTION_DEPLOY = NO
COMMIT_PUSH = NO
READY_FOR_FINAL_RELEASE = YES
```

YES significa prontidão técnica para a sequência produtiva **depois de nova
autorização específica**, nunca permissão implícita para executar banco/backend/
main. Backup segue dispensado, sem operação ou nova exigência neste gate.
