# CRM DESIGN BASELINE v1

## Status

- Etapa: CRM 09A
- Fonte visual: `docs/wireframes/crm-comercial-mock.html`
- Screenshots de referência: `docs/wireframes/mock-01..06-*.png`
- Modelo: SPA auto-contido, sem backend, dados fictícios demonstrativos.

## Principio

> **O mock define a apresentação.**
> **O CRM existente define o comportamento.**

> O mock é referência de apresentação; regras funcionais permanecem definidas pela implementação CRM 08A–08D.

Quando houver conflito entre o mock e a regra funcional existente, a regra funcional existente vence. Não degradar função para copiar pixel do mock.

## Escopo da referência visual

O mock é tratado como referência de:

- densidade;
- espaçamento;
- hierarquia visual;
- proporções;
- cards;
- header;
- KPIs;
- Kanban;
- Lista;
- drawers;
- filtros;
- indicadores;
- mobile.

## Token visual

- Verde Efetiva primário: `#0B6B3A` (`--color-efetiva`)
- Verde claro de apoio: `#A6CE39` (`--color-efetiva-light`)
- Background principal: off-white `#f4f6f3` (fundo gera em `src/styles/globals.css`)
- Cards: brancos
- Texto: slate / preto suave
- Border: sutil (`slate-200`)
- Shadow: mínima
- Radius: moderado
- Verde usado como acento apenas, sem pintar colunas inteiras do Kanban.

Evitar: gradientes, glassmorphism, neon, cards excessivamente elevados, muitas cores, grandes áreas verdes, visual Trello pesado.

## Hierarquia visual (Opportunity Card)

1. Cliente
2. Título da oportunidade
3. Valor
4. Próxima atividade
5. Aging
6. Responsável

Não adicionar informações além das já existentes.

## Atividade (status semantic)

Regras reais preservadas: `overdue | today | upcoming | none`.

Visual:
- Atrasada: alerta discreto (vermelho, ícone)
- Hoje: atenção moderada (âmbar, ícone)
- Upcoming: neutro
- None: cinza
Texto/ícone obrigatório; não depender apenas de cor.

## Aging

Regra de cálculo preservada (baseline 0–3 normal, 4–7 atenção, 8+ alto).

Ajuste apenas o estilo visual para equivalência com o mock (`X dias nesta etapa`).

## Kanban

5 etapas preservadas:

- Novo contato
- Qualificação
- Diagnóstico
- Proposta
- Negociação

Headers: `ETAPA` com `quantidade · valor`. Evitar caixas coloridas por coluna.

## Drawer de oportunidade

Ordem funcional (hierarquia recomendada):

1. Header
2. Próxima atividade
3. Resumo
4. Contato
5. Timeline

Ações operacionais preservadas (Concluir, Reagendar, + Atividade, Ganha, Perdida). A próxima atividade continua sendo a área operacional mais perceptível.

## Indicadores

Fonte real: `get_crm_pipeline_analytics()`. Não inventar dados.

Exibe: pipeline, ponderado, ganhas, perdidas, conversão, funil por etapa, tempo por etapa, motivos de perda, previsão comercial.

Label fixo: **Previsão comercial** (nunca "Receita prevista" — CRM separado do Financeiro).

## Lista

10 colunas funcionais preservadas, estilo equivalente ao mock (header pequeno uppercase, rows compactas, bordas discretas). Mobile permanece em cards, sem tabela horizontal em 390px.

## Não copiar dados fictícios

Os registros demonstrados no mock (Arati, Grupo Das Neves, Norte Logística, etc.) são apenas conteúdo demonstrativo. NÃO inserir na produção. A aplicação real continua usando Supabase.

## Arquivos de referência

- Mock: `docs/wireframes/crm-comercial-mock.html`
- Screenshots: `docs/wireframes/mock-01..06-*.png`
- Fonte de tokens: `src/styles/globals.css`
- Interface real representada: `src/features/crm/pages/crm-page.tsx`

## Revisões

- v1 — CRM 09A — alinhamento visual do CRM real ao mock aprovado, preservando a arquitetura funcional (Pipeline, Activities First, Lista, Intelligence, segurança, histórico, mobile).
