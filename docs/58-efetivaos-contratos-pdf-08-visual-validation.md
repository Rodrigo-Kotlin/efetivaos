# EFETIVAOS-CONTRATOS-PDF-08 — Validação visual definitiva

Data: 2026-11-24  
Worktree: `D:\PWA PROJETOS\efetivaos-pdf-05-recovery`  
Branch: `recovery/efetivaos-contratos-pdf-05`  
Base: `32eed5a1c396e162ced7c3df38066b7d93b48d69`

## Resultado

```text
EFETIVAOS_CONTRATOS_PDF_08 = PASS_WITH_REVIEW
CORRECT_WORKTREE = PASS
REMOTE_BASE_VERIFIED = YES
COMMITS_PRESERVED = YES
VISUAL_EVIDENCE = 5/5
ORIGINAL_RENDERING_VERIFIED = YES
OPTIMIZED_RENDERING_VERIFIED = YES
DIFFERENCE_MAPS_VALID = YES
CONTRACT_LEGIBILITY = REVIEW
DIGITAL_SIGNATURE_PROTECTION = PASS
ORIGINAL_FALLBACK = PASS
VISUAL_ZIP = D:\PWA PROJETOS\efetivaos-pdf-05-recovery\artifacts\contracts-pdf-08-visual-review.zip
ZIP_INTEGRITY = PASS
UNIT_TESTS = 16/16
TYPECHECK = PASS
BUILD = PASS
NEW_LOCAL_COMMIT = 6051d8a
HUMAN_VISUAL_APPROVAL = PENDING
READY_FOR_RELEASE_REVIEW = YES
ORIGINAL_WORKSPACE_CHANGES = NO
DATABASE_CHANGES = NO
GIT_PUSH = NO
DEPLOY_EXECUTED = NO
```

## Base e escopo

O branch e o worktree conferidos são os esperados. `origin/main` permanece
exatamente em `32eed5a1c396e162ced7c3df38066b7d93b48d69`; não há commits
adicionais remotos nem conflito a avaliar.

Os quatro commits anteriores permanecem intactos:

```text
e3be764  feat(contracts): optimize PDF attachments before upload
15822f4  test(contracts): validate PDF optimization and preservation
3c5beb2  docs(contracts): record local PDF recovery commits
f44b8fe  docs(contracts): close PDF regression review
```

O relatório preexistente `docs/56-efetivaos-contratos-pdf-05-recovery.md`
permanece presente e não foi alterado. Não há alterações em Supabase,
migrations, Edge Functions, Financeiro ou Connect.

## Correção da evidência

O gerador foi corrigido para:

- renderizar o PDF original com PDF.js no Chromium;
- renderizar o PDF resultante com o mesmo mecanismo, escala `1.5` e resolução;
- nunca reutilizar a imagem de entrada como representação do resultado;
- calcular o mapa pixel a pixel entre as duas renderizações;
- registrar hashes SHA-256 de PDFs, PNGs e mapas no manifesto;
- registrar contagem de páginas original/resultante;
- permitir ampliação das imagens no HTML por links relativos.

Resultados observados:

```text
native-text-tables       unchanged  changed pixels 0.000%
color-scan               optimized changed pixels 47.603%
grayscale-scan           optimized changed pixels 10.264%
simulated-signature      unchanged  changed pixels 0.000%
mixed-native-raster      optimized changed pixels 47.830%
```

Nos três documentos otimizados, os hashes dos PNGs original e resultante são
distintos e os mapas de diferenças são não vazios. Nos dois documentos
preservados, os PNGs são iguais e a diferença efetiva é zero.

## Proteção documental

Os testes direcionados passaram com `16/16`. Permanecem confirmados:

- assinatura digital e criptografia não são reescritas;
- arquivos inválidos são rejeitados;
- ausência de economia segura preserva o original;
- texto nativo não é rasterizado;
- páginas e estrutura são verificadas;
- nenhum serviço externo recebe documentos.

Os cinco documentos são sintéticos, gerados localmente, sem contratos reais,
clientes reais ou assinaturas autênticas. A legibilidade contratual está
classificada como `REVIEW` porque a aprovação visual humana continua pendente.

## Pacote portátil

Arquivo:

`artifacts/contracts-pdf-08-visual-review.zip`

Conteúdo verificado:

```text
entradas extraídas = 28
arquivos no manifesto = 25
cinco conjuntos visuais = presentes
HTML = presente
manifestos JSON = presentes
hashes divergentes = 0
referências absolutas no HTML = 0
extração fora do worktree = PASS
```

O pacote contém os cinco PDFs originais sintéticos, cinco resultados do
otimizador, quinze PNGs (original, resultante e diferença), HTML e manifestos.

## Validações

```text
npx vitest run src/features/crm/pdf/pdf-optimizer.test.ts \
  src/features/crm/pdf/pdf-validation.test.ts \
  src/features/crm/api/contracts-api.test.ts                 PASS 16/16
npx tsc -b --pretty false                                      PASS
npm run build                                                  PASS
```

O ESLint do script `.mjs` passou. O arquivo HTML do harness é deliberadamente
ignorado pela configuração ESLint; não há erro de lint no código executável
configurado.

Nenhuma otimização funcional ou refatoração fora da evidência visual foi
realizada. Não houve push, deploy, alteração da branch `main`, alteração do
workspace principal ou remoção de worktree.
