# Clientes → Contratos — implantação controlada (CC18)

## Decisão vigente e limites

O proprietário dispensou expressamente backup e teste de restauração para este
release (ADR-CC18). **Não realizar backup, não exigir restore e não criar projetos.**
Esta versão substitui as condições de recuperação do plano CC17; os relatórios
anteriores permanecem históricos, não constituem novos bloqueios operacionais.

Preparar não é executar: migrations, configuração remota, deploy, commit e push
exigem autorização específica posterior. Destino atual: `bxviuzluxcijbqqbpyzb`;
homologação existente: `xktbqykxmfuuzepfnjns`; GitHub:
`Rodrigo-Kotlin/efetivaos`, branch produtiva `main`; frontend:
`https://efetivaos.pages.dev`. Não acessar projetos Connect nem alterar seus arquivos
ou o Financeiro. Não usar Docker nem fazer push de teste para main.

## Banco e escopo aprovado

Já aplicadas no atual, não reaplicar:
- `20261110000100_create_client_contracts.sql`;
- `20261110000200_fix_client_contract_storage_policies.sql`;
- `20261111000300_secure_client_contract_event_rpc.sql`.

Pendentes, nesta ordem:
1. `20261111000400_harden_client_contract_document_upload.sql`;
2. `20261112134840_control_client_contract_document_discard.sql`.

Manter os arquivos originais e seus hashes homologados. Não usar db push/reset/
seed global: a árvore local contém migrations não relacionadas. Não substituir
set_audit_fields: a versão atual tem tratamento financeiro que deve ser preservado.

Aplicação planejada das duas migrations em **um único lote transacional SQL**:
normalizar apenas BEGIN/COMMIT externos dos arquivos, manter os statements e
gravar ambas as versões no ledger dentro da mesma transação. Assim, o DELETE
temporariamente concedido pela primeira não fica exposto entre os dois commits.
Isto é atomicidade de DDL/DML PostgreSQL, **não** transação distribuída com Storage.

O lote preparado fica em `artifacts/contracts-18/production-migration-bundle.sql`,
acompanhado de manifesto/hash. É documento para revisão, não execução automática.
Se versões já estiverem aplicadas, não executar novamente: conferir objetos e
pular o lote; estado parcial/divergente exige replanejamento explícito.

Guards: três versões anteriores presentes; duas pendentes ausentes; bucket
privado PDF/10 MB com versionamento DISABLED; ausência de objetos/documentos
contratuais conforme o cenário revisado; enum/tabelas novos ausentes. Lock timeout
curto e transação revertida em erro. Novos dados ou drift desde a revisão interrompem
a execução antes de aplicar. Não apagar dados para satisfazer o guard.

Nenhuma migration executa remoção de bytes ou DELETE imediato de clientes/
contratos/documentos. O UPDATE da primeira é backfill de estado; DELETE da segunda
está somente no corpo da RPC de descarte autorizado. A guarda de INSERT Storage
retorna sem alteração para buckets diferentes de client-contracts.

## Backend separado do Pages

Hospedagem: Supabase Edge Function `discard-client-contract-document`, no mesmo
project-ref do banco. Pages publica o React; **não publica a função Supabase**.
Endpoint: `https://<ref>.supabase.co/functions/v1/discard-client-contract-document`.

Entrypoint index.ts e deno.json/lock estão no pacote; handler CC16 inalterado;
SDK exato 2.112.3. Gateway verify_jwt=true, mais Auth.getUser no backend e guards
SQL de usuário ativo/autor/contrato/estado. Begin/finish somente service_role.

SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são injetados pelo
runtime do projeto. Não criar env VITE com chave privilegiada nem enviá-la ao Pages.
Configuração adicional do destino atual:
`CONTRACT_DISCARD_ALLOWED_ORIGINS=https://efetivaos.pages.dev`.
Não aceitar wildcard ou previews arbitrários. No projeto atual, configuração e
publicação continuam etapas futuras autorizadas, conforme inventário CC18.
Na HML, o CC19 publicou e validou a função com origem única 127.0.0.1:4185;
isso não configura nem publica o backend no projeto atual.

Com autorização, a partir do checkout limpo do pacote e com alvo explícito:

```text
supabase secrets set --project-ref <REF_AUTORIZADO> CONTRACT_DISCARD_ALLOWED_ORIGINS=<ORIGEM_EXPLICITA>
supabase functions deploy discard-client-contract-document --project-ref <REF_AUTORIZADO> --use-api
```

Não usar --prune, deploy sem nome, config push ou comandos de funções Connect.
Não desabilitar JWT para contornar erro. Antes do frontend produtivo, confirmar
CORS/gateway/env/guards na função hospedada, sem o encaminhamento local do E2E.
O CC19 complementou o teste local do CC16 com o gateway hospedado real na HML,
com 19/19 checks e 4/4 E2E finais; ver docs/42. O destino atual ainda deve ser
validado após seu deploy autorizado. Falha mantém o frontend atual publicado e
os registros incompletos preservados.

## Pacote Git e integração Pages

Usar patch/tree aprovado em checkout limpo separado. Nunca reset/stash/discard do
trabalho local misturado. Tipos/decisões compartilhados entram somente em hunks
Contratos; router, Connect, Financeiro e connect-health permanecem iguais ao main.
Não incluir .env, artefatos, dumps, scripts financeiros ou migrations alheias.

Reconfirmar main/base e hashes imediatamente antes do commit. Se main avançar,
parar e regenerar/revalidar o pacote. Build do tree exportado, npm ci, TypeScript,
Deno e testes devem passar. Não publicar a árvore local inteira com git add global.

Produção Pages main e integração GitHub foram informadas pelo proprietário e o
commit-base tem check Cloudflare Pages verde. OAuth local Cloudflare expirado
impede inspeção administrativa por essa credencial, mas **não é necessário para
o deploy automático via push GitHub**. Não tratar isso sozinho como falha da
integração. Nenhuma mudança de build/env/branch Pages integra este release.

Antes de push, confirmar: npm run build, saída dist, Node >=22.12, variáveis
públicas do Supabase atual e ausência de service_role no bundle. Caso seja
necessário alterar configuração Pages, obter acesso/autorização próprios; não
afirmar que a API administrativa foi validada quando retornou 401.

## Sequência exata após aprovação

1. **Reconfirmar leitura:** projeto atual, ledger, hashes, guards de dados/Storage,
   main e pacote selecionado. Não incluir nenhuma operação de backup/restore.
2. **Conferir recibo HML CC19:** etapa hospedada já concluída para os hashes do
   recibo. Não repetir deploy/testes salvo alteração de código/configuração ou
   divergência; eventual repetição exige autorização e não cria/reseta projeto.
3. **Aplicar banco atual, com autorização específica:** executar o lote das duas
   migrations e ledger na mesma transação via SQL Editor/Management API do
   project-ref explícito. O lote preparado NÃO foi executado nesta etapa.
4. **Conferir banco:** versões, RLS, grants, RPCs, guarda de INSERT, bucket e
   clientes/outros buckets preservados. Nenhum DELETE direto deve ser reaberto.
5. **Configurar/publicar backend atual, com autorização específica:** CORS e deploy
   nominal --use-api no project-ref atual; validar gateway e env reais, códigos de
   erro e retry. Só avançar se a função responder corretamente e as negações
   forem comprovadas. Não fazer push antes desta validação.
6. **Commit/push, com autorização específica:** checkout limpo do pacote, diff/
   paths/hashes conferidos, commit somente Contratos e push fast-forward main.
7. **Pages:** acompanhar o check/deployment do SHA aprovado; exigir build bem-
   sucedido e assets da versão esperada. Não trocar por outro SHA nem fazer push
   adicional automático para tentar corrigir infraestrutura.
8. **Smoke e monitoramento autorizados:** clientes em leitura, rotas/contratos,
   PDF/finalização, descarte incompleto, ready protegido, anônimo/inativo e
   ausência de órfãos. Qualquer escrita de smoke deve ter fixtures/IDs e teardown
   previamente aprovados; não destruir documentos existentes para limpar teste.

## Contingência sem restauração

- **Antes do commit SQL:** erro, lock ou timeout reverte a transação e as duas
  versões; confirmar estado real, não repetir cegamente.
- **Depois do commit SQL:** manter schemas/guards seguros e corrigir forward.
  Não remover colunas/tipos/tombstones nem restabelecer policies vulneráveis.
- **Backend indisponível:** não publicar frontend novo; após publicação, suspender
  operações contratuais e reimplantar código aprovado quando autorizado. Reserva
  durável permite retry; um 401/403/5xx não é confirmação de ausência de objeto.
- **Frontend/Pages falhou:** conservar o deployment anterior se o build falhou;
  quando necessário e autorizado, reverter somente o commit Contratos em checkout
  separado e fazer push para o mesmo fluxo GitHub/Pages. Isso não depende de
  OAuth local Cloudflare. Nunca force-push nem reverta trabalho Connect/Financeiro.
- **Integração GitHub indisponível:** parar e restabelecer acesso autorizado;
  rollback de código não deve ser declarado concluído sem deployment verde.
- **Dados já excluídos:** rollback de código/schema não os recupera. Sem cópia
  disponível, não prometer recomposição de bytes ou histórico. Preservar auditoria,
  registrar incidente e limitar a correção ao que é demonstrável/autorizado.

Monitorar: 5xx da função, reservas antigas, last_error, attempts retry_required,
falhas de finalize e divergência documento↔Storage. Logs não devem conter bearer,
chaves, bytes ou dados de clientes. Não há expurgo automático de tombstones.
