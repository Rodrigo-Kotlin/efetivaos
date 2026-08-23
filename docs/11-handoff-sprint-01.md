# Handoff — Sprint 1 / ETAPA 01

## ETAPA 01 — STATUS

COMPLETED_WITH_FINDINGS

## Implementação

- primeira vertical funcional do Motor de Preços conectada ao Supabase DEV real;
- rotas lazy `/pricing/suppliers` e `/pricing/catalog`;
- tipos Supabase atualizados para profiles e cadastros mestres;
- services isolados, TanStack Query para server state e TanStack Table para listagens;
- React Hook Form + Zod em todos os formulários;
- drawer acessível, toasts, busca, filtros, ordenação e status lógico;
- gravações bloqueadas quando o navegador está offline;
- nenhum recurso de Cotações ou Sprint 2 foi implementado.

## Fornecedores

- listagem table-first com busca por dados cadastrais e filtro de status;
- cadastro, edição, detalhes, inativação e reativação;
- nome obrigatório, e-mail opcional validado e campos vazios normalizados para `NULL`;
- confirmação apenas para inativação;
- tabela com nome/razão social, documento, segmento, contato, telefone, status e ações;
- loading skeleton, vazio com CTA, erro com retry e vazio filtrado.

## Categorias

- área integrada ao Catálogo, sem rota adicional;
- listagem, busca, filtro, ordenação, criação, edição, inativação e reativação;
- nome único case-insensitive traduzido para mensagem de negócio;
- categorias inativas permanecem históricas e não são oferecidas para novas associações;
- status de itens não sofre cascata automática conforme `DEC-025`.

## Catálogo

- listagem table-first por código, item/serviço, categoria, unidade e status;
- busca por código/nome e filtros de categoria/status;
- criação, edição, inativação e reativação;
- código normalizado em maiúsculas e unicidade traduzida para `Já existe um item com este código.`;
- categoria e unidade obrigatórias;
- unidades controladas: exame, unidade, serviço, pessoa, hora, dia, mês e pacote, com opção personalizada;
- categorias inativas preservadas para leitura histórica, mas fora de novas seleções.

## Supabase

- nenhuma migration estrutural foi necessária;
- schema remoto permaneceu em `20260823000100` e `20260823000200`;
- suíte `sprint_01_master_data.test.sql` executada no DEV em transação com rollback;
- Admin: INSERT, SELECT, UPDATE, inativação e reativação aprovados nas três entidades;
- Equipe: INSERT, SELECT, UPDATE, inativação e reativação aprovados nas três entidades;
- Admin e Equipe sem hard delete;
- anônimo sem SELECT em fornecedores, categorias ou itens;
- unicidade case-insensitive, FK de categoria, categoria obrigatória e auditoria aprovadas;
- pós-teste confirmou zero fixtures e pgTAP não persistido;
- lint remoto do schema sem erros.

## Testes

- `npm test`: 29 testes aprovados em 8 arquivos;
- formulários: obrigatoriedade, e-mail, normalização, criação e edição;
- páginas: inativação/reativação, loading, empty state, erro/retry, filtros, drawer e pending;
- erro de código duplicado coberto na camada de serviço;
- `npm run lint`: aprovado;
- `npm run build`: aprovado;
- SQL remoto: 35 testes aprovados com rollback;
- revisão independente final: GO.

## UI/UX

- identidade Efetiva e cor `#0B6B3A` preservadas;
- sidebar desktop e menu mobile atualizados com as novas rotas;
- menu mobile e drawers usam modal acessível com foco, Escape e restauração;
- labels, erros associados, foco visível e badges textuais;
- tabelas desktop-first com scroll controlado e ações fixas à direita;
- formulários e toolbars reorganizam em uma coluna em telas menores;
- feedback de sucesso/erro por toast discreto.

## Bundle

Baseline Gate 00.2:

- principal: 528,52 kB;
- gzip: 154,65 kB.

Sprint 1:

- principal: 560,69 kB (+32,17 kB);
- gzip: 163,81 kB (+9,16 kB);
- Fornecedores lazy: 14,54 kB / 4,70 kB gzip;
- Catálogo lazy: 22,36 kB / 6,07 kB gzip;
- aviso de chunk acima de 500 kB permanece não bloqueante.

## Deploy

- integração: GitHub `main` → Cloudflare Pages;
- URL: https://efetivaos.pages.dev;
- rotas publicadas: `/pricing/suppliers` e `/pricing/catalog`;
- validação final do deployment deve usar o commit documental de fechamento desta etapa.

## Git

Branch: `main`

Commits técnicos:

- `144f6f4 feat: add pricing master data foundation`;
- `3eda204 feat: implement supplier management`;
- `103951d feat: implement canonical catalog management`;
- `fce85a5 test: cover pricing master data flows`.

## Decisões

- `DEC-025`: status de categoria não altera itens automaticamente.

## Findings

- os arquivos `docs/wireframes/05-fornecedores.png` e `docs/wireframes/06-catalogo.png` solicitados não existem no repositório; o protótipo canônico `docs/wireframes/motor-precos-v0.3.html` foi utilizado;
- não houve automação de navegador autenticado contra o deployment; os fluxos foram validados por testes de componente e contra o Supabase DEV remoto em transação;
- o chunk principal continua acima de 500 kB, com crescimento proporcional às dependências compartilhadas de drawer/toast e aos novos contratos de UI.

## Próximo passo recomendado

ETAPA 02 — Cotações e Itens de Cotação
