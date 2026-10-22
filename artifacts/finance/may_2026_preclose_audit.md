# FIN-IMPORT-6.3 — Auditoria final pré-fechamento de Maio/2026

## Status
**COMPLETED** — auditoria read-only concluída sem divergências bloqueadoras. Maio não foi fechado.

## Batch e fatos
- Batch: 9ca5ddfc-e2dc-40f5-b319-5430430e1ccd
- Manifest hash: a3d4440b0026625cdc6931b41f1ec864a2d079aed7fc24948c3b37709f588fef
- Fatos: **83/83**
- Chaves idempotentes únicas: **83**
- Fatos órfãos/fora do período/sem journal: **0/0/0**

## Journals
- Journals: **83/83**
- Linhas: **166/166**
- Desbalanceados: **0**
- Débitos/créditos: **R$ 133.761,78 / R$ 133.761,78**
- Diferença: **R$ 0,00**
- Linhas órfãs, zero-line, suspense/a classificar: **0**

## Caixa
- Abertura: **R$ 11.639,96**
- Entradas: **R$ 63.015,98**
- Saídas: **R$ 70.745,80**
- Fluxo líquido: **R$ -7.729,82**
- Fechamento: **R$ 3.910,14**
- Diferença: **R$ 0,00**

## DRE por account.dre_class
- Receita operacional: **R$ 46.707,68**
- Custos dos serviços: **R$ 17.859,78**
- Despesas operacionais: **R$ 33.590,37**
- Resultado: **R$ -4.742,47**

## DFC
- Operacional: **R$ -6.774,17**
- Investimento: **R$ 0,00**
- Financiamento: **R$ -955,65**
- Total: **R$ -7.729,82**

## Casos críticos
- Empréstimo Cora: fora da receita operacional; DRE NONE; financiamento.
- Amortização Cora: política legacy preservada; não retirada de sócio/transferência.
- Adiantamentos Rodrigo/Janderson: conta 1.1.02.003; DRE NONE.
- Valdilene: pró-labore, Diretoria/Sócios; não adiantamento.
- Endrew: duas parcelas de rescisão (rows 85/86); row 84 permanece o fato separado de FGTS/multa; nenhum terceiro journal de rescisão criado.
- Recupera: crédito antigo, sem nova receita e sem cliente fictício.
- Conecta Laudos: custo direto Engenharia/SST.
- Criffer: duas transações distintas.
- Cartão Caixa e parcelamentos: políticas legacy preservadas.

## Legacy policy
**10/10**, rows 62, 76, 90, 99, 100, 101, 102, 103, 111 e 182. Inventário comparado sem divergências.

## Continuidade e controles
- Abril: **locked**, 92 transações e 92 journals; alterado pelo import de Maio: **NO**.
- Maio: **sem lock**.
- AR/AP: nenhum título histórico artificial, cliente fictício ou fornecedor fictício criado. As contagens das views são projeções de transações liquidadas.
- PROD: **untouched**.

## Idempotência
Segunda execução retornou **batch already exists** antes de qualquer novo INSERT. Fatos, journals e linhas permaneceram 83/83/166, com o mesmo manifesto/hash.

## Git
HEAD e origin/main permanecem em c2c02a5aa0662c7512739f1ffe464b2a97ba8cf9. Não houve commit, push, staging ou migration/RPC/view/RLS change. Os artefatos de Maio continuam untracked junto dos arquivos preexistentes.

## Resultado
**BLOCKERS: NONE**

**READY_FOR_FIN_IMPORT_6_4: YES**

FIN-IMPORT-6.4 não foi executado e Maio não foi fechado.
