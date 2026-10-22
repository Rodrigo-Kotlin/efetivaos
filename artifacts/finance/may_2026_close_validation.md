# FIN-IMPORT-6.4 — Fechamento formal de Maio/2026

## Status
**COMPLETED** — lock formal criado em DEV; Maio não foi reimportado e Junho não foi iniciado.

## Lock
- ID: 3f3e1760-264f-441e-b6f8-f0fe2db97b9f
- Período: 2026-05-01 a 2026-05-31
- locked_by: 51000000-0000-0000-0000-000000000001
- locked_at: 2026-10-22T22:24:36.928409+00:00
- Lock único de Maio: **YES**

## Imutabilidade
**PASS** — a RPC de criação rejeitou fixture em 2026-05-15 pelo period lock; transação de teste não persistiu.

## Estado financeiro preservado
- Fatos/journals/lines: **83 / 83 / 166**
- Legacy policy: **10**
- Caixa: abertura R$ 11.639,96; entradas R$ 63.015,98; saídas R$ 70.745,80; fechamento R$ 3.910,14; diferença R$ 0,00
- DRE: receita R$ 46.707,68; custos R$ 17.859,78; despesas R$ 33.590,37; resultado R$ -4.742,47
- DFC: operacional R$ -6.774,17; investimento R$ 0,00; financiamento R$ -955,65; líquido R$ -7.729,82
- Ledger: débitos/créditos R$ 133.761,78 / R$ 133.761,78; diferença R$ 0,00

## Continuidade
- Abril: locked, 92 transações e 92 journals, inalterado.
- Junho: abertura esperada **R$ 3.910,14**; nenhuma importação realizada.
- PROD: untouched; writes/migrations: 0.

## Git
Artefatos de Maio serão versionados em commit local explícito. Push não será realizado neste gate.

**READY_FOR_JUNE_IMPORT: YES**
