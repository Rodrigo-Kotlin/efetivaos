# CLIENTES-CONTRATOS-16 — Descarte autenticado e recuperável

## Escopo e autorização

2026-11-12. Homologação exclusiva: `xktbqykxmfuuzepfnjns`. O usuário confirmou
**backend local, sem deploy** quando esclarecida a incompatibilidade entre
publicar uma função e a restrição de deploy. Nenhum projeto atual/Connect foi
usado para operações de banco. Sem Docker, alteração financeira, commit/push,
deploy de frontend, função ou infraestrutura.

O backend é um handler Web Request/Response em
`supabase/functions/discard-client-contract-document/handler.ts`, hospedado
temporariamente em loopback pelo teste. Nenhuma função hospedada foi publicada.
O frontend chama `functions.invoke`; apenas no Playwright de homologação essa
requisição é encaminhada ao handler local real. Auth, SQL, RLS, Storage e RPCs
usam o Supabase remoto autorizado, não mocks.

Preflight: zero documentos, objetos e usuários; bucket privado `client-contracts`
com versionamento `DISABLED`. Vínculo do checkout publicado foi preservado;
todos os comandos usam workdir temporário conferido pelo helper `cc15-hml.mjs`.

## Causa raiz comprovada antes da correção

Evidência: `artifacts/contracts-16/root-cause.json`.

1. Equipe criou documento fictício pending, enviou PDF e marcou failed.
2. Sessão via RLS via o próprio documento (1 linha), mas não via o objeto Storage
   (0 linhas), pois SELECT Storage permite somente ready.
3. `storage.remove([path])` retornou `error=null`, **`data=[]`**.
4. A listagem administrativa ainda encontrou o objeto; download administrativo
   antes e depois teve o **mesmo SHA-256**. Não houve remoção neste retorno.
5. DELETE do próprio metadado removeu 1 linha e deixou o objeto presente, reproduzindo
   o órfão. Somente esse objeto fictício foi removido pela API administrativa.

Conclusão: o retorno de sucesso era um **no-op filtrado por autorização**, não
comprovante de remoção física nem confirmação de job de remoção. No fluxo antigo,
o frontend verificava apenas `error` e removia o registro em seguida.

Documentação consultada:
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/storage/management/delete-objects
- https://supabase.com/docs/guides/monitoring-and-debugging

Código público do Storage (`storage/object.ts`, `storage/uploader.ts`) também
mostra exclusão por subconjunto autorizado e etapas distintas entre metadados e
backend. É referência de implementação, não prova de que o deploy remoto executa
exatamente a mesma revisão. A prova deste ambiente é o teste real acima.

Advisories pré-migration foram salvos em `advisors-before.json`. Há avisos de
helpers históricos de pricing/perfis da baseline mínima do CC15; não foram
alterados neste gate. A CLI instalada não expõe o explorador `logs` da CLI v3;
foram usados catálogo, HTTP real, downloads, hashes e as evidências de testes.
Nenhum acesso ao MCP Connect foi realizado.

## Protocolo implementado

Não há promessa de transação única entre PostgreSQL e Storage.

1. Backend limita método/origem/tamanho/shape do JSON; aceita **somente**
   `contract_id` e `document_id`, sem bucket, path, actor ou token de operação.
2. Bearer é verificado em `Auth.getUser(jwt)`; sessão anônima é rejeitada. Actor
   deriva da resposta Auth, nunca de metadata editável nem do body HTTP.
3. RPC **service-only** revalida perfil ativo Admin/Equipe e autoria original,
   contrato/documento/caminho canônico. Admin não ganha permissão de descartar
   incompleto de outro criador. Arquivamento não impede limpar incompleto próprio
   de contrato existente; documento ready nunca pode ser reservado.
4. Sob lock de linha, marca `discard_started_at` e cria um tombstone durável
   `client_contract_document_discards`, com UUID de operação fixo e tentativa
   auditada em `client_contract_document_discard_attempts`.
5. Documento reservado não pode ser finalizado, marcado failed ou receber novo
   objeto. DELETE direto do registro é revogado; policy DELETE Storage deste
   bucket é removida. Não existe policy UPDATE/DELETE genérica nova.
6. Backend remove **somente o path derivado do banco**, pelo método suportado
   `Storage.remove` com chave server-side. Não executa DELETE SQL em storage.objects.
7. Confere ausência em listagem autenticada administrativa e GET autenticado sem
   cache, aceitando apenas erro explícito `statusCode=404`; 401/403/5xx e erros
   de transporte não viram confirmação de ausência.
8. RPC final exige a mesma operação/tentativa/ator e ausência de metadado Storage;
   só então remove o registro e marca tombstone `api_absent`, com timestamp.
9. Falhas mantêm o documento reservado, com tentativa/erro rastreável. Uma nova
   chamada idêntica autenticada retoma antes ou depois da remoção dos bytes/API.
   UUID/caminho descartado não pode ser reutilizado; duplicatas concorrentes são
   seguras porque sempre operam no mesmo destino congelado, sem novas versões.

Os locks seguem ordem documento → tombstone. Não se mantém transação PostgreSQL
aberta durante HTTP. A operação é idempotente e recuperável, **não atômica** entre
serviços. Não foi instalado cron/reconciliador automático; retomada é explícita
pelo endpoint e pelo botão da interface.

### Corrida com upload em andamento

Uma policy com `EXISTS` isolado não prova proteção contra upload autorizado antes
da reserva. Foram adicionados helper RLS com lock e trigger **no INSERT real de
metadados Storage**, limitado a `client-contracts`, cuja função reside em public.
Isso cobre também a escrita interna do Storage após probes de permissão que
podem usar savepoint/rollback. A criação desse trigger foi testada em transação
revertida antes da migration; nenhuma tabela/função gerenciada foi recriada.
Outros buckets retornam do trigger sem alteração.

Esta integração com tabela gerenciada deve ser revalidada em upgrades do Storage.
Um upload tardio rejeitado pode gerar limpeza interna assíncrona de sua versão
na plataforma; o app não tem acesso ao backend S3 para atestar eliminação desses
bytes internos. O tombstone impede reaparecimento de metadado/API naquele UUID.

## Migration e arquivos

Migration nova, gerada pelo CLI e aplicada **somente na homologação**:
`supabase/migrations/20261112134840_control_client_contract_document_discard.sql`.
Migrations anteriores preservadas. Ledger e SHA-256 em
`artifacts/contracts-16/migration.json`.

Objetos novos: coluna `discard_started_at`; tabelas discards/attempts com RLS
forçada; índices; helpers de autorização e guarda; RPCs begin/finish somente
service_role. Finalize e mark_failed preservam assinaturas e negam estado reservado.
Helpers/RPCs privilegiados com owner postgres, search_path vazio e revogações
explícitas de PUBLIC/anon/authenticated conforme função.

Frontend: compensação não faz DELETE de registro nem Storage pelo navegador;
usa o backend e valida confirmação. Resposta incerta de finalize não descarta um
possível ready. Falhas invalidam a listagem para exibir pendência e botão
`Descartar documento incompleto`/`Retomar descarte`, somente ao autor visível.
Service key jamais entra no bundle do frontend.

Arquivos de verificação:
- `scripts/test-client-contracts-16.mjs`
- `scripts/cc16-hml.mjs`, `scripts/cc16-backend-server.mjs`
- `supabase/tests/client_contracts_16_security.sql`
- `src/features/crm/api/document-discard-backend.test.ts`
- `playwright.cc16.config.ts`, `e2e/contracts-16.spec.ts`
- Regressão real do CC15 pelo spec existente, com encaminhamento local somente
  quando a variável de teste fixa `CC16_BACKEND_URL` está presente.

## Limites da comprovação

`storage_api_absent` significa: chamada de remoção executada sem erro,
metadado ausente, objeto não listado e GET autenticado explícito de não encontrado.
**Não significa** certificado de eliminação física no backend S3, apagamento de
backups internos ou invalidade instantânea de todo cache em toda região.
O handler devolve `physical_erasure_verified=false` deliberadamente.
Uma falha de verificação preserva registro e permite reconciliação, nunca retorna
sucesso só porque houve HTTP 200 no DELETE.

## Testes executados e evidências finais

- API/SQL real: **20/20** checks aprovados nas duas rodadas (40/40 execuções).
  Inclui Admin/Equipe, pending/failed com/sem objeto, autoria/contrato/path/bucket,
  anônimo/JWT inválido/inativo, grants das RPCs, preservação ready e hashes.
- Falhas injetadas somente no transporte do backend: DELETE Storage 503 e GET de
  verificação 403. Ambos preservaram documento, registraram erro e foram
  reconciliados por nova chamada autenticada real.
- Interrupções explícitas nas duas fronteiras: após reserva e após exclusão
  Storage antes do finish SQL; registros permaneceram recuperáveis.
- Concorrência real: finalize × descarte (5 tentativas por rodada), duas chamadas
  simultâneas de descarte, upload real em andamento × descarte (3 por rodada).
  Resultado observado: ready preservado OU descarte concluído, nunca ambos;
  nenhum metadado Storage órfão após as requisições terminarem. Não é prova
  formal de todas as intercalações nem de eliminação física de versões internas.
- Playwright final: **10/10**, desktop/mobile, com regressão de upload/download
  e interface de descarte de Admin/Equipe. Primeira rodada 9/10: último login
  falhou antes de enviar HTTP, com campos vazios no snapshot. O teste passou a
  conferir retenção dos valores após blur; nenhuma mudança na autenticação da
  aplicação nem redução de asserções de segurança. Histórico: 19/20 execuções.
- Unitários globais: **828/828**, 61 arquivos. Backend/compensação: 28 testes
  direcionados também passaram, já contidos no total global.
- `tsc -b` da aplicação e typecheck separado de backend/E2E/config: PASS.
- `npm run build`: PASS; aviso conhecido de chunk acima de 500 kB.
- ESLint dos arquivos deste gate: PASS. ESLint global: 62 erros/12 warnings em
  arquivos fora deste gate, preservados; resultado em `lint-global.json`.
- Advisories após migration: 24 avisos, incluindo o helper RLS
  `can_insert_client_contract_object` executável por authenticated de forma
  **intencional**, com Auth/active/owner e retorno booleano limitado. Nenhum dos
  helpers begin/finish/trigger foi exposto a anon/authenticated. Não é uma
  certificação de segurança de todos os helpers históricos da baseline mínima.

### Limpeza

Todas as contas fictícias tiveram sign-out administrativo tentado antes de
remoção; profiles ativos são revalidados no banco, não apenas no JWT. Foram
removidos somente paths/árvore do cliente desta rodada, incluindo tombstones e
tentativas **de teste**. Tombstones de uso real devem permanecer para impedir
reuso do UUID; não foi criado job de expurgo automático.

`postflight.json` confirma zero usuários, profiles, clientes, contratos,
documentos, eventos, objetos Storage, discards e attempts. Schema preservado:
9 migrations no ledger e trigger de guarda ativo. Hash da migration aplicada
confere com o arquivo local. Artefatos textuais foram sanitizados; scan final
encontrou zero senhas temporárias e zero referências ao helper privilegiado
begin-discard nos bundles de browser. Handler local encerrado após testes.

SHA-256 da migration:
`e756f3fac37ec316675e99d03bcae83f6df8d08bef0d63c4904f389dc59936b2`.

Branch `main`, HEAD `c999bae`. Working tree preexistente não foi descartado ou
revertido. Migrations anteriores, Financeiro e arquivos Connect não foram
alterados por este gate; nenhuma publicação Git ou Cloudflare foi executada.

## Relatório

```text
EFETIVAOS_CLIENTES_CONTRATOS_16 = PASS_WITH_REVIEW
HOMOLOGATION_PROJECT = xktbqykxmfuuzepfnjns
ROOT_CAUSE = SELECT RLS ocultava incompletos; remove retornava lote vazio sem erro; DELETE do registro permitia orfao.
DISCARD_IMPLEMENTATION = Backend local autenticado + reserva/tombstone + Storage API + verificacao de ausencia + finish SQL service-only + retries auditados.
PENDING_DISCARD = PASS
FAILED_DISCARD = PASS
PHYSICAL_OBJECT_REMOVAL = FAIL
ORPHAN_PREVENTION = PASS
RETRY_IDEMPOTENCY = PASS
CONCURRENCY_PROTECTION = PASS
READY_DOCUMENT_PROTECTION = PASS
RLS_SECURITY = PASS
STORAGE_SECURITY = PASS
RPC_SECURITY = PASS
E2E_TESTS = 10/10 (ultima rodada; historico 19/20)
UNIT_TESTS = 828/828
TYPECHECK = PASS
BUILD = PASS
TEST_DATA_CLEANUP = PASS
EFETIVAOS_CURRENT_DB_WRITES = NO
COMMIT_PUSH = NO
PRODUCTION_DEPLOY = NO
READY_FOR_PRODUCTION_MIGRATION_REVIEW = YES
```

**Interpretação obrigatória:** PHYSICAL_OBJECT_REMOVAL=FAIL significa **não
atestado no nível físico interno do provedor**, não uma falha dos testes de
remoção suportada pela API. Para separar os níveis:

```text
STORAGE_API_DELETE_REQUESTED = YES
STORAGE_METADATA_ABSENT = YES
AUTHENTICATED_STORAGE_API_INACCESSIBLE = YES
PHYSICAL_ERASURE_VERIFIED = NO
HOSTED_BACKEND_DEPLOYED = NO
```

PASS_WITH_REVIEW contempla esses limites e o backend local escolhido pelo usuário.
READY_FOR_PRODUCTION_MIGRATION_REVIEW libera **revisão do pacote**, não aplicação
no projeto publicado nem afirma validação de runtime hospedado. Antes de rollout:
autorizar publicação/validação do backend em gate separado, conferir compatibilidade
da integração Storage no destino, inventário atualizado e backup/restauração.
Nenhuma dessas próximas ações foi executada automaticamente.
