# FIN-IMPORT-7.3A — Auditoria de Classificação da DRE (Junho/2026)

**Status:** `COMPLETED_WITH_FINDINGS` — execução exclusivamente read-only.

`DRE_CLASSIFICATION_RECONCILIATION = PASS`  
`READY_FOR_DRE_CORRECTIVE_DECISION = YES`

## Escopo e segurança

- Projeto DEV: `bxviuzluxcijbqqbpyzb`; PROD não tocado.
- Batch auditado: `a6a093f4-9128-414a-bbe3-857d7128f072`.
- Nenhum INSERT, UPDATE, DELETE, reversal, replacement, migration, lock, commit ou push foi executado.
- Documentos `.docx` de referência estão presentes no repositório; o leitor de arquivos não interpreta binários, portanto foram considerados como arquivos-fonte existentes, sem inferir conteúdo ausente.

## Integridade confirmada

- Batch concluído: 1.
- Fatos/journals/linhas: 94/94/188.
- Débitos/créditos: R$ 159497.73 / R$ 159497.73.
- Junho unlocked; Abril e Maio locked.

## DRE persistida versus FIN-IMPORT-7.1

| Métrica | Persistida | Esperada 7.1 | Diferença |
|---|---:|---:|---:|
| Receita | R$ 64964.03 | R$ 64964.03 | R$ 0.00 |
| Custos | R$ 22675.82 | R$ 3802.62 | R$ 18873.20 |
| Despesas | R$ 22499.10 | R$ 41372.30 | R$ -18873.20 |
| Resultado | R$ 19789.11 | R$ 19789.11 | R$ 0,00 |

A regra oficial (`get_income_statement`) usa `account.dre_class`. O FIN-IMPORT-7.1 usa `dre_effect`/macro natureza da matriz; esses campos não são equivalentes automaticamente a `account.dre_class`.

## Prova dos R$ 18.873,20

Foram identificados **9 fatos** e **9 journals**, todos com conta atual `CUSTO_SERVICO` e classificação esperada 7.1 `DESPESA`. A soma é **R$ 18873.20**, sem residual.

| Conta | Conta atual | Fatos divergentes | Valor |
|---|---|---:|---:|
| 4.1.01.001 — ver matriz | CUSTO_SERVICO | 2 | R$ 1393.20 |
| 4.1.01.002 — Pagamento m├®dica Ana Paula | CUSTO_SERVICO | 1 | R$ 2500.00 |
| 4.1.01.003 — Pagamento Fono | CUSTO_SERVICO | 1 | R$ 480.00 |
| 4.1.01.007 — Aluguel Cl├¡nica | CUSTO_SERVICO | 1 | R$ 2500.00 |
| 4.4.01.001 — ver matriz | CUSTO_SERVICO | 4 | R$ 12000.00 |

A soma por conta divergente é: 4.1.01.001 = R$ 1.393,20; 4.1.01.002 = R$ 2.500,00; 4.1.01.003 = R$ 480,00; 4.1.01.007 = R$ 2.500,00; 4.4.01.001 = R$ 12.000,00. A conta 4.1.01.006 não diverge (R$ 175,62 esperado como CUSTO). A matriz detalhada e os fatos estão nos CSVs.

## Causa raiz

**Cenário C — confirmado.** A matriz 7.1 classificou como `DESPESA` fatos lançados em contas cujo cadastro oficial é `class=CUSTO` e `dre_class=CUSTO_SERVICO`. O mesmo account code aparece em Junho tanto com `dre_effect=CUSTO` quanto `dre_effect=DESPESA`, demonstrando que o conflito está no contrato de classificação, não no valor econômico.

- **Plano de contas:** não há evidência de erro estrutural; nomes, `class=CUSTO`, `dre_class=CUSTO_SERVICO` e uso em Janeiro–Maio são coerentes.
- **Mapeamento 7.1:** divergente da regra oficial para os 9 fatos afetados.
- **Journals:** não há erro de conta em relação à projeção 7.1; os journals preservam as contas projetadas e permanecem balanceados.
- **Erro econômico:** não identificado; resultado e valores dos fatos permanecem corretos.

## Plano de contas e uso histórico

As contas divergentes foram criadas pela seed `20260826000100_create_finance_foundation_schema.sql`, exceto `4.1.01.007`, criada por `20261015070000_add_operational_cost_accounts.sql`. Todas possuem atualmente `class=CUSTO`, `nature=DEBITO` e `dre_class=CUSTO_SERVICO`. A consulta histórica encontrou uso anterior a Junho em Janeiro–Maio para 4.1.01.001, 4.1.01.002, 4.1.01.003, 4.1.01.007 e 4.4.01.001; 4.1.01.006 não teve uso anterior identificado.

## Impacto retroativo hipotético

A simulação de trocar todas as contas divergentes de `CUSTO_SERVICO` para `DESPESA_OPERACIONAL` afeta nominalmente Janeiro, Fevereiro, Março, Abril e Maio, além de Junho. Em cada mês, o custo diminuiria pelo valor da conta e a despesa aumentaria pelo mesmo valor; o resultado líquido permaneceria inalterado. Portanto, alterar `dre_class` teria impacto retroativo em meses fechados e não deve ser feito sem decisão contábil explícita. Os valores por mês/conta estão em `june_2026_dre_retroactive_impact_v7_3a.csv`.

## Opções técnicas

1. **Manter `account.dre_class` (recomendado):** revisar o contrato do FIN-IMPORT-7.1 para derivar a DRE pela classificação oficial do plano de contas.
2. **Corrigir `account.dre_class`:** somente com comprovação contábil de cadastro incorreto e após aprovar o impacto retroativo em Janeiro–Maio.
3. **Reclassificação append-only:** somente se for formalmente decidido que os journals de Junho usaram contas incorretas; não foi executada.

## Artefatos

- `june_2026_dre_classification_audit_v7_3a.csv`
- `june_2026_dre_account_breakdown_v7_3a.csv`
- `june_2026_dre_affected_facts_v7_3a.csv`
- `june_2026_dre_retroactive_impact_v7_3a.csv`
- `june_2026_dre_classification_report_v7_3a.md`
- `june_2026_dre_classification_audit_v7_3a.json`
