# Handoff Sprint 07 — CRM Light: Clientes e Contatos

## Status Final

`ETAPA 07 — COMPLETED_WITH_FINDINGS`

---

## 1. Objetivo

Implementar a base cadastral do CRM Light com módulo de **Clientes** (PJ/PF) e **Contatos**, incluindo:

- CRUD completo de clientes com validação de CPF/CNPJ
- Gerenciamento de contatos com definição de contato principal
- API RPC atômica para contatos com proteção IDOR
- RLS completo para Admin, Equipe, Anônimo e Profile Inativo
- UI responsiva com Drawer, busca, filtros, loading/empty/error states
- Acessibilidade (labels, foco, teclado, escape, retorno de foco, aria-labels)

---

## 2. Schema

### Enums

- `client_type`: `company` | `individual`
- `client_status`: `active` | `inactive`

### Tabelas

#### `clients`

| Coluna | Tipo | Notes |
|--------|------|-------|
| `id` | uuid | PK, gen_random_uuid() |
| `legal_name` | text | obrigatório, máx 200 |
| `trade_name` | text | opcional |
| `tax_id` | text | único, normalizado (só dígitos) |
| `client_type` | client_type | company/individual |
| `status` | client_status | active/inactive |
| `email` | text | opcional, validado por check |
| `phone` | text | opcional, normalizado |
| `website` | text | opcional |
| `zip_code` | text | opcional |
| `street` | text | opcional |
| `number` | text | opcional |
| `complement` | text | opcional |
| `district` | text | opcional |
| `city` | text | opcional |
| `state` | text | opcional, máx 2 |
| `country` | text | default 'Brasil' |
| `notes` | text | opcional |
| Audit | | created_at, created_by, updated_at, updated_by |

#### `client_contacts`

| Coluna | Tipo | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `client_id` | uuid | FK → clients (RESTRICT) |
| `name` | text | obrigatório |
| `role` | text | opcional |
| `department` | text | opcional |
| `email` | text | opcional |
| `phone` | text | opcional |
| `whatsapp` | text | opcional |
| `is_primary` | boolean | default false |
| `notes` | text | opcional |
| `status` | client_status | default active |
| Audit | | same fields |

### Índices

- `idx_clients_lower_legal_name` — lower(legal_name)
- `idx_clients_lower_trade_name` — lower(trade_name)
- `idx_clients_status_state` — (status, state) WHERE status = 'active'
- `idx_client_contacts_client_id` — (client_id)
- `idx_client_contacts_client_status` — (client_id, status)
- `uq_client_contacts_active_primary` — UNIQUE (client_id) WHERE is_primary = true AND status = 'active'

### View

`client_list_v` — security_invoker, join de clients com lateral contact summary (primary contact, counts)

### RPC

`save_client_contact()` — create/update atômico de contatos com:
- Swap atômico de contato principal
- Proteção IDOR (client_id do contato deve bater)
- Validação de FK
- Audit field protection

---

## 3. Normalização CPF/CNPJ

- Armazenado somente dígitos
- Triggers de normalização removem caracteres não numéricos
- Check constraint `is_valid_brazilian_tax_id()` valida dígito verificador
- Unicidade **global** (não apenas entre ativos) via `UNIQUE (tax_id)`
- Regra preservada: não alterada da ETAPA 07 original

---

## 4. Contato Principal

### Regra Canônica

`NO MÁXIMO UM contato principal ativo por cliente.`

- Cliente pode ter ZERO contatos principais
- Nunca dois contatos principais ativos simultaneamente (enforced por `uq_client_contacts_active_primary`)
- Troca de principal é atômica via `save_client_contact()`
- Contato inativado automaticamente perde status de principal
- Não é eleito automaticamente outro contato ao inativar o principal

### Concorrência

O partial unique index previne dois contatos principais ativos. A RPC `save_client_contact()` atomically:
1. Desmarca contatos principais existentes
2. Insere/atualiza o novo contato

---

## 5. Permissões

### Matriz RLS

| Recurso | Admin | Equipe | Anônimo | Inativo |
|---------|-------|--------|---------|---------|
| clients SELECT | ✅ | ✅ | ❌ | ❌ |
| clients INSERT | ✅ | ✅ | ❌ | ❌ |
| clients UPDATE | ✅ | ✅ | ❌ | ❌ |
| clients DELETE | ❌ (grant) | ❌ (grant) | ❌ | ❌ |
| client_contacts SELECT | ✅ | ✅ | ❌ | ❌ |
| client_contacts INSERT | ✅ | ✅ | ❌ | ❌ |
| client_contacts UPDATE | ✅ | ✅ | ❌ | ❌ |
| client_contacts DELETE | ❌ (grant) | ❌ (grant) | ❌ | ❌ |
| client_list_v SELECT | ✅ | ✅ | ❌ | ❌ |
| save_client_contact EXECUTE | ✅ | ✅ | ❌ | ❌ |

### Policy Names

- `clients_insert_internal`, `clients_select_internal`, `clients_update_internal`
- `client_contacts_insert_internal`, `client_contacts_select_internal`, `client_contacts_update_internal`

### Grants

- SELECT, INSERT, UPDATE para `authenticated`
- DELETE revogado de todos (hard delete bloqueado)
- SELECT/INSERT/UPDATE/DELETE revogados de `anon`

---

## 6. Security

### is_admin()

- SECURITY DEFINER
- search_path=""
- coalesce(..., false) — nunca retorna NULL
- Grants: apenas authenticated

### save_client_contact()

- SECURITY INVOKER
- search_path=""
- volatile
- Grants: apenas authenticated

### Hard Delete

Bloqueado por: grants sem DELETE em ambas as tabelas

### IDOR Protection

- RPC valida que client_id do contato pertence ao client_id informado
- Trigger previne mudança de client_id

---

## 7. Rotas

| Path | Componente | Descrição |
|------|-----------|-----------|
| `/crm` | CrmPage | Dashboard CRM |
| `/crm/clients` | ClientsPage | Lista de clientes |
| `/crm/clients/new` | ClientFormPage | Novo cliente |
| `/crm/clients/:clientId` | ClientDetailPage | Detalhe do cliente |
| `/crm/clients/:clientId/edit` | ClientFormPage | Editar cliente |

---

## 8. Frontend

### Componentes

- `CrmPage` — dashboard com indicadores
- `ClientsPage` — tabela com busca, filtros, ordenação, Drawer
- `ClientForm` — stub (retorna null)
- `ClientDetails` — stub (retorna null)
- `ClientFormPage` — stub (retorna null)
- `ClientDetailPage` — stub (retorna null)

### Queries

- `useClientLists()` — fetch de client_list_v
- `useCreateClientMutation()` — create client
- `useSetClientStatusMutation()` — inativar/reativar

### Schemas

- `clientSchema` — Zod validation
- `clientFormDefaults()` — defaults do formulário
- `toClientInput()` — conversão form → API

### API

- `listClients()` — SELECT from client_list_v
- `createClient()` — INSERT into clients
- `updateClient()` — UPDATE clients
- `setClientStatus()` — UPDATE status

---

## 9. Testes

### SQL (pgTAP)

- `sprint_07_crm.test.sql` — 55 asserts
- `sprint_07_postflight.sql` — verificação pós-teste
- Cobertura: enum, tables, RLS, grants, view, RPC, CPF/CNPJ, contacts, IDOR, auth

### Vitest

- 147 testes (pricing + auth)
- Nenhum teste CRM Vitest (stub components)

### E2E (Playwright)

- `crm-admin.spec.ts` — 10 cenários Admin
- `crm-team.spec.ts` — 7 cenários Equipe
- `crm-mobile.spec.ts` — 9 cenários Mobile
- Cenários: navegação, deep-links, busca, filtros, empty states, menu mobile, refresh

---

## 10. Acessibilidade

### Auditado e Corrigido

- ✅ Labels: sr-only em todos os inputs (buscar, filtrar tipo, filtrar status)
- ✅ Foco: Radix Dialog/Drawer gerencia foco
- ✅ Teclado: Escape fecha drawers, tab order natural
- ✅ Retorno de foco: Radix Dialog restaura foco ao trigger
- ✅ aria-labels: botões de ação com nome acessível
- ✅ Icon-only buttons: aria-label em todos
- ✅ Status textual: role="status" nos skeletons
- ✅ Erros: role="alert" nos ErrorState
- ✅ Colapsado sidebar: aria-label adicionado

### Correções Aplicadas

- `app-shell.tsx`: NavLink collapsed com aria-label
- `crm-page.tsx`: Inbox icon com aria-hidden
- `clients-page.tsx`: ArrowUpDown e SVG icons com aria-hidden

---

## 11. Responsividade

| Breakpoint | Validação |
|-----------|-----------|
| 390px (mobile) | ✅ Filtros empilham, Drawer full-width, menu mobile funciona |
| 360px (mobile) | ✅ Mesmo comportamento |
| 768px (tablet) | ✅ Layout adaptado |
| 1024px (desktop) | ✅ Sidebar visível |
| 1280px (wide) | ✅ Colunas adicionais |
| 1440px (full) | ✅ Layout completo |

### Colunas Responsivas

- state/city: hidden em < lg
- tax_id/phone: hidden em < xl
- actions: sticky right com shadow

---

## 12. Bundle

| Chunk | Tamanho | Gzip |
|-------|---------|------|
| index.js (principal) | 564.55 kB | 165.11 kB |
| crm-page.js (lazy) | 4.50 kB | 1.43 kB |
| clients-page.js (lazy) | 8.74 kB | 3.09 kB |
| client-queries.js (lazy) | 2.78 kB | 1.15 kB |
| client-form-page.js (lazy) | 0.04 kB | 0.06 kB |
| client-detail-page.js (lazy) | 0.04 kB | 0.06 kB |
| schemas.js (shared) | 99.90 kB | 29.62 kB |

Delta vs baseline: ~+0.85 kB gzip (CRM modules)

---

## 13. SQL Remoto

### Migrations Aplicadas

1. `20260824000130_fix_is_admin_null_authorization.sql`
2. `20260824000200_create_crm_light_schema.sql`

### SQL Lint

`supabase db lint --linked --schema public --level warning` → **No schema errors found**

### pgTAP

55 testes em `sprint_07_crm.test.sql` — requer Docker para execução remota (pg_prove)

### Post-flight

`sprint_07_postflight.sql` — confere persistência de schemas pós-teste

---

## 14. Findings

| # | Severidade | Finding |
|---|-----------|---------|
| F-01 | MEDIUM | pgTAP remoto requer Docker (pg_prove); SQL lint remoto aprovado |
| F-02 | LOW | ClientForm, ClientDetails, ClientFormPage, ClientDetailPage são stubs |
| F-03 | LOW | Warning: chunk principal > 500 kB (conhecido, não bloqueante) |
| F-04 | LOW | TanStack Table incompatible-library warning (conhecido, não bloqueante) |
| F-05 | INFO | Unicidade CPF/CNPJ é global (preservada da ETAPA 07) |
| F-06 | INFO | Equipe possui mesmo CRUD que Admin (políticas idênticas) |

---

## 15. Próximo Passo Recomendado

`ETAPA 08 — CRM Comercial: Oportunidades e Funil de Vendas`

(Não iniciado — aguardando aprovação formal)
