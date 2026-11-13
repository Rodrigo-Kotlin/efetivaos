# SheetJS CE — distribuição oficial fixada para CC22

- Pacote: `xlsx`, versão **0.20.3**, licença **Apache-2.0**.
- Origem: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
- Documentação oficial da distribuição:
  https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
- SHA-256 observado do arquivo:
  `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`.
- SRI SHA-512 (também fixado no package-lock.json):
  `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`.

O tarball inclui LICENSE (também em dist/) e tipos TypeScript e não possui install hooks.
O hash comprova reprodutibilidade do arquivo obtido por HTTPS da origem indicada;
não é uma assinatura/atestação independente do mantenedor. Não editar seu conteúdo.

O registry npm permanece em 0.18.5. A versão aqui fixada é posterior às correções
de CVE-2023-30533 (0.19.3) e CVE-2024-22363 (0.20.2). Mantém XLS/BIFF e XLSX,
sem migração das regras financeiras. O lockfile usa `file:vendor/xlsx-0.20.3.tgz`,
evitando depender da disponibilidade do CDN durante cada instalação.

Revisar novamente procedência, hashes, advisories e regressões antes de substituir
esta distribuição. Não suprimir alertas futuros apenas por estar vendorizada.
