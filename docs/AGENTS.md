# AGENTS.md — Efetiva OS

## 1. Finalidade deste arquivo

Este arquivo define as regras obrigatórias para qualquer agente de IA ou desenvolvedor que trabalhe no repositório **Efetiva OS**.

Antes de criar, alterar, remover ou refatorar código, banco de dados, documentação, infraestrutura ou interface, leia este arquivo e os documentos indicados na seção **Ordem obrigatória de leitura**.

O objetivo é evitar divergências entre especificação funcional, banco, interface e implementação.

---

## 2. Contexto do produto

O **Efetiva OS** é um PWA interno de gestão administrativa da Efetiva SST.

O MVP possui quatro módulos principais:

1. Motor de Preços;
2. CRM leve;
3. Financeiro;
4. Dashboard básico.

O primeiro módulo funcional a ser implementado é o **Motor de Preços**.

O Efetiva OS é um produto novo e separado do sistema **Efetiva Gestão**.

---

## 3. Ordem obrigatória de leitura

Antes de iniciar uma tarefa relevante, leia nesta ordem:

1. `AGENTS.md`;
2. `docs/00-LEIA-PRIMEIRO.md`;
3. `docs/09-handoff-sprint-00.md`;
4. `docs/03-handoff-v0.3.md`;
5. `docs/02-projeto-tecnico-v0.3.docx`;
6. `docs/01-especificacao-mvp-v0.2.docx`;
7. `docs/04-decision-register.md`;
8. `docs/05-roadmap.md`;
9. wireframes relacionados à tela ou fluxo em implementação;
10. migrations e schema existentes em `supabase/`.

Se algum arquivo ainda não estiver presente no repositório, registre isso no relatório da etapa e não invente seu conteúdo.

---

## 4. Hierarquia de precedência

Em caso de conflito entre documentos, aplicar a seguinte ordem:

1. decisão mais recente registrada no `docs/04-decision-register.md`;
2. Projeto Técnico v0.3;
3. Especificação funcional v0.2;
4. Handoff mais recente;
5. documentos anteriores;
6. código existente, quando não contrariar documentação superior.

Nunca resolver conflito silenciosamente.

Quando houver conflito:

- registrar o conflito;
- interromper apenas a parte afetada;
- indicar os documentos conflitantes;
- propor opções técnicas;
- aguardar decisão quando houver impacto funcional, de segurança, dados ou arquitetura.

---

## 5. Decisões arquiteturais fechadas

Não reabrir ou substituir sem decisão explícita registrada:

- React;
- TypeScript;
- Vite;
- Tailwind CSS;
- shadcn/ui como base de componentes;
- TanStack Query para server state;
- Zustand apenas para estado de UI compartilhado;
- TanStack Table para tabelas operacionais;
- React Hook Form;
- Zod;
- Supabase PostgreSQL;
- Supabase Auth;
- Row Level Security obrigatório;
- Cloudflare Pages;
- PWA instalável;
- sem offline-first para dados transacionais no MVP;
- code-splitting por rota desde o início.

Não substituir bibliotecas apenas por preferência pessoal.

---

## 6. Regras do Motor de Preços que não devem ser alteradas

O fluxo funcional oficial é:

`fornecedor → cotação → itens → comparação → regra de acréscimo → preço sugerido → revisão → aprovação → tabela comercial`

Regras essenciais:

1. Cotação é um cabeçalho/documento e pode possuir vários itens.
2. O Catálogo Efetiva é a referência canônica.
3. A comparação ocorre por `catalog_item_id`, nunca apenas por texto livre.
4. No MVP usar a expressão **acréscimo sobre custo**, não margem genérica.
5. Tipos de acréscimo: percentual ou valor fixo.
6. Prioridade: item → categoria → global.
7. Cotação vencida permanece no histórico, mas não participa da comparação.
8. Cotação sem validade pode participar com alerta permanente.
9. O menor custo vigente é sugerido automaticamente.
10. Admin pode selecionar outra fonte elegível; a seleção deve ser rastreada.
11. Nova cotação nunca altera silenciosamente preço aprovado.
12. Aprovação exige ação explícita de Admin.
13. Fonte vencida ou mudança relevante pode gerar `review_required`.
14. Preço aprovado deve rastrear origem, regra, custo, acréscimo, aprovador e data.
15. Valores monetários devem usar `numeric/decimal`, nunca `float`.
16. CUB + grau de risco NR-4 ficam fora do Motor v1.
17. Arquivo original da cotação pode ser armazenado apenas como referência no MVP; sem OCR/IA.

---

## 7. Perfis e autorização

### Admin

Pode:

- gerenciar fornecedores, catálogo e cotações;
- criar e alterar regras de acréscimo;
- visualizar comparação;
- selecionar fonte alternativa;
- aprovar, atualizar e inativar preço comercial.

### Equipe

Pode:

- cadastrar e editar fornecedores permitidos;
- cadastrar e editar catálogo conforme política;
- cadastrar e editar cotações em fluxos permitidos;
- visualizar comparação e tabela de preços.

Não pode:

- alterar regras comerciais;
- aprovar preço final.

As restrições devem existir no banco via RLS e não apenas na interface.

---

## 8. Regras de estado e dados

### Supabase

É a fonte persistente dos dados.

### TanStack Query

Usar para:

- consultas;
- mutations;
- cache controlado;
- invalidação;
- sincronização com Supabase.

### Zustand

Usar somente para estado de interface que realmente precise ser compartilhado.

Não duplicar server state do Supabase em Zustand.

---

## 9. Segurança obrigatória

- Supabase Auth desde a Sprint 0.
- RLS obrigatório em todas as tabelas sensíveis.
- Usuário anônimo não deve acessar dados protegidos.
- Nunca expor `service_role` no frontend.
- Nunca versionar tokens, chaves privadas ou segredos.
- `.env.local` deve estar no `.gitignore`.
- Apenas variáveis públicas apropriadas podem existir no frontend.
- Storage de cotações deve ser privado.
- Não confiar em ocultação de botão como mecanismo de segurança.

---

## 10. Banco de dados e migrations

Toda alteração estrutural deve ser versionada em `supabase/migrations/`.

Antes de alterar schema:

1. verificar migrations existentes;
2. verificar constraints;
3. verificar índices;
4. verificar FKs;
5. verificar triggers;
6. verificar views;
7. verificar RPCs/functions;
8. verificar RLS;
9. avaliar impacto no histórico.

Evitar hard delete em registros utilizados historicamente.

Não alterar banco apenas pelo painel do Supabase quando a mudança puder ser representada por migration.

---

## 11. UI/UX

Diretrizes obrigatórias:

- dashboard em modelo launcher/resumo;
- telas operacionais em abordagem table-first;
- sidebar colapsável no desktop;
- drawer no mobile;
- busca e filtros nas listagens operacionais;
- loading com skeleton;
- estados vazios com CTA contextual;
- estados de erro com ação de recuperação;
- badges com texto/ícone, nunca somente cor;
- preço aprovado não pode parecer atualizado se ainda estiver em revisão;
- responsividade sem sacrificar a operação desktop-first;
- usar wireframes existentes como referência antes de implementar a tela.

---

## 12. PWA

O sistema deve ser instalável, mas não offline-first no MVP.

Permitido cachear:

- app shell;
- assets estáticos;
- ícones;
- fontes quando apropriado.

Não cachear agressivamente:

- cotações;
- preços;
- clientes;
- contratos;
- financeiro;
- demais dados transacionais.

Quando offline, informar que operações de dados estão indisponíveis.

---

## 13. Organização do código

Preferir organização por feature.

Estrutura de referência:

```text
src/
├── app/
├── components/
│   ├── ui/
│   └── shared/
├── features/
│   ├── auth/
│   └── pricing/
│       ├── comparison/
│       ├── quotations/
│       ├── suppliers/
│       ├── catalog/
│       ├── margin-rules/
│       └── price-list/
├── hooks/
├── lib/
├── routes/
├── services/
├── stores/
├── styles/
└── types/
```

Evitar:

- componentes gigantes;
- arquivos com múltiplas responsabilidades;
- lógica de negócio relevante dentro de JSX;
- acesso direto ao Supabase espalhado em componentes;
- duplicação de tipos;
- rotas sem lazy loading quando aplicável.

---

## 14. Qualidade e testes

Antes de concluir uma etapa:

- `npm run build` deve passar;
- TypeScript sem erros;
- lint/testes configurados devem passar;
- testar Auth e proteção de rotas;
- testar RLS com pelo menos Admin e Equipe;
- validar cenários funcionais relacionados à etapa;
- validar empty/loading/error states quando houver UI;
- manter working tree limpo ou explicar pendências.

---

## 15. Git e commits

Preferir commits pequenos e coerentes.

Exemplos:

```text
chore: bootstrap vite typescript project
chore: configure supabase client
feat: implement auth flow
feat: add protected app shell
feat: add supplier catalog foundation
fix: enforce quotation activation constraints
docs: update decision register
```

Não usar um único commit para uma sprint inteira quando houver mudanças independentes.

---

## 16. Atualização obrigatória de documentação

Quando houver decisão técnica relevante:

- registrar em `docs/04-decision-register.md`;
- atualizar `docs/05-roadmap.md` se houver mudança de status;
- registrar aprendizado ou descoberta relevante em `docs/06-learning-log.md`;
- atualizar handoff ao final de milestones significativos.

Nunca alterar requisito funcional aprovado sem registrar a mudança.

---

## 17. Regra de execução por gates

Não implementar o sistema inteiro em uma única execução.

Cada etapa deve:

1. ler contexto;
2. implementar somente o escopo autorizado;
3. testar;
4. documentar;
5. fazer commits;
6. apresentar relatório;
7. parar.

Não iniciar automaticamente a etapa seguinte.

---

## 18. Formato de relatório final de etapa

Usar:

```text
## ETAPA XX — STATUS
COMPLETED | COMPLETED_WITH_FINDINGS | BLOCKED

## Escopo executado
...

## Git
Branch e último commit.

## Banco/Supabase
...

## Testes
...

## Arquivos principais alterados
...

## Decisões registradas
...

## Findings
...

## Próximo passo recomendado
...
```

Não avançar além do próximo passo recomendado sem autorização.
