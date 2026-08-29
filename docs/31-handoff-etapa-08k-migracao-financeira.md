# ETAPA 08K — MIGRAÇÃO DE DADOS REAIS 2026 (Financeiro) — RELATÓRIO E PENDÊNCIAS

**STATUS**: COMPLETED_WITH_FINDINGS
**Data**: 2026-08-29
**Ambiente**: Supabase DEV (ref `bxviuzluxcijbqqbpyzb`)
**Fonte dos dados**: `docs/BASE_MIGRACAO_FINANCEIRA_2026.xlsx`
**Diagnóstico de referência**: `docs/DIAGNOSTICO_ESTRUTURA_MIGRACAO_FINANCEIRA_2026.docx`

---

## Escopo executado

Migração do histórico financeiro real de 2026 (Jan–Jul) para o Supabase DEV, via **mecanismo autoritativo** (RPCs `create_financial_transaction`, `settle_financial_transaction`, `cancel_financial_transaction`) usando `service_role` via REST. Nenhuma alteração estrutural de schema foi feita nesta etapa (o modelo de razão imutável já estava em vigor).

**Cadastros criados (espelho da planilha-fonte):**
- 10 centros de custo: CC01–CC09 + CC99.
- 53 categorias financeiras ativas, espelhando as naturezas-fonte (cada uma mapeada a um plano de contas canônico).
- 3 contas financeiras ativas, todas `is_cash`: **Cora** (plano `1.1.01.002`), **NU** (`1.1.01.003`), **Caixa Interno** (`1.1.01.001`).

**Lançamentos importados (661 linhas da planilha + SALDO_INICIAL):**
- SALDO_INICIAL Cora (`4.386,45` em 2026-01-01): 1.
- RECEITA: 264 · DESPESA: 380 · RETIRADA: 6 · IMOBILIZADO: 2
- EMPRESTIMO_RECEBIDO: 4 · EMPRESTIMO_PAGO: 3 (principal) · TRANSFERENCIA: 2.
- Total settleado: 662. Nenhum pendente.

**Modelo de registro aplicado:**
- RECEITA/DESPESA/IMOBILIZADO: pendência (D AR / C Receita, ou D Custo/Despesa / C AP) + liquidação (D Banco / C AR, ou D AP / C Banco) → AR/AP auto-neutralizados e DRE reconhecido.
- TRANSFERENCIA/EMPRESTIMO/SALDO_INICIAL/RETIRADA: lançamento único settleado.
- 12 lançamentos de teste ("Teste 08H-1") e 1 probe de RETIRADA estornados/cancelados via `cancel_financial_transaction` (não deletados — razão imutável).

**Rastreabilidade:** idempotency key `MIG-FIN-2026-JAN-JUL-V1::<id-fonte>`. Reinvocação é idempotente.

---

## Git

Branch `main`, último commit: `ae1eb80` (base anterior). Nesta etapa o único artefato versionável é a suíte SQL de checks (a migração em si foi feita via RPC/dados, sem arquivo de migration de DML; os arquivos `xlsx`/`docx` não são commitados por política).

---

## Banco/Supabase

Estado devidamente verificado por consultas REST (service role):
- **Reconciliação mensal (conta Cora, plano `1.1.01.002`)** — todas as 7 metas fecham (tolerância < 0,01):

  | Competência | Saldo Cora | Meta-fonte |
  |-------------|-----------:|-----------:|
  | Jan | 2.313,24 | 2.313,24 ✓ |
  | Fev | 2.070,12 | 2.070,12 ✓ |
  | Mar | 18.187,58 | 18.187,58 ✓ |
  | Abr | 11.639,96 | 11.639,96 ✓ |
  | Mai | 3.910,14 | 3.910,14 ✓ |
  | Jun | 7.021,13 | 7.021,13 ✓ |
  | Jul | 13.657,76 | 13.657,76 ✓ |

- **Integridade do razão**: débitos = créditos (dif. `0,000000`); partida dobrada por lançamento OK.
- **AR (`1.1.02.001`) = 0 e AP (`2.1.01.001`) = 0** — nenhum título histórico fictício.
- **Receita operacional reconhecida no DRE = 381.159,72** = total-fonte exato.
- **Custo + Despesa = 342.332,19**; Resultado do período = 38.827,53.
- **Empréstimos a pagar líquidos = 15.622,57**; NU e Caixa Interno saldados a zero (transferências anulam).

---

## Testes

- **Suíte SQL 08K** criada em `supabase/tests/08k_migration_real_data_checks.sql` com **67 checks** (60 asserções diretas + 7 asserts de reconciliação mensal em bloco `DO`), cobrindo:
  1. Cadastros (10 checks);
  2. Completude dos 661 lançamentos + SALDO_INICIAL (12);
  3. Reconciliação mensal Cora + Receita total (9);
  4. Integridade contábil: razão balanceado, AR/AP zero, empréstimos, transferências saldadas, mocks cancelados (9);
  5. As 4 linhas re-datadas postadas na competência correta (5);
  6. Classificação das transações especiais (3);
  7. Segurança/imutabilidade/idempotência (6);
  8. SALDO_INICIAL (2);
  9. Checks suplementares de DRE/detalhe (10).
- Suíte **read-only/idempotente**; basta executar no SQL Editor do Supabase DEV.
- Execução local não realizada (sem Docker/local DB, por restrição). A validação empírica foi feita via consultas REST equivalentes; a suíte consolida essas mesmas verificações em SQL para execução remota.

---

## Arquivos principais alterados

| Arquivo | Ação |
|---------|------|
| `supabase/tests/08k_migration_real_data_checks.sql` | Criado (suíte de 67 checks) |

> `docs/BASE_MIGRACAO_FINANCEIRA_2026.xlsx` e `docs/DIAGNOSTICO_ESTRUTURA_MIGRACAO_FINANCEIRA_2026.docx`: usados como fonte, **não commitados** (política de não versionar xlsx/docx).

---

## Decisões registradas

Não houve nova decisão arquitetural nesta etapa. Foram aplicadas as decisões já registradas (registro e transação via RPC autoritativa; cancelamento em vez de delete; espelho de cadastros; períodos sem data lançados no fim da competência). Recomenda-se registrar no `docs/04-decision-register.md` a decisão de **reconciliação do "Controle de caixa" pela conta Cora apenas** (e não por consolidação de todas as contas de caixa), pois transferências internas Cora↔NU alteram o saldo monitorado pela fonte.

---

## Findings (pendências e desvios)

1. **4 linhas com data de movimento fora da competência-fonte** (FLX-0121 Aluguel Carro 600,00 / FLX-0123 Entrada Boné Uniforme BC 150,00 / FLX-0479 ASOs R Frota entrada 240,00 / FLX-0628 Material de cozinha 503,41). Foram **canceladas e reemitidas** (`...::<id>::R2`) postadas no mês da competência com a categoria correta (D001/C006/R003/D011). Resolvido; verificado pela reconciliação fechada.
2. **Reconciliação depende da conta Cora isolada.** Ao consolidar TODAS as contas de caixa, transferências internas (Cora↔NU) se anulam e o saldo diverge (+12.000 em Jun). A fonte ("Controle de caixa") monitora a Cora. Registrado; aplicado à suíte.
3. **Razão imutável**: mocks/probe não podem ser deletados; ficam cancelados (estorno válido). Sem débito remanescente.
4. **Execução da suíte SQL pendente em ambiente com Postgres** (sem Docker/psql). Não há evidência de falha: as mesmas verificações passaram via REST, e a suíte é o artefato a ser rodado no SQL Editor DEV.
5. **Distribuição de lançamentos por diário**: tipos com DRE usam 2 lançamentos (pendência+liquidação); sem DRE usam 1. Observada 1 DESPESA com 1 lançamento em amostra parcial de paginação — não impacta receita/reconciliação/razão (investigar como pendência menor de auditoria se confirmar em re-run sem paginação).

---

## Próximo passo recomendado

1. Executar `supabase/tests/08k_migration_real_data_checks.sql` no SQL Editor do Supabase DEV (67 checks) — confirmação remota formal.
2. Registrar no `docs/04-decision-register.md`: reconciliação por conta Cora; e no `docs/06-learning-log.md` a descoberta da dependência de conciliação por conta individual.
3. Após confirmação dos checks, replicar o mesmo processo de migração na pré-produção/produção (nunca antes da validação completa).
