# FIN-IMPORT-7.2 — Preflight final de Junho/2026

## Status
**COMPLETED_WITH_FINDINGS — reconciliação read-only.** Não houve escrita no banco, batch, journal real, lock, migration, commit, push ou acesso PROD.

## FIN-IMPORT-7.1
- 94/94 fatos classificados; READY 84; READY_LEGACY_POLICY 10.
- Pendências, duplicidades, revisões de período e bloqueios: 0.

## Conta Cora
- Saldo inicial: **R$ 3.910,14**.
- Entradas: **R$ 81.304,36**.
- Saídas totais: **R$ 78.193,37**.
- Transferência interna Cora → NU: **R$ 12.000,00**.
- Saídas externas/econômicas: **R$ 66.193,37**.
- Saldo final da conta Cora: **R$ 7.021,13**.
- Variação Cora: **R$ 3.110,99**.
- `CORA_RECONCILIATION = PASS`.

Fórmula validada: `3910,14 + 81304,36 - 78193,37 = 7021,13`.

## Conta NU
- Conta contábil cadastrada no schema: **Banco Nubank — 1.1.01.003**.
- Saldo inicial NU: **UNKNOWN**.
- Entrada interna documentada: **R$ 12.000,00**.
- Outros movimentos NU em Junho: **não evidenciados nos artefatos disponíveis**.
- Saldo final NU: **NOT DETERMINED**.

Não foi inventado saldo da NU nem saldo consolidado final. A fonte e a projeção registram somente a transferência aprovada.

## Caixa consolidado e DFC
- Variação Cora: **R$ 3.110,99**.
- Transferência adicionada de volta para eliminar a movimentação entre contas: **R$ 12.000,00**.
- Variação consolidada: **R$ 15.110,99**.
- DFC operacional: **R$ 17.780,12**.
- DFC investimento: **R$ 0,00**.
- DFC financiamento: **R$ -2.669,13**.
- Variação DFC: **R$ 15.110,99**.
- Efeito da transferência na DFC consolidada: **R$ 0,00**.
- Diferença DFC × variação consolidada: **R$ 0,00**.
- `CONSOLIDATED_CASH_RECONCILIATION = PASS`.

O valor de R$ 7.021,13 é exclusivamente o **saldo final da conta Cora**, não o saldo consolidado da empresa.

## Projeção contábil
- Journals: **94**; journal lines: **188**.
- Débitos: **R$ 159.497,73**; créditos: **R$ 159.497,73**.
- Diferença: **R$ 0,00**; journals desbalanceados: **0**.
- Journal da transferência: débito NU R$ 12.000,00 / crédito Cora R$ 12.000,00; DRE NONE; DFC interna com efeito consolidado zero.

## Continuidade
- Maio closing Cora: **R$ 3.910,14**.
- Junho opening Cora: **R$ 3.910,14**.
- Diferença: **R$ 0,00**.
- `OPENING_CONTINUITY = PASS`.

## Limitações documentais
1. `NU_OPENING_BALANCE = UNKNOWN`.
2. `CONSOLIDATED_CLOSING_BALANCE = NOT DETERMINED`.
3. Não há extrato/saldo inicial da NU nem consulta persistida read-only do DEV nos artefatos locais.
4. A reconciliação da transferência, da variação consolidada e da DFC está aprovada dentro do escopo da fonte JUNHO e da projeção FIN-IMPORT-7.1.

## Readiness
Não há impeditivo material para o gate: a transferência está identificada, a variação consolidada está reconciliada, não há movimento NU adicional evidenciado ou contraditório, e o ledger permanece balanceado.

`READY_FOR_FIN_IMPORT_7_3 = YES`
