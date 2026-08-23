# Handoff — Projeto Efetiva OS

Estou continuando o projeto **Efetiva OS**, sistema PWA de gestão administrativa interna da Efetiva SST (consultoria de saúde e segurança do trabalho em Santarém, PA). Sou Rodrigo, desenvolvedor e técnico de segurança (SST). Aqui está o que já foi decidido e produzido — continue a partir daqui, sem reabrir decisões já fechadas.

## Contexto do negócio
- Empresa: Efetiva SST (consultoria SST) + marca Ativerso Soluções Digitais (produtos de software).
- Já existem 3 PWAs de campo: Risco360, FireCheck, RiskFlow.
- Existe também um ERP separado, **Efetiva Gestão** (React 19 + Vite + TS + Supabase, MD3 tokens), que já passou por auditoria de UI/UX com problemas identificados (bundle monolítico de ~900KB, service worker de auto-update arriscado, cache raso, gaps de manifest).
- **Efetiva OS é um sistema NOVO, separado do Efetiva Gestão** — decisão explícita, não é continuação/refatoração dele.

## Decisões já fechadas
- **Escopo do MVP**: Financeiro (entradas/saídas) + CRM leve (clientes/contratos) + Motor de Preços (novo módulo, ver abaixo).
- **Usuários**: Rodrigo (admin) + equipe pequena da Efetiva (perfil "equipe"). Multiusuário desde o dia 1.
- **Autenticação/segurança**: Supabase Auth + Row Level Security obrigatório em todas as tabelas financeiras — requisito de dia 1, não item futuro.
- **Sem offline-first no MVP**: é sistema de escritório, diferente dos PWAs de campo. Decisão registrada para evitar complexidade desnecessária.
- **Stack**: React + TypeScript + Vite + Tailwind + Zustand + Supabase + Cloudflare Pages (mesma base dos outros produtos).
- **Aprendizado aplicado do audit do Efetiva Gestão**: code-splitting por rota desde o início, manifest completo com ícones PNG (não só SVG).
- **Nome do sistema**: "Efetiva OS" é título de trabalho, ainda não definitivo.

## Módulos do MVP (Fase 1)
1. **CRM leve** — clientes, contratos vinculados a cliente (serviço, valor, recorrência, vigência, status).
2. **Financeiro** — lançamentos de entrada/saída, categorias, vínculo opcional a contrato, fluxo de caixa mensal.
3. **Motor de Preços** (adicionado nesta sessão) — cadastro de fornecedores, registro de cotações/preços recebidos por item ou serviço, comparação automática para identificar melhor valor, regras de margem (% ou fixa) por categoria/item, cálculo automático do valor de repasse ao cliente, tabela consolidada de preços prontos para uso em contratos.
4. **Dashboard** — saldo atual, contratos ativos, recebíveis pendentes, alertas de vencimento.

## Modelo de dados (alto nível, já no documento de especificação)
`clients` · `contracts` · `financial_entries` · `financial_categories` · `pricing_table` (precificação por grau de risco NR-4/CUB, prevista para Fase 2 completa) · `suppliers` · `supplier_quotes` · `margin_rules` · `price_list` · `profiles` (controla RLS)

## Roadmap
- **Fase 1 (MVP)**: CRM leve + Financeiro + Motor de Preços + Dashboard básico + Auth/RLS.
- **Fase 2**: DRE simplificado, alertas de vencimento, exportação CSV/PDF, precificação completa por NR-4/CUB, histórico de variação de preço por fornecedor.
- **Fase 3**: Portal do cliente, integrações bancárias, automações de cobrança.

## Entregáveis já produzidos
1. `efetiva-os-especificacao-mvp.docx` — documento de especificação completo (visão geral, perfis de acesso, escopo funcional, modelo de dados, arquitetura, roadmap, requisitos não funcionais, decisões em aberto).
2. `efetiva-os-dashboard-prototipo.html` — protótipo do dashboard interno, estilo "painel de instrumentação" (sidebar escura, cards com TAG tipo FIN-001/CRM-001, tipografia Space Grotesk + JetBrains Mono, paleta clara com acentos mint/amber/red).
3. `efetiva-os-homepage.png` — mockup da tela inicial estilo SaaS moderno/launcher (Google Workspace-like): saudação personalizada, busca, ações rápidas, grid de módulos coloridos, atividade recente, destaque de alertas do Motor de Preços.

## Decisões ainda em aberto (não decidir sozinho — perguntar ao Rodrigo)
- Se a precificação completa (CUB + grau de risco NR-4) entra na v1 ou fica simplificada para a Fase 2.
- Se contratos recorrentes geram lançamento financeiro automático ou exigem confirmação manual.
- Se a margem no Motor de Preços é única para toda a Efetiva ou configurável por categoria/item.
- Se cotações vencidas (fora da validade) somem da comparação automaticamente ou ficam sinalizadas para revisão manual.
- Nome definitivo do sistema (hoje "Efetiva OS").

## Próximo passo natural
Modelar o schema do Supabase (tabelas, relacionamentos, políticas de RLS) a partir do modelo de dados acima, ou seguir para wireframes das telas de CRM e Motor de Preços — o que o Rodrigo pedir primeiro.
