# EFETIVAOS-CONTRATOS-PDF-06 — Reimplementação controlada

Data: 2026-11-24  
Worktree: `D:\PWA PROJETOS\efetivaos-pdf-05-recovery`  
Branch: `recovery/efetivaos-contratos-pdf-05`  
Base: `32eed5a1c396e162ced7c3df38066b7d93b48d69`

## Resultado

```text
EFETIVAOS_CONTRATOS_PDF_06 = PASS_WITH_REVIEW
RECOVERY_WORKTREE = D:\PWA PROJETOS\efetivaos-pdf-05-recovery
OPTIMIZER_REIMPLEMENTED = YES
EXISTING_UPLOAD_REUSED = YES
PDF_SECURITY = PASS
DIGITAL_SIGNATURE_PRESERVED = PASS
ORIGINAL_FALLBACK = PASS
UNIT_TESTS = 16/16 PDF scope; full suite 895/900 (5 pre-existing unrelated failures)
BROWSER_TESTS = 5/5 synthetic visual harness in Chromium
TYPECHECK = PASS
BUILD = PASS
LINT_SCOPE = PASS
PRODUCTION_VULNERABILITIES = 0
VISUAL_EVIDENCE = 5/5
VISUAL_REPORT = artifacts/contracts-pdf-06-visual-review/contracts-pdf-06-visual-review.html
HUMAN_VISUAL_APPROVAL = PENDING
LOCAL_COMMIT_1 = e3be764
LOCAL_COMMIT_2 = 15822f4
DATABASE_CHANGES = NO
GIT_PUSH = NO
DEPLOY_EXECUTED = NO
READY_FOR_HUMAN_REVIEW = YES
```

## Implementação

O fluxo existente de Clientes → Contratos foi preservado: bucket privado
`client-contracts`, registro pendente, upload Storage, RPC de finalização,
URLs assinadas, RLS, auditoria existente e descarte compensatório continuam
sendo usados.

Foi adicionada otimização local no navegador com `pdf-lib@1.17.1`,
`DecompressionStream` e Canvas:

- carregamento do otimizador sob demanda;
- `targetDpi: 200`;
- `jpegQuality: 0.82`;
- `minSavingRatio: 0.15`;
- recompressão somente de imagens Flate RGB/grayscale sem máscara;
- preservação de texto nativo e ordem/páginas;
- limites de bytes, pixels, dimensões e tempo;
- validação de cabeçalho, EOF, MIME, extensão e tamanho antes do upload;
- verificação de saída e contagem de páginas;
- rejeição segura para assinatura digital, criptografia, incompatibilidade,
  erro, ausência de economia ou saída maior;
- confirmação explícita antes do envio;
- metadados de tamanho, economia, método e fingerprint registrados no evento
  existente quando disponível.

Nenhuma migration, política, função Supabase, bucket ou serviço externo foi
criado ou alterado.

## Testes

Testes PDF específicos cobrem:

- PDF textual/compacto;
- PDF raster colorido e grayscale;
- imagem incorporada com recompressão e verificação;
- PDF assinado e marcador de criptografia;
- conteúdo inválido, extensão falsa, MIME incompatível e limite de tamanho;
- fallback para original;
- falha de Storage, falha de finalização, descarte compensatório e documento
  pendente.

O `npm test` completo executou 900 testes: 895 aprovados e 5 falharam em
`src/app/router.test.tsx` e `src/features/auth/login-page.test.tsx`, todos em
regressões assíncronas fora do escopo PDF (carregamento de rotas/Connect/DFC e
estado inicial do login). Os testes específicos de Contratos PDF passaram.

Validações aprovadas:

```text
npx tsc -b --pretty false                         PASS
npm run build                                     PASS
eslint (escopo CRM/PDF)                          PASS
npm audit --omit=dev --audit-level=high           0 vulnerabilities
```

## Evidência visual sintética

Artefatos locais em:

`artifacts/contracts-pdf-06-visual-review/`

Para cada uma das cinco categorias há PDF original, PDF final, PNG original,
PNG final, mapa de diferenças e manifesto SHA-256:

1. texto nativo e tabelas — original preservado;
2. scan colorido — otimizado;
3. scan grayscale — otimizado;
4. assinatura/stamp simulado — original preservado;
5. conteúdo misto nativo/raster — otimizado.

O harness Chromium foi executado localmente e produziu `5/5` conjuntos. As
imagens são evidência técnica sintética, não aprovação visual automática. A
aprovação humana permanece `PENDING`.

## Preservação e commits

Os commits locais devem conter somente:

1. funcionalidade PDF e integração do upload;
2. testes, harness, evidências e esta documentação.

Não houve push, deploy, alteração da branch `main`, alteração do workspace
principal, alteração do worktree comprometido ou alteração do Supabase.
