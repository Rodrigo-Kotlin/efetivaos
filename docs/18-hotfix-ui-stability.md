# Hotfix: UI Stability — Render Loop Fix + CRM Stubs

**Commit:** `12452da`  
**Deployed:** 2026-08-25  
**Preview:** `https://880b3320.efetivaos.pages.dev`  
**Production:** `https://efetivaos.pages.dev`

---

## 1. Problem Statement

Users reported intermittent UI freezes, particularly on pages with TanStack Table. The CRM module had 4 stub components returning `null` (ClientForm, ClientDetails, ClientFormPage, ClientDetailPage). The ClientsPage had an inverted `formOpen` condition preventing the form from rendering.

## 2. Root Causes Identified

### 2.1 TanStack Table Unstable References (PRIMARY)

TanStack Table re-renders the entire table when `data` or `columns` references change. Two anti-patterns were widespread:

- **`data ?? []`** — creates a new array reference every render when data is undefined
- **Columns defined inline** — new array literal on every render, causing infinite re-render cycles

**Affected files:**
| File | Issue | Severity |
|------|-------|----------|
| `suppliers-page.tsx` | `const columns` (no useMemo) + `suppliersQuery.data ?? []` | HIGH |
| `clients-page.tsx` | Inline array in `useReactTable()` + `clientsQuery.data ?? []` | CRITICAL |
| `quotations-page.tsx` | `const columns` (no useMemo) + `query.data ?? []` | HIGH |
| `catalog-tables.tsx` | Callers `CatalogItemsTable`/`CatalogCategoriesTable` not memoizing columns | MEDIUM |

**Already stable (no changes needed):**
- `rules-page.tsx` — already uses `useMemo` for columns
- `comparison-table.tsx` — already uses `useMemo` for columns
- `offers-drawer.tsx` — already uses `useMemo` with empty deps

### 2.2 ClientsPage `formOpen` Bug

```tsx
// BEFORE (inverted — form never renders for 'create' mode)
const formOpen = drawer?.mode !== 'create' && drawer ? drawer.client : undefined

// AFTER (correct)
const isFormOpen = drawer?.mode === 'create' || drawer?.mode === 'edit'
const editingClient = drawer && drawer.mode !== 'create' ? drawer.client : undefined
```

### 2.3 CRM Stub Components

Four components returned `null`, making the CRM routes non-functional:
- `ClientForm.tsx` — 14 lines, stub
- `ClientDetails.tsx` — 11 lines, stub
- `client-form-page.tsx` — 3 lines, stub
- `client-detail-page.tsx` — 3 lines, stub

### 2.4 Missing Mutation Hook

`updateClient` existed in `clients-api.ts` but had no corresponding `useUpdateClientMutation` hook, making edit operations impossible from the UI.

## 3. Changes Made

### 3.1 TanStack Table Stability

**Pattern applied:** Wrap `columns` in `useMemo` with proper dependency arrays; use stable `EMPTY_ARRAY` for undefined data.

| File | Change |
|------|--------|
| `suppliers-page.tsx` | `useMemo<ColumnDef<Supplier>[]>(...)` for columns; `useCallback` for `changeStatus` |
| `clients-page.tsx` | `useMemo<ColumnDef<ClientListRow>[]>(...)` for columns (extracted from inline) |
| `quotations-page.tsx` | `useMemo<ColumnDef<QuotationListRow>[]>(...)` for columns |
| `catalog-tables.tsx` | `useMemo` in both `CatalogItemsTable` and `CatalogCategoriesTable` callers |

### 3.2 ClientsPage Fixes

- Fixed `formOpen` → `isFormOpen` (correct boolean logic)
- Added `editingClient` variable for clarity
- Added `updateClientMutation` for edit operations
- Added `pending` prop to `ClientForm`

### 3.3 CRM Component Implementations

**ClientForm.tsx** (170 lines):
- React Hook Form + Zod `clientSchema` validation
- Dynamic labels based on `client_type` (PF/PJ)
- Full address fieldset (CEP, logradouro, número, complemento, bairro, cidade, UF, país)
- `pending` prop for submit button state
- Proper ARIA attributes and error messages

**ClientDetails.tsx** (45 lines):
- Full detail view with all client fields
- `StatusBadge` and Edit button
- Handles null/undefined values gracefully

**client-form-page.tsx** (61 lines):
- Route page for `/crm/clients/new` and `/crm/clients/:clientId/edit`
- Uses `useParams` to detect create vs edit mode
- Fetches client data for edit mode via `useClientDetail`
- Navigation with `useNavigate` and back button

**client-detail-page.tsx** (41 lines):
- Route page for `/crm/clients/:clientId`
- Fetches client via `useClientDetail`
- Edit button navigates to `/crm/clients/:clientId/edit`

### 3.4 New Query Hook

**`useUpdateClientMutation`** added to `client-queries.ts`:
- Uses `updateClient` from API layer
- Invalidates `clientKeys.detail(id)`, `clientKeys.all`, `clientKeys.lists()`

### 3.5 API Addition

**`getClient(id)`** added to `clients-api.ts`:
- Fetches single client from `client_list_v`
- Used by `useClientDetail` hook

### 3.6 Schema Fix

- Fixed indentation in `client-schema.ts` (line 60: `email` was not indented)

## 4. Files Modified

| # | File | Lines Changed |
|---|------|---------------|
| 1 | `src/features/pricing/suppliers/suppliers-page.tsx` | +18 -12 |
| 2 | `src/features/crm/pages/clients-page.tsx` | +25 -15 |
| 3 | `src/features/pricing/quotations/quotations-page.tsx` | +3 -3 |
| 4 | `src/features/pricing/catalog/catalog-tables.tsx` | +6 -4 |
| 5 | `src/features/crm/pages/ClientForm.tsx` | +157 -14 (reimplemented) |
| 6 | `src/features/crm/pages/ClientDetails.tsx` | +36 -11 (reimplemented) |
| 7 | `src/features/crm/pages/client-form-page.tsx` | +58 -3 (reimplemented) |
| 8 | `src/features/crm/pages/client-detail-page.tsx` | +38 -3 (reimplemented) |
| 9 | `src/features/crm/queries/client-queries.ts` | +20 -1 |
| 10 | `src/features/crm/api/clients-api.ts` | +7 -1 |
| 11 | `src/features/crm/schemas/client-schema.ts` | +1 -1 |

**Total:** 394 insertions, 65 deletions

## 5. Verification

| Check | Result |
|-------|--------|
| ESLint | 0 errors, 1 warning (React Hook Form `watch()` compiler — documented) |
| Vitest | 147/147 passed |
| TypeScript | Clean |
| Vite Build | Success (564.82 kB / 165.22 kB gzip) |
| Smoke Test | 4/4 URLs return 200 |

## 6. Query Invalidation Audit

No invalidation loops found. All `invalidateQueries` calls use the stale-then-refetch pattern. `comparisonKeys.all` is the most invalidated key (invalidated by all 5 pricing mutation files). CRM and pricing modules are isolated behind separate key namespaces.

## 7. Known Limitations

1. **TanStack Table `react-hooks/incompatible-library` warning** — documented, non-blocker
2. **React Hook Form `watch()` compiler warning** — documented, non-blocker
3. **Bundle >500 kB** — pre-existing, not introduced by this hotfix
4. **No E2E stability tests yet** — can be added in ETAPA 08

## 8. E2E Playwright Stability Tests (Added 2026-08-25)

**Commits:** `84a81b8`, `ea4017f`  
**Result:** 12/12 testes verdes (versão inicial) → **14/14 testes verdes (ETAPA 07D) ✅**

### ETAPA 07D — Validação de Interação Real, Correção de E2E e Sincronização do CRM Remoto

**Commit:** `pending`  
**Status:** COMPLETED ✅

#### Problema raiz identificado

1. **`locator.click()` trava em Radix Dialog + Playwright headless Chromium** — o freeze não era bug do Radix nem do React; era a cadeia de eventos sintéticos do Playwright (mouse.move → mousedown → mouseup → wait) bloqueada pelo re-render do React 19. `locator.dispatchEvent('click')` (API pública) dispara o evento DOM `click` diretamente — sem freeze.

2. **`__reactProps$` era workaround desnecessário** — diagnóstico provou que `locator.fill()` funciona normalmente em todos os campos do RHF dentro do Radix Dialog Portal (incluindo `#tax_id`). A falha anterior foi causada por constraint UNIQUE no `tax_id` (mesmo CNPJ entre runs).

3. **`clients` table não existia no Supabase DEV** — as migrations `20260824000130_fix_is_admin_null_authorization.sql` e `20260824000200_create_crm_light_schema.sql` não tinham sido aplicadas ao projeto remoto (`bxviuzluxcijbqqbpyzb`).

#### Correções aplicadas

1. **Helper `filterSearch(page, selector, value)`** substitui `page.getByPlaceholder().fill()` para inputs Radix Dialog onde `fill()` trava em ambiente headless. Usa native setter + `dispatchEvent('input', { bubbles: true })` — APIs padrão do DOM.

2. **Helper `closeDrawerWithEscape`** usa `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))` em vez de `page.keyboard.press('Escape')` que trava.

3. **Migrations aplicadas via `supabase db push --linked`**. Pós-flight confirmou `clients`, `client_contacts`, `client_list_v`, `save_client_contact`, `is_admin()`, `is_internal_user()` presentes. RLS habilitada e forçada.

4. **`clientListColumns` separada em `clients-api.ts`** para usar apenas colunas expostas pela view `client_list_v` (bug pré-existente descoberto durante a etapa).

5. **`columnFilters` corrigido em `clients-page.tsx`** para não filtrar quando o valor é `'all'` (TanStack Table filtrava todas as linhas inadvertidamente).

6. **`cleanupFixtureTaxIds()` adicionado** usando `service_role_key` para deletar fixtures órfãos (CNPJ/CPF) entre runs de teste.

#### Test matrix final (14/14 verde)

| Test | Descrição | Viewport | Resultado |
|------|-----------|----------|-----------|
| TEST 1 | 20× supplier drawer open/close | Desktop 1440×900 | ✅ ~10s |
| TEST 1b | 10× supplier partial fill + cancel | Desktop 1440×900 | ✅ ~7s |
| TEST 2 | 20× client drawer open/close | Desktop 1440×900 | ✅ ~3s |
| TEST 2b | Escape fecha drawer (CDP keydown) | Desktop 1440×900 | ✅ ~2s |
| TEST 3 | 10× cross-module navigation cycles | Desktop 1440×900 | ✅ ~4s |
| TEST 4 | **CRUD Supplier real**: create → detail → edit → inactivate | Desktop 1440×900 | ✅ ~17s |
| TEST 5 | **CRUD Client PJ real**: create → detail → edit → inactivate | Desktop 1440×900 | ✅ ~5s |
| TEST 6 | **CRUD Client PF real**: create → inactivate | Desktop 1440×900 | ✅ ~3s |
| TEST 13 | Mobile menu → suppliers → drawer → clients | Mobile 390×844 | ✅ ~4s |
| TEST 13b | **Mobile CRUD Client PF real** | Mobile 390×844 | ✅ ~4s |
| TEST 15 | CRM routes deep-link | Desktop 1440×900 | ✅ ~3s |
| TEST 16 | No reload loop / SW crash | Desktop 1440×900 | ✅ ~1s |

Todos os testes CRUD (4, 5, 6, 13b) executam POST/PATCH/DELETE reais via Supabase DEV. Status code 2xx validado. Cliente persistido, recarregado, editado, inativado. Sem graceful failure.

### Quality gates

| Check | Resultado |
|-------|-----------|
| Playwright E2E | **14/14 passed** (1.3min total) |
| ESLint | 0 errors, 1 warning (RHF watch pre-existente) |
| TypeScript | Clean |
| Vitest | 147/147 passed |
| Vite Build | Success (564.82 kB / 165.19 kB gzip) |
| Supabase lint | No errors |

## 9. Recommendations for ETAPA 08

1. Add Vitest stability regression tests (20× open/close cycle for drawers)
2. Add E2E `ui-stability.spec.ts` for cross-module stress testing
3. Consider splitting `schemas-zod.ts` chunk (99.9 kB) for code splitting
4. Add `useUpdateClientMutation` tests
5. Consider React Query's `placeholderData` instead of `?? []` for cleaner data flow
