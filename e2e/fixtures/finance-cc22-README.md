# Fixtures CC22 — exclusivamente sintéticas

Os arquivos XLS/XLSX contêm somente exemplos CC22, nunca dados de clientes ou
lançamentos existentes. Não devem ser enviados ao Supabase.

- `finance-cc22-legacy.xls`: BIFF8 gerado pelo SheetJS 0.18.5 do checkout CC21.
- `finance-cc22-legacy.xlsx`: OOXML gerado pela mesma versão, com folha inicial vazia.
- `finance-cc22-legacy-biff5.xls`: BIFF5 gerado pela mesma versão. Como seu writer
  substitui caracteres não ASCII por underscores, os bytes de dois LABELs foram
  preenchidos com CP1252 (`Descrição`, `ação`), sem mudar comprimentos/estrutura,
  para exercitar a leitura de acentos em um arquivo legado real.
- JSONs associados: resultado do `sheet_to_json` 0.18.5 da folha Dados, com
  `defval:null,raw:true`. Os testes comparam esse resultado ao parser atualizado.

Os exemplos incluem data serial 46023, valor 1234.56 e, em BIFF8/XLSX, outra linha
com data e dinheiro inválidos. A normalização financeira deve aceitar/rejeitar as
mesmas linhas. BIFF5 usa uma única linha válida e testa suporte explícito a codepage
no worker ESM compilado; os testes Node isolados não substituem esse teste browser.
