# Handoff — Sprint 0 / Gate 00.2

## ETAPA 00.2 — STATUS

COMPLETED_WITH_FINDINGS

## Escopo executado

- projeto Supabase DEV `efetivaos` (`bxviuzluxcijbqqbpyzb`) confirmado antes do rollout;
- senha de banco exposta revogada pelo endpoint oficial e substituta mantida fora do Git;
- `.env.example` sanitizado sem versionar a nova credencial;
- snapshot lógico pre-migration criado fora do repositório;
- migration candidata reavaliada por duas auditorias estáticas independentes;
- corridas entre ativação, itens e alterações do catálogo fechadas com ordem global de locks;
- migration `20260823000200_create_pricing_schema.sql` aplicada no DEV remoto;
- schema, Auth/roles, RLS, grants, views, RPCs, triggers e Storage validados;
- dados e extensão pgTAP usados nos testes revertidos ao final das transações;
- nenhum CRUD da Sprint 1 foi iniciado.

## Git

Branch: `main`

Commit técnico do Gate 00.2:

- `5fc811c fix: secure pricing schema rollout`

## Banco/Supabase

Histórico remoto após o gate:

- `20260823000100_create_profiles_and_roles.sql`;
- `20260823000200_create_pricing_schema.sql`.

Pós-flight:

- 7 tabelas funcionais criadas;
- RLS habilitada e forçada nas 7 tabelas;
- 4 views de comparação disponíveis;
- 24 policies do módulo e Storage identificadas;
- anônimo sem grant de leitura nas tabelas do Motor;
- bucket `supplier-quotes` privado;
- 2 profiles preexistentes preservados;
- tabelas funcionais vazias após o rollback dos testes;
- pgTAP não persistiu no projeto.

## Backup e retorno

- backups automáticos consultados antes do rollout: WALG habilitado, sem snapshot concluído e sem PITR utilizável;
- snapshot lógico externo: `efetivaos-pre-20260823000200-20260823T191623Z.json`;
- SHA-256: `65C440927B1FBADB122B3DDE417D343098B70CD3B3E85CA0538447ECC094D379`;
- conteúdo: profiles e histórico remoto de migrations imediatamente antes da aplicação;
- baseline estrutural anterior permanece reproduzível por `20260823000100_create_profiles_and_roles.sql`;
- qualquer rollback destrutivo deve pausar escritas, restaurar a baseline e validar o hash do snapshot antes de reparar o histórico de migrations.

## Testes

Banco remoto:

- duas auditorias estáticas independentes: GO;
- `supabase db push --linked --dry-run`: somente `20260823000200` pendente;
- Motor de Preços: 40 testes SQL aprovados em transação com rollback;
- profiles/roles: 8 testes SQL aprovados em transação com rollback;
- Admin: aprovação, fonte alternativa e snapshots aprovados;
- Equipe: operações permitidas e negativas de regra, role e aprovação aprovadas;
- anônimo: ausência de privilégios nas tabelas protegidas aprovada;
- pós-flight estrutural e limpeza: aprovados;
- `supabase db lint --linked --schema public --level warning`: nenhum erro.

Frontend:

- `npm test -- --run`: 3 testes aprovados;
- `npm run lint`: aprovado;
- `npm run build`: aprovado;
- PWA gerado com 29 entradas de precache.

## Arquivos principais alterados

- `.env.example`;
- `supabase/migrations/20260823000200_create_pricing_schema.sql`;
- `supabase/tests/pricing_schema.test.sql`;
- `supabase/tests/profiles_rls.test.sql`;
- `docs/04-decision-register.md`;
- `docs/05-roadmap.md`;
- `docs/06-learning-log.md`;
- `docs/10-handoff-sprint-00-2.md`.

## Decisões registradas

- `DEC-024`: validação Supabase remote-first sem Docker local.

## Findings

- o snapshot de retorno é lógico e limitado ao estado afetável; não havia snapshot físico concluído nem PITR no plano remoto no momento do rollout;
- as correções de concorrência passaram por duas revisões estáticas, mas não houve teste automatizado de duas sessões concorrentes;
- a credencial revogada permanece no histórico público anterior; nenhuma reescrita disruptiva de histórico foi executada;
- o chunk principal permanece em 528,52 kB e gera o mesmo aviso não bloqueante do Vite registrado no Gate 00.1.

## Próximo passo recomendado

Autorizar explicitamente a Sprint 1 — Fornecedores + Categorias + Catálogo. Não iniciar a Sprint 2 nem ampliar o escopo do Motor antes de fechar o gate da Sprint 1.
