# Julho/2026 — FIN-IMPORT-8.4 Preflight Final

## Status

FIN-IMPORT-8.4 = PASS
READY_FOR_FIN_IMPORT_8_5 = YES
READY_FOR_IMPORT = NO

Execução 100% read-only em DEV. Não houve importação, batch, journal real, lock, migration, criação de conta, commit, push ou acesso à PROD.

## Ambiente

- Project ref: bxviuzluxcijbqqbpyzb
- DEV: PASS
- PROD untouched: YES
- Transações Julho: 0
- Journals Julho: 0
- Batches Julho: 0
- Locks Julho: 0
- Junho locked: YES (c0ad6dad-5289-4564-bd76-6cf99b204051)

ENVIRONMENT_PRECHECK = PASS

## Integridade dos fatos

- Fatos: 115/115
- Cada fato uma vez: PASS
- Todos possuem status: PASS
- READY: 105
- READY_LEGACY_POLICY: 1
- READY_PROVISIONAL_CLASSIFICATION: 5
- READY_PROVISIONAL_ALLOCATION: 4
- DECISION_REQUIRED: 0

FACT_MATRIX_INTEGRITY = PASS

## Contas transitórias

PROVISIONAL_ACCOUNT_INTEGRITY = PASS

- 5.2.01.003 — Telefonia e Internet: FLX-2026-0616, FLX-2026-0617, FLX-2026-0634, FLX-2026-0651; total R$ 354,82.
- 2.1.05.001 — Cartoes de Credito a Pagar: FLX-2026-0621, FLX-2026-0652; total R$ 663,47.
- 5.6.01.001 — Material de Escritorio, Limpeza e Copa: FLX-2026-0628; total R$ 503,41.
- 1.1.02.005 — Outros Creditos: FLX-2026-0653; total R$ 3.100,00.
- 2.1.09.001 — Outras Obrigacoes a Pagar: FLX-2026-0659; total R$ 12.000,00.
- 2.1.06.001 — Emprestimos e Financiamentos - Curto Prazo: FLX-2026-0660, FLX-2026-0661; total R$ 18.752,65.

Não houve criação de conta.

## Caixa

- Opening Junho/Julho: R$ 7.021,13 / R$ 7.021,13
- Inflows: R$ 86.264,61
- Outflows: R$ 79.627,98
- Net change: R$ 6.636,63
- Closing: R$ 13.657,76
- Diferença: R$ 0,00

OPENING_CONTINUITY = PASS
CASH_RECONCILIATION = PASS

## DRE oficial

Base exclusiva: account.dre_class.

- Receita: R$ 65.264,61
- Custos: R$ 22.438,32
- Despesas: R$ 41.923,54
- Resultado: R$ 902,75
- Sem efeito DRE: R$ 36.266,12

A diferença em relação ao total auxiliar do 8.3 é explicada pelo adiantamento de Janderson de R$ 1.750,00: a conta patrimonial 1.1.02.003 possui dre_class vazio e, portanto, não entra na DRE oficial.

## DFC

- Operacional: R$ -847,25
- Investimento: R$ 0,00
- Financiamento: R$ -752,65
- Classificação pendente: R$ 8.236,53
- Total: R$ 6.636,63

DFC_RECONCILIATION = PASS

## Ledger projetado

- Journals: 115
- Lines: 230
- Débitos: R$ 165.892,59
- Créditos: R$ 165.892,59
- Diferença: R$ 0,00
- Desbalanceados: 0

PROJECTED_LEDGER_INTEGRITY = PASS

## Pendências documentais

Todos os registros futuros estão marcados como DOCUMENTATION_FOLLOWUP_REQUIRED e correção APPEND_ONLY. Nenhum fato provisório será atualizado destrutivamente.

A data técnica do material de cozinha é 31/07/2026; a data original 17/09/2026 foi preservada em metadata.

## Idempotência

- Proposed batch key: FIN-IMPORT-8.5-JULY-2026
- Manifest SHA-256: 1cb56b8942a54bde2a6c17aa35a569bcf876d09bc6c7e1b4abc474d975013862
- Batch criado: NO

## Status final

READY_FOR_FIN_IMPORT_8_5 = YES
READY_FOR_IMPORT = NO
