# EFETIVAOS-CONTRATOS-PDF — Verificação da interface

Data: 2026-11-24  
Worktree: `D:\PWA PROJETOS\efetivaos-pdf-05-recovery`  
Branch: `recovery/efetivaos-contratos-pdf-05`

## Caminho da interface

Rota:

```text
/crm/clients/:clientId
```

Fluxo:

```text
Clientes → selecionar cliente → seção Contratos
→ contrato criado → Documentos e histórico
→ Anexar PDF do contrato
```

Componentes:

- `src/app/router.tsx` — registra `crm/clients/:clientId`;
- `src/features/crm/pages/client-detail-page.tsx` — detalhe do cliente;
- `src/features/crm/pages/ClientDetails.tsx` — seção `Contratos`;
- `src/features/crm/pages/client-contracts.tsx` — lista, expansão e documentos;
- `src/features/crm/pages/contract-document-upload.tsx` — seleção,
  validação, otimização, confirmação e upload.

## Motivo pelo qual o botão não aparecia

O upload já estava implementado, mas não é exibido na tela vazia de Contratos.
`ContractDocumentUpload` só é montado dentro de `ContractExtras`, que depende
de:

1. existir um registro em `client_contracts`; e
2. o usuário expandir o contrato pelo botão `Documentos e histórico`.

Portanto, antes da criação de um contrato ou enquanto seus detalhes estão
recolhidos, o botão não aparece. Isso é uma condição de exibição, não falta
de permissão nem ausência do recurso.

O rótulo foi tornado explícito:

```text
Anexar PDF do contrato
```

## Fluxo preservado

O componente continua usando `useUploadContractDocument`, que chama a
implementação existente de `uploadContractDocument`. O fluxo mantém:

- validação PDF e limite de 10 MB;
- otimização local existente;
- confirmação explícita;
- registro pendente;
- bucket privado `client-contracts`;
- RLS e autenticação existentes;
- finalização RPC;
- URLs assinadas para visualizar e baixar;
- descarte compensatório e auditoria existentes.

Não foi criado outro serviço de upload e o otimizador não foi alterado.

## Evidência visual

Screenshots locais:

- `artifacts/contracts-interface-verification/contracts-interface-upload-button.png`
- `artifacts/contracts-interface-verification/contracts-interface-upload-confirmation.png`

As capturas usam o componente React real em um cliente/contrato sintético
local. A segunda captura comprova seleção, processamento local, tamanho
original/final, preservação do original quando não há economia segura e ação
`Confirmar envio`. Nenhum arquivo foi enviado ao Storage.

## Testes

```text
PDF/API direcionados: 16/16 PASS
TypeScript: PASS
ESLint dos arquivos alterados: PASS
Captura Playwright local: PASS
```

O teste de navegação de Contratos existente apresentou a flutuação assíncrona
já conhecida: a variante Equipe passou e a variante Admin falhou aguardando o
link de cliente, antes de executar o fluxo PDF. Não houve alteração ou
desabilitação do teste. Não foram executados testes E2E contra dados reais.

Visualização e download dependem de documento `ready` e URL assinada; o código
existente implementa ambos em `ContractDocument` e `getContractDocumentUrl`.
A execução contra backend real requer fixture autenticada e não foi realizada
nesta verificação para evitar alterar dados reais.

## Publicação

```text
PRONTO_PARA_PUBLICACAO = YES, após revisão humana
DISPONIVEL_EM_PRODUCAO = NÃO CONFIRMADO
GIT_PUSH = NO
DEPLOY_EXECUTED = NO
DATABASE_CHANGES = NO
WORKSPACE_PRINCIPAL_ALTERADO = NO
```
