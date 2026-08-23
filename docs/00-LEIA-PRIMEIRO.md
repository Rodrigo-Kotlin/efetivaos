# 00 — LEIA PRIMEIRO

## Objetivo

Este documento orienta rapidamente qualquer pessoa ou agente que entre no projeto **Efetiva OS**.

O sistema já possui decisões funcionais e técnicas consolidadas. O trabalho deve continuar a partir delas, evitando reabrir assuntos já resolvidos sem motivo técnico relevante.

---

## 1. O que é o Efetiva OS

PWA interno de gestão administrativa da Efetiva SST.

O MVP é composto por:

- Motor de Preços;
- CRM leve;
- Financeiro;
- Dashboard básico.

O Motor de Preços é o primeiro módulo funcional a ser implementado.

---

## 2. Documentos-base

Arquivos esperados no repositório:

```text
docs/
├── 00-LEIA-PRIMEIRO.md
├── 01-especificacao-mvp-v0.2.docx
├── 02-projeto-tecnico-v0.3.docx
├── 03-handoff-v0.3.md
├── 04-decision-register.md
├── 05-roadmap.md
├── 06-learning-log.md
├── 07-sprint-checklist.md
└── wireframes/
```

Além disso:

```text
supabase/
├── migrations/
└── seed.sql
```

---

## 3. Fonte de verdade

Ordem de precedência:

1. Decision Register mais recente;
2. Projeto Técnico v0.3;
3. Especificação v0.2;
4. Handoff mais recente;
5. documentos anteriores.

A implementação deve refletir essa ordem.

---

## 4. Arquitetura aprovada

- React + TypeScript + Vite;
- Tailwind + shadcn/ui;
- TanStack Query;
- Zustand apenas para UI;
- TanStack Table;
- React Hook Form + Zod;
- Supabase PostgreSQL/Auth/RLS;
- Cloudflare Pages;
- PWA instalável;
- sem offline-first para dados transacionais;
- code-splitting por rota.

---

## 5. Motor de Preços — resumo funcional

Fluxo:

`Fornecedor → Cotação → Itens → Comparação → Regra de acréscimo → Preço sugerido → Revisão → Aprovação → Tabela de Preços`

Entidades principais:

- `suppliers`;
- `catalog_categories`;
- `catalog_items`;
- `quotations`;
- `quotation_items`;
- `margin_rules`;
- `price_list`;
- `profiles`.

---

## 6. Regras essenciais

- Catálogo Efetiva é canônico.
- Comparação por `catalog_item_id`.
- Cotação vencida continua no histórico e deixa de disputar menor preço.
- Cotação sem validade pode disputar com alerta.
- Menor custo vigente é sugerido.
- Admin pode escolher fonte alternativa válida.
- Nova cotação não altera preço aprovado automaticamente.
- Preço aprovado exige aprovação explícita de Admin.
- Regra de acréscimo: item → categoria → global.
- Acréscimo percentual ou fixo.
- Valores monetários em decimal/numeric.
- CUB/NR-4 fora do Motor v1.

---

## 7. Segurança

RLS é requisito de dia 1.

Perfis:

- `admin`;
- `equipe`.

A UI não substitui autorização de banco.

Nunca expor `service_role` no frontend.

---

## 8. Filosofia de implementação

O projeto deve avançar por gates pequenos.

Cada sprint:

- implementa escopo limitado;
- possui critérios de aceite;
- executa testes;
- atualiza documentação;
- realiza commits coerentes;
- termina antes de iniciar a sprint seguinte.

---

## 9. Primeira sequência técnica

1. Sprint 0 — bootstrap, Auth, profiles, RLS, App Shell, Cloudflare;
2. Sprint 1 — fornecedores + categorias + catálogo;
3. Sprint 2 — cotações + itens;
4. Sprint 3 — comparação + validade + filtros;
5. Sprint 4 — regras + cálculo + revisão;
6. Sprint 5 — tabela comercial + aprovação + rastreabilidade;
7. Sprint 6 — dashboard básico + QA + PWA.

---

## 10. Antes de qualquer alteração

Confirme:

- qual etapa está autorizada;
- quais documentos se aplicam;
- quais arquivos serão modificados;
- quais critérios de aceite devem ser validados.

Se houver dúvida funcional relevante, não invente regra nova.
