# Efetiva OS

PWA interno de gestao administrativa da Efetiva SST.

## Sprint atual

Etapa 00: fundacao tecnica com React, Supabase Auth/RLS, App Shell, rota `/pricing`, PWA e Cloudflare Pages. Os CRUDs do Motor de Precos ainda nao fazem parte desta entrega.

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

## Banco

As alteracoes estruturais ficam em `supabase/migrations`. Para ambiente local, use `supabase start` e `supabase db reset` com Docker ativo.

## Deploy

Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22
- Variaveis publicas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
