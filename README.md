# Efetiva OS

PWA interno de gestao administrativa da Efetiva SST.

Aplicacao: https://efetivaos.pages.dev

## Estado atual

Motor de Precos MVP concluido: fornecedores, catalogo, cotacoes, comparacao, regras de acrescimo sobre custo, aprovacao comercial, tabela de precos e dashboard operacional. O PWA usa Supabase Auth/RLS e permanece dependente de conexao para dados transacionais.

Rotas principais:

- `/pricing`: dashboard do Motor de Precos;
- `/pricing/suppliers`: fornecedores;
- `/pricing/catalog`: Catalogo Efetiva;
- `/pricing/quotations`: cotacoes;
- `/pricing/comparison`: comparacao e decisao comercial;
- `/pricing/rules`: regras comerciais, somente Admin;
- `/pricing/prices`: tabela comercial.

## Requisitos

- Node.js 22.12+
- npm 10+
- Supabase CLI para migrations e desenvolvimento local

## Configuracao local

1. Instale as dependencias com `npm install`.
2. Crie `.env.local` a partir de `.env.example`.
3. Preencha apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Execute `npm run dev`.

Nunca use uma chave `service_role` no frontend.

## Comandos

- `npm run dev`: servidor local.
- `npm run build`: TypeScript e build de producao.
- `npm run lint`: analise estatica.
- `npm test`: testes automatizados.
- `npm run test:e2e`: Playwright remoto; exige as confirmacoes e credenciais descritas em `e2e/env.ts` e nunca deve registrar `service_role`.

## Banco

As alteracoes estruturais ficam em `supabase/migrations`. O projeto tambem suporta validacao remote-first no Supabase DEV conforme `DEC-024`, sem tornar Docker obrigatorio para o gate remoto.

## Deploy

Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22
- Variaveis publicas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
