# CLEANUP-02 — quarentena de operações legadas

Esta pasta contém **metadados**, não SQL de provisionamento nem payload para execução.
Base: `9761f7419a201dfe1def1d209d7d27272b5038e8`.

## Entradas aposentadas

- `supabase/scripts/reset_operational_data.sql`: somente um `DO` que levanta
  erro `42501`; todo o corpo original está dentro de comentário de bloco.
  Mesmo um cliente que continue após erros não encontra DML posterior ativo.
- `scripts/finance/run-march-2026-runtime-test.mjs`: somente import de política
  e chamada incondicional de negação. O corpo original está comentado.
  Não gera arquivo SQL, não lê manifest e não invoca CLI/Supabase.

Não reativar removendo comentários. Não existe flag `force`/produção permitida.
Até uma declaração válida de ambiente descartável termina em negação. Qualquer
operação futura exige novo gate e implementação própria revisada, não restauração
dessas rotinas. O Git e os comentários preservam a proveniência; SHA-256 do
conteúdo original e das migrations constam de `legacy-operations.json`.

## Migrations imutáveis — não reaplicar

Os arquivos históricos `20260828000110_financial_dashboard_tests.sql` e
`20260828000300_08b2_lancamentos_tests.sql` permanecem **byte a byte intactos** no
diretório de migrations. Não excluir, editar, renomear, marcar como aplicada sem
execução, reparar o ledger ou filtrar silenciosamente esses arquivos.

`npm run safety:provisioning` é um **preflight offline**, não um provisionador.
Não abre conexão, não chama CLI e não executa SQL. Ele:

1. nega CI (até `CI=false`), ausência de destino explícito e produção;
2. exige `EFETIVAOS_TARGET_PROJECT_REF` e URL exata em
   `EFETIVAOS_TARGET_SUPABASE_URL`, sem fallback para `--linked`;
3. recusa seletores/URLs herdados divergentes;
4. exige `EFETIVAOS_DISPOSABLE_CONFIRMATION=DISPOSABLE:<Project Ref>`;
5. examina a árvore de migrations desta cópia, sem seguir links;
6. recusa as migrations em quarentena por nome **ou** fingerprint do conteúdo,
   incluindo cópias renomeadas com CRLF/BOM.

A árvore completa atual é bloqueada mesmo com declaração descartável válida.
Nenhuma declaração comprova que um banco remoto seja descartável; uma inspeção
de conteúdo aprovada também **não concede autorização** de conexão/aplicação.
Não há adaptador de execução nem lista de exclusões que permita executar o
restante. Um futuro fluxo de provisionamento precisa consumir este bloqueio e
ser revisado antes de ganhar qualquer capacidade mutante.

## Limites que não podem ser omitidos

O preflight **não intercepta** `supabase db push/reset`, `psql -f`, painel SQL,
Management API, comandos personalizados ou uma cópia antiga no workspace
preservado. As migrations intactas continuam diretamente executáveis por quem
tem acesso ao banco. Fingerprints identificam cópias exatas/normalizadas, não
qualquer reescrita deliberada de SQL equivalente.

Logo, não é uma proteção global de banco nem revogação de credenciais. Não foi
executado SQL para testar o bloqueio. Não declarar reprovisionamento liberado ou
todos os caminhos destrutivos controlados. Os testes offline verificam política,
quarentena e plano; **não executam as entradas legadas**.

## Verificação offline

`npm run test:safety` usa Node Test Runner e módulos nativos, sem conexão ou
credenciais. Não confundir esse comando com `npm run test:e2e`: a suíte E2E
publicada tem acesso real à homologação e continua sujeita a gate separado.

## Fingerprints e quebras de linha

Os hashes registrados são **normalizados**: SHA-256 sobre o conteúdo UTF-8 com
BOM inicial removido e quebras CRLF/CR convertidas em LF. O motivo é prático e
de segurança: o repositório é lido com quebras de linha diferentes conforme a
plataforma e `core.autocrlf`. Um hash sobre bytes crus só reconheceria a
sequência exata de um checkout, e uma cópia renomeada de uma migration em
quarentena poderia escapar da detecção em outro checkout. A normalização faz o
fingerprint descrever o **conteúdo**, não o checkout. O mesmo vale para o
SHA-256 do corpo original arquivado nas duas entradas legadas.
