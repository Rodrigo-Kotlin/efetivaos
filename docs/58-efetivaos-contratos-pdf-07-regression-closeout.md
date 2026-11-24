# EFETIVAOS-CONTRATOS-PDF-07 — Fechamento da regressão

Data: 2026-11-24  
Worktree: `D:\PWA PROJETOS\efetivaos-pdf-05-recovery`  
Branch: `recovery/efetivaos-contratos-pdf-05`

## Resultado

```text
EFETIVAOS_CONTRATOS_PDF_07 = PASS_WITH_REVIEW
FAILED_TESTS_DIAGNOSED = YES
BASELINE_COMPARISON = REVIEW
PDF_REGRESSION = NO
VISUAL_EVIDENCE = 5/5
VISUAL_ZIP = D:\PWA PROJETOS\efetivaos-pdf-05-recovery\artifacts\contracts-pdf-07-visual-review.zip
HUMAN_VISUAL_APPROVAL = PENDING
COMMITS_PRESERVED = YES
GIT_PUSH = NO
DEPLOY_EXECUTED = NO
READY_FOR_RELEASE_REVIEW = YES
```

## Falhas inicialmente observadas

Na execução geral anterior foram observadas cinco falhas:

1. `src/app/router.test.tsx` — redirecionamento `/connect` para Admin;
2. `src/app/router.test.tsx` — detalhe de cliente/Contratos para Admin;
3. `src/app/router.test.tsx` — detalhe de cliente/Contratos para Equipe,
   com timeout de 5 segundos;
4. `src/app/router.test.tsx` — rota canônica `/finance/dfc`;
5. `src/features/auth/login-page.test.tsx` — botão Entrar permaneceu
   desabilitado.

Não houve alteração ou desabilitação desses testes.

## Execução controlada

Os quatro testes de rota foram executados individualmente com um worker:

```text
connect-admin    PASS
client-admin     PASS
client-equipe    PASS
dfc              PASS
```

O teste de login falhou individualmente com a mensagem:

```text
expect(element).toBeEnabled()
Received element is not enabled
```

O grupo `router.test.tsx` + `login-page.test.tsx`, com um worker, produziu:

```text
router.test.tsx       21/21 PASS
login-page.test.tsx    0/1 FAIL
```

O login também falhou individualmente e em grupo no worktree limpo do
commit-base. A causa observável é o estado inicial do próprio `LoginPage`: o
teste não interage com os campos e exige imediatamente que o botão esteja
habilitado.

## Comparação com o baseline

Foi criado um worktree descartável separado em:

```text
D:\PWA PROJETOS\efetivaos-pdf-07-baseline
```

Base: `32eed5a1c396e162ced7c3df38066b7d93b48d69`.

Resultados equivalentes:

```text
Baseline login individual: FAIL — botão Entrar desabilitado
Baseline router + login, 1 worker: router PASS; login FAIL
Baseline suíte geral: 893/894, somente login FAIL
Recovery suíte geral posterior: 898/900; DFC e login falharam
```

Os quatro testes de rota que falharam na primeira execução não reproduziram
individualmente nem no grupo controlado. A falha variável de DFC sob a suíte
geral é uma condição de concorrência/tempo do conjunto de testes, não uma
falha determinística do fluxo PDF. O otimizador é carregado sob demanda pelo
fluxo de upload e não é importado pelo teste de DFC ou pelo teste de login.

Conclusão:

```text
PDF_REGRESSION = NO
LOGIN_FAILURE = PREEXISTING_BASELINE_FAILURE
ROUTE_FAILURES = FLAKY_UNDER_FULL_SUITE_CONCURRENCY
```

Nenhum teste foi alterado para obter aprovação.

## Evidências visuais

Os cinco conjuntos completos permanecem em:

`artifacts/contracts-pdf-06-visual-review/`

Categorias:

- native text/tables — original preservado;
- color scan — otimizado;
- grayscale scan — otimizado;
- simulated signature/stamp — original preservado;
- mixed native/raster — otimizado.

O pacote portátil foi criado em:

`artifacts/contracts-pdf-07-visual-review.zip`

Verificação fora do worktree:

```text
ZIP entries = 28
Manifest entries = 25
HTML = presente
Manifesto = presente
Referências absolutas no HTML = 0
Extração em diretório temporário = OK
```

O HTML referencia somente arquivos relativos. Não foram usados contratos reais.

## Preservação

Os commits anteriores permanecem preservados:

```text
e3be764  feat(contracts): optimize PDF attachments before upload
15822f4  test(contracts): validate PDF optimization and preservation
3c5beb2  docs(contracts): record local PDF recovery commits
```

Esta etapa adiciona somente o relatório e o ZIP portátil em um commit local
específico. Não houve alteração em `main`, no workspace principal, no
worktree comprometido, no Supabase, em SQL ou em migrations.
