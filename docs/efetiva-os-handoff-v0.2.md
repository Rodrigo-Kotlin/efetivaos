# Handoff — Projeto Efetiva OS v0.2

## Contexto
Efetiva OS é um PWA interno de gestão administrativa da Efetiva SST, separado do sistema Efetiva Gestão. O MVP permanece focado em CRM leve, Financeiro, Motor de Preços e Dashboard básico.

## Decisões preservadas
- Stack: React + TypeScript + Vite + Tailwind + Supabase + Cloudflare Pages.
- Multiusuário desde o início.
- Supabase Auth + RLS obrigatório em todas as tabelas sensíveis.
- Sem offline-first no MVP.
- PWA instalável com manifest completo e service worker simples.
- Code-splitting por rota desde a primeira versão.
- Nome “Efetiva OS” continua provisório.

## Arquitetura de frontend revisada
- TanStack Query para server state e sincronização com Supabase.
- Zustand apenas para estado local/compartilhado de UI.
- TanStack Table para tabelas operacionais.
- React Hook Form + Zod para formulários/validação.
- shadcn/ui como base de componentes, customizada pelos tokens Efetiva.

## Motor de Preços — baseline funcional v1
Fluxo: fornecedor → cotação → itens → comparação → regra de acréscimo → preço sugerido → revisão → aprovação → tabela comercial.

### Entidades do Motor
- `suppliers`
- `catalog_categories`
- `catalog_items`
- `quotations`
- `quotation_items`
- `margin_rules`
- `price_list`

### Decisões funcionais fechadas
1. Cotação é cabeçalho/documento e pode conter vários itens.
2. Comparação acontece por `catalog_item_id`, nunca apenas pelo texto do fornecedor.
3. Catálogo Efetiva é a referência canônica para itens/serviços.
4. No MVP usar o termo **acréscimo sobre custo**, não “margem” genérica.
5. Tipos de acréscimo: percentual sobre custo ou valor fixo.
6. Prioridade das regras: item → categoria → global.
7. Cotação vencida permanece no histórico, mas não participa da comparação.
8. Cotação sem validade informada pode participar, mas deve exibir alerta permanente.
9. O menor custo vigente é sugerido automaticamente.
10. Admin pode selecionar outra fonte elegível; sistema registra seleção manual.
11. Nova cotação nunca altera silenciosamente um preço já aprovado.
12. Preço aprovado exige ação explícita de Admin.
13. Se a fonte aprovada vencer ou surgir mudança relevante, o preço passa para “revisão necessária”, sem ser apagado.
14. Cada preço aprovado deve rastrear `source_quotation_item_id`, regra usada, custo, acréscimo, aprovador e data.
15. Valores monetários devem usar `numeric/decimal`, nunca float.
16. CUB + grau de risco NR-4 ficam na Fase 2.
17. Arquivo original da cotação pode ser anexado como referência; sem OCR/IA no MVP.

## Perfis do Motor
### Admin
- CRUD lógico de fornecedores, catálogo e cotações.
- Gerencia regras de acréscimo.
- Visualiza comparação.
- Pode selecionar fonte alternativa.
- Aprova/atualiza/inativa preço comercial.

### Equipe
- Cadastra fornecedores, catálogo e cotações.
- Visualiza comparação e tabela de preços.
- Não altera regras comerciais.
- Não aprova preço final.

## Navegação sugerida do Motor
- Comparação
- Tabela de Preços
- Cotações
- Fornecedores
- Catálogo
- Regras de preço (Admin)

## Fórmulas do MVP
- Percentual: `preço = custo × (1 + percentual / 100)`
- Fixo: `preço = custo + acréscimo_fixo`
- Persistência monetária em duas casas; cálculo com tipo decimal/numeric.

## Estados principais
### Cotação
- draft
- active
- cancelled
- vencimento é derivado por data

### Price list
- approved
- review_required
- inactive

## Fora do escopo do Motor v1
- OCR/IA de cotações.
- Importação inteligente de planilhas arbitrárias.
- Portal do fornecedor.
- Histórico analítico/gráficos de variação.
- Cálculo por margem bruta sobre venda.
- CUB/NR-4.
- Integração automática completa com contratos.

## Próximo passo recomendado
1. Modelar schema SQL/Supabase completo do Motor de Preços.
2. Definir constraints, índices e políticas RLS.
3. Produzir wireframes das seis telas principais.
4. Só então iniciar implementação React por sprints incrementais.

## Documento de referência
`EFETIVA_OS_Especificacao_MVP_v0.2_Motor_de_Precos.docx`
