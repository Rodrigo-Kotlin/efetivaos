# EFETIVAOS-CONTRATOS-PDF-10 — PDF no cadastro do contrato

Data: 2026-11-25  
Base: `origin/main` em `50783a958e40522adcbbcbef967684facaf6d0e4`  
Worktree: `D:\PWA PROJETOS\efetivaos-pdf-10-create-form`  
Branch: `recovery/efetivaos-contratos-pdf-10`

## Resultado

```text
EFETIVAOS_CONTRATOS_PDF_10 = PASS_WITH_REVIEW
UPLOAD_IN_CREATE_FORM = YES
EXISTING_UPLOAD_PRESERVED = YES
PDF_OPTIMIZATION_REUSED = YES
CLIENT_ASSOCIATION = PASS
FAILURE_RECOVERY = PASS
RESPONSIVE_UI = PASS
TESTS = 21/21 direcionados PASS
BUILD = PASS
TYPECHECK = PASS
LINT_SCOPE = PASS
DATABASE_CHANGES = NO
SUPABASE_CHANGES = NO
GIT_PUSH = NO
DEPLOY_EXECUTED = NO
```

## Implementação

O formulário `ContractForm`, em
`src/features/crm/pages/client-contracts.tsx`, agora contém a seção:

```text
Documento do contrato
Selecione o PDF do contrato. O sistema tentará reduzir seu tamanho sem comprometer a integridade documental.
Selecionar PDF do contrato
```

O componente existente `ContractDocumentUpload` foi estendido para operar em
modo diferido. Nesse modo ele reutiliza `prepareContractPdf`, mantém o
`PreparedContractPdf` apenas em memória e não chama Storage antes do cadastro.

Ao salvar:

1. sem PDF, cria somente o contrato;
2. com PDF, cria o contrato primeiro;
3. usa o ID retornado para chamar `uploadContractDocument`;
4. em falha de upload, mantém o contrato criado e apresenta retry;
5. retry reutiliza o mesmo contrato e não cria outro registro;
6. falha na criação impede qualquer upload.

O fluxo existente para contratos já cadastrados, incluindo
`Documentos e histórico`, visualização, download, descarte, Storage privado,
RLS, URLs assinadas e auditoria, foi preservado.

## Testes e evidências

Testes direcionados:

```text
src/features/crm/pages/client-contracts.test.tsx  5/5
src/features/crm/api/contracts-api.test.ts         9/9
src/features/crm/pdf/pdf-optimizer.test.ts         3/3
src/features/crm/pdf/pdf-validation.test.ts       4/4
Total                                              21/21
```

Também passaram:

```text
npx tsc -b --pretty false  PASS
npm run build              PASS
ESLint escopado            PASS
viewport 390px             PASS, sem overflow horizontal
```

Capturas:

- `artifacts/contracts-create-form-verification/contracts-create-form-empty.png`
- `artifacts/contracts-create-form-verification/contracts-create-form-prepared.png`

As capturas foram geradas com o componente `ClientContracts` real, contrato
vazio sintético e consulta de contratos interceptada localmente. Nenhum dado ou
backend real foi utilizado.

## Segurança e escopo

Nenhuma migration, política RLS, bucket, função Supabase ou serviço de upload
novo foi criado. O otimizador e os parâmetros homologados permanecem
inalterados. Não houve SQL, push, deploy ou alteração do workspace principal.
