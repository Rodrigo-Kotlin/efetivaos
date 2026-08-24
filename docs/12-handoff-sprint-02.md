# Handoff — Sprint 2 / ETAPA 02

## ETAPA 02 — STATUS

COMPLETED_WITH_FINDINGS

## Escopo executado

- vertical de Cotacoes e Itens conectada ao Supabase DEV;
- rotas lazy de listagem, nova cotacao e detalhe;
- criacao e edicao de rascunho com multiplos itens e mapeamento ao Catalogo Efetiva;
- ativacao por checklist, cancelamento e historico somente leitura;
- estados persistidos `draft`, `active` e `cancelled`, com vencimento derivado em leitura;
- rascunhos excluidos da comparacao;
- nenhum comportamento de comparacao automatica ou da Sprint 3 implementado.

## Persistencia e concorrencia

- migration `20260823000300_add_save_quotation_draft_rpc.sql` aplicada no Supabase DEV;
- RPC final `save_quotation_draft` persiste cabecalho e itens atomicamente;
- contrato de concorrencia exige timestamp esperado e revisao `bigint` autoritativa;
- ciclo de vida protegido por CAS na aplicacao;
- alteracoes de itens tocam a revisao da cotacao pai;
- conflitos exigem recarga antes de novo salvamento, sem sobrescrita silenciosa.

## Anexos

- bucket privado preservado;
- formatos aceitos: PDF, JPEG, PNG e WEBP;
- limite de 10 MB;
- caminho canonico `<quotationId>/original`;
- envio usa estado pendente protegido por CAS e atualizacao compensatoria;
- falhas incompletas possuem recuperacao explicita por `discard_pending_quotation_attachment`;
- arquivo permanece apenas como evidencia; nenhum OCR/IA foi implementado.

## UI/UX

- listagem table-first no desktop e cards operacionais no mobile;
- busca, filtros e ordenacao;
- criacao e detalhe com itens inline;
- historico ativo/cancelado somente leitura;
- checklist de ativacao explicita requisitos pendentes;
- guards offline bloqueiam gravacoes transacionais;
- estados operacionais, teclado, foco, rotulos, feedback e responsividade validados.

## Banco/Supabase

- migration 003 aplicada no projeto DEV;
- salvamento de rascunho, revisao/CAS, ciclo de vida, itens e recuperacao de anexo validados remotamente;
- 155 testes SQL remotos aprovados em transacao com rollback;
- `supabase test db --linked` nao foi usado porque requer Docker para fornecer `pg_prove`, mesmo no modo linked;
- execucao remota sem Docker realizada por `supabase db query --linked --file`;
- harness TAP acumula resultados para visibilidade pela Management API;
- lint de banco aprovado;
- pos-flight confirmou zero fixtures e zero objetos persistidos.

## Testes

- `npm test`: 80 testes frontend aprovados;
- `npm run lint`: aprovado;
- `npm run build`: aprovado;
- SQL remoto: 155 testes aprovados com rollback;
- E2E: 3/3 cenarios aprovados em desktop e mobile;
- E2E cobriu login, upload e acesso por URL assinada privada.

## Bundle

- principal: 562,15 kB / 164,29 kB gzip;
- queries de cotacao: 9,59 kB / 3,18 kB gzip;
- listagem de cotacoes: 9,79 kB / 2,98 kB gzip;
- editor de cotacao: 30,81 kB / 8,68 kB gzip;
- aviso do Vite para chunk acima de 500 kB permanece nao bloqueante.

## Git

Branch: `main`

Commits tecnicos:

- `31b08ec feat: implement quotation lifecycle`;
- `6e83fb8 test: cover quotation workflows`.

## Deploy

- integracao: GitHub `main` -> Cloudflare Pages;
- URL: https://efetivaos.pages.dev;
- rotas publicadas: `/pricing/quotations`, `/pricing/quotations/new` e `/pricing/quotations/:quotationId`;
- identificacao e validacao do deployment final ficam registradas no relatorio de fechamento.

## Arquivos principais alterados

- migration 003 de persistencia atomica de rascunho;
- feature de cotacoes, rotas e contratos Supabase correspondentes;
- suites frontend, SQL remota e E2E da Sprint 2;
- documentacao de fechamento da Sprint 2.

## Decisões registradas

- `DEC-026`: persistencia atomica do rascunho com revisao/CAS e contrato tecnico de recuperacao de anexo pendente.

## Findings

- o chunk principal compartilhado mede 562,15 kB e permanece acima do aviso padrao de 500 kB do Vite; o aviso nao bloqueou build nem E2E;
- PostgreSQL e Storage nao compartilham uma transacao: estado pendente, CAS, compensacao e recuperacao explicita reduzem o risco, mas uma interrupcao durante recuperacao concorrente ainda pode deixar um objeto orfao para limpeza operacional;

## Próximo passo recomendado

ETAPA 03 — Comparação automática e menor custo vigente
