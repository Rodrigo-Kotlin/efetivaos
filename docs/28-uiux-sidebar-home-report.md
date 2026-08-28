# UI/UX REVIEW — Sidebar + Home

## Arquivos alterados

| Arquivo | Alteração | Motivo |
|---------|-----------|--------|
| `src/app/app-shell.tsx` | Refatorado: navigationGroups, SidebarContent com accordion, label de grupo | Nova hierarquia de navegação |
| `src/routes/home-page.tsx` | Atualizado: MetricCard, ModuleStatusBadge, grid fluido, métricas | Home com métricas e grid responsivo |
| `src/components/shared/metric-card.tsx` | Novo: componente reutilizável | Cards de métricas na Home |
| `src/components/shared/module-status.tsx` | Novo: helper + badge tipado | Status semântico dos módulos |
| `src/app/app-shell.test.tsx` | Novo: 7 testes sidebar | Cobertura sidebar |
| `src/routes/home-page.test.tsx` | Novo: 5 testes Home | Cobertura Home |
| `src/components/shared/metric-card.test.tsx` | Novo: 4 testes MetricCard | Cobertura MetricCard |
| `src/components/shared/module-status.test.tsx` | Novo: 7 testes ModuleStatus | Cobertura ModuleStatus |

## Sidebar

- **Grupos criados**: Principal, Comercial, Financeiro, Demonstracoes, Patrimonio e Controle, Cadastros
- **Colapsável**: sim — click no header expande/recolhe, `aria-expanded`, transição CSS
- **Colapsada (76px)**: sem labels de grupo, sem texto de itens, apenas ícones centralizados + tooltip
- **Mobile**: Radix Dialog com `forceExpanded`, grupos colapsáveis, fecha após navegação
- **Active group**: grupo contendo a rota ativa é aberto automaticamente (useEffect + useLocation)
- **adminOnly preservado**: Regras de Preço e Ajustes filtrados por `profile?.role === 'admin'`
- **Nenhum item duplicado, nenhuma rota nova**

## Home

- **Saudação**: preservada — "Bom dia/Boa tarde/Boa noite, {firstName}"
- **Métricas utilizadas**:
  - Cotações abertas (draft) — fonte: `useQuotations()` existente
  - Clientes ativos — fonte: `useClientLists({ status: 'active' })` existente
  - Módulos disponíveis — calculado localmente
- **Placeholders/TODOs**: nenhum — todas as métricas usam APIs existentes
- **Skeletons**: exibidos durante `isLoading`

## Module Status

| Status | Label | Cor |
|--------|-------|-----|
| `available` | Disponivel | verde semântico |
| `in_progress` | Em desenvolvimento | azul |
| `planned` | Planejado | cinza neutro |
| `disabled` | Indisponivel | cinza discreto |

Helper: `getModuleStatusConfig(status)` retorna `{ label, className }`.

## Grid

- Implementado com `grid-cols-[repeat(auto-fit,minmax(220px,1fr))]`
- Gap: 3 (0.75rem)
- Cards com borda, sombra mínima, hover translate

## Permissões

**Nenhuma regra de autorização foi alterada.** `adminOnly` preservado para Regras de Preço e Ajustes.

## Backend

**Nenhuma migration, RPC, tabela ou API backend foi criada ou alterada.**

## Testes

| Métrica | Valor |
|---------|-------|
| Baseline | 273 |
| Novos | 23 |
| Total | 296 |
| Passed | 296 |
| Failed | 0 |
| TypeScript | 0 erros novos |
| Build | PASS |

### Testes adicionados

1. Sidebar: renderiza grupos
2. Sidebar: auto-expande grupo da rota ativa
3. Sidebar: admin vê itens adminOnly
4. Sidebar: equipe não vê itens adminOnly
5. Sidebar: colapsa grupo no click
6. Sidebar: collapsed esconde labels
7. Sidebar: collapsed esconde texto
8. Home: saudação com primeiro nome
9. Home: métricas sem número fictício
10. Home: grid renderiza módulos
11. Home: badges de status
12. Home: skeleton durante loading
13. MetricCard: renderiza label e valor
14. MetricCard: renderiza supporting text
15. MetricCard: skeleton quando loading
16. MetricCard: renderiza com ícone
17. ModuleStatus: available label
18. ModuleStatus: in_progress label
19. ModuleStatus: planned label
20. ModuleStatus: disabled label
21. ModuleStatus: config available
22. ModuleStatus: config in_progress
23. ModuleStatus: config planned

## Diff Summary

| Arquivo | + | - |
|---------|---|---|
| `src/app/app-shell.tsx` | ~220 | ~28 |
| `src/routes/home-page.tsx` | ~70 | ~15 |
| `src/components/shared/metric-card.tsx` | ~30 | 0 |
| `src/components/shared/module-status.tsx` | ~45 | 0 |
| `src/app/app-shell.test.tsx` | ~120 | 0 |
| `src/routes/home-page.test.tsx` | ~85 | 0 |
| `src/components/shared/metric-card.test.tsx` | ~35 | 0 |
| `src/components/shared/module-status.test.tsx` | ~45 | 0 |
| **Total** | **~650** | **~43** |

## Git

**Nenhum commit/push realizado.**

## Próximo passo

**Aguardar revisão visual e autorização para commit/deploy.**

PARAR.
