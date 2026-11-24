# EFETIVAOS-CONTRATOS-PDF-08-FIX

Data: 2026-11-24  
Worktree: `D:\PWA PROJETOS\efetivaos-pdf-05-recovery`  
Branch: `recovery/efetivaos-contratos-pdf-05`

## Resultado

```text
VISUAL_EVIDENCE = 3/3
SCANNED_CONTRACT_LEGIBILITY = REVIEW
ORIGINAL_FALLBACK = PASS
HUMAN_VISUAL_APPROVAL = PENDING
GIT_PUSH = NO
DEPLOY_EXECUTED = NO
```

## Documentos sintéticos

Foram gerados três contratos fictícios, sem dados reais:

1. contrato digitalizado colorido;
2. contrato digitalizado em tons de cinza;
3. contrato misto, com cabeçalho/texto nativo e corpo digitalizado.

Cada documento contém cláusulas, texto equivalente a 8–10 pontos, datas,
números, valores em reais, tabela de serviços, assinaturas manuscritas
simuladas e carimbo sintético. Uma granulação de papel sutil e determinística
foi usada para representar a textura de digitalização, sem substituir o
conteúdo contratual.

## Execução do otimizador existente

Parâmetros mantidos:

```text
targetDpi = 200
jpegQuality = 0.82
minSavingRatio = 0.15
```

Resultados:

```text
scanned-contract-color       1 -> 1 página   84,83% de economia
scanned-contract-grayscale   1 -> 1 página   81,74% de economia
mixed-contract-native-scanned 1 -> 1 página  84,44% de economia
```

Os três resultados foram efetivamente produzidos pelo otimizador. Não houve
compressão forçada nem alteração funcional do otimizador.

## Evidência

ZIP definitivo:

`D:\PWA PROJETOS\efetivaos-pdf-05-recovery\artifacts\contracts-pdf-08-visual-review.zip`

Conteúdo verificado:

```text
conjuntos visuais = 3
arquivos no manifesto = 21
arquivos extraídos = 24
hashes divergentes = 0
referências absolutas no HTML = 0
integridade do ZIP = PASS
```

Cada caso inclui PDF original, PDF resultante, renderizações PNG na mesma
escala, mapa real de diferenças, ampliação de texto/valores e ampliação de
assinaturas/carimbo. O HTML permite abrir as imagens em tamanho ampliado.

A legibilidade está `REVIEW` porque a aprovação visual humana permanece
`PENDING`; a validação automatizada confirmou renderização, páginas,
diferenças e hashes.

Os testes existentes de fallback, assinatura, criptografia e PDF inválido
permanecem aprovados no escopo PDF. Nenhum contrato real foi utilizado.

## Preservação

Somente o gerador, as evidências e este relatório foram alterados. Os commits
anteriores foram preservados. Não houve alteração em Supabase, migrations,
Financeiro, `main` ou workspace original; não houve push nem deploy.
