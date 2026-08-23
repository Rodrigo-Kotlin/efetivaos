# 06 — Learning Log

Registro de aprendizados técnicos e de produto obtidos durante a construção do Efetiva OS.

Este arquivo não substitui o Decision Register. Use-o para registrar descobertas, limitações, padrões e lições que possam melhorar as etapas seguintes.

---

## LL-001 — Separar server state de UI state

**Data:** 2026-08-23

**Aprendizado:** Dados persistentes do Supabase não devem ser duplicados em Zustand.

**Aplicação:** TanStack Query para server state; Zustand apenas para estado de UI compartilhado.

---

## LL-002 — Code-splitting precisa nascer com o projeto

**Data:** 2026-08-23

**Aprendizado:** Adiar code-splitting tende a gerar bundle monolítico e refatoração desnecessária.

**Aplicação:** Rotas modulares desde a Sprint 0.

---

## LL-003 — Segurança não deve ser adicionada depois

**Data:** 2026-08-23

**Aprendizado:** Como o sistema trabalhará com informações comerciais e financeiras, Auth/RLS deve existir antes dos CRUDs principais.

**Aplicação:** `profiles`, roles e RLS entram na Sprint 0.

---

## LL-004 — Texto de fornecedor não é chave de comparação confiável

**Data:** 2026-08-23

**Aprendizado:** Fornecedores podem nomear o mesmo exame/serviço de formas diferentes.

**Aplicação:** Catálogo canônico + `catalog_item_id`.

---

## LL-005 — Margem e markup não devem ser usados como sinônimos

**Data:** 2026-08-23

**Aprendizado:** “30% de margem” e “30% sobre custo” produzem valores diferentes.

**Aplicação:** No MVP utilizar explicitamente “acréscimo sobre custo”.

---

## LL-006 — Histórico deve ser preservado

**Data:** 2026-08-23

**Aprendizado:** Fornecedores, cotações e preços antigos possuem valor de rastreabilidade.

**Aplicação:** Preferir status/inativação e evitar hard delete de registros utilizados.

---

## LL-007 — Preço aprovado precisa ser estável

**Data:** 2026-08-23

**Aprendizado:** Automatizar a troca do preço comercial quando chega uma nova cotação pode gerar alteração silenciosa de preço usado em propostas/contratos.

**Aplicação:** Nova cotação gera sugestão/revisão; alteração exige aprovação explícita de Admin.

---

## LL-008 — Artefatos tecnicos esperados estavam ausentes

**Data:** 2026-08-23

**Contexto:** O inventario inicial nao encontrou `docs/02-projeto-tecnico-v0.3.docx`, `docs/03-handoff-v0.3.md`, wireframes do Motor nem o schema SQL citado como existente.

**Aprendizado:** O status documental do roadmap nao garante que todos os artefatos estejam materialmente presentes no repositorio.

**Aplicacao:** A Sprint 0 criou somente `profiles`, roles e RLS explicitamente definidos; nenhuma tabela funcional do Motor foi antecipada.

**Impacto futuro:** O schema aprovado e os documentos v0.3 devem ser recuperados antes da Sprint 1 para evitar modelagem divergente.

---

## LL-009 — Pages com Git deve nascer integrado

**Data:** 2026-08-23

**Contexto:** A Cloudflare diferencia projetos Pages com Git Integration e Direct Upload.

**Aprendizado:** Um projeto iniciado como Direct Upload nao pode ser convertido posteriormente para Git Integration.

**Aplicacao:** O deploy direto foi evitado; o projeto deve ser criado pelo fluxo Connect to Git apos a primeira branch ser publicada.

**Impacto futuro:** Preserva o pipeline GitHub para builds e deploys automaticos exigido pela arquitetura.

---

## LL-010 — IF NOT EXISTS não resolve incompatibilidade de contrato

**Data:** 2026-08-23

**Contexto:** O SQL v0.3 declarava `profiles.user_id`, enquanto a migration já aplicada usa `profiles.id`.

**Aprendizado:** `CREATE TABLE IF NOT EXISTS` evita erro de objeto duplicado, mas não adapta colunas, policies, grants, triggers ou funções que dependem de outro contrato.

**Aplicação:** Converter schemas recebidos em migrations incrementais após comparar todos os objetos existentes.

**Impacto futuro:** Todo novo pacote técnico deve ser revisado contra o histórico real de migrations antes de execução.

---

## LL-011 — RLS e grants precisam ser testados em conjunto

**Data:** 2026-08-23

**Contexto:** Um grant amplo de `UPDATE` em `profiles` permitiria que a policy de atualização própria alcançasse a coluna `role`.

**Aprendizado:** Uma policy correta não compensa privilégios de coluna excessivos; o contrato efetivo é a interseção de grants, RLS, triggers e RPCs.

**Aplicação:** Preservar `UPDATE (full_name)` em `profiles`, manter role em `set_user_role()` e testar tentativas reais de autopromoção com o perfil Equipe.

**Impacto futuro:** Testes RLS devem incluir operações negativas e verificar o efeito persistido, não apenas a existência das policies.

---

## LL-012 — Supabase local mínimo melhora a validação no Windows

**Data:** 2026-08-23

**Contexto:** Containers auxiliares de analytics/vector ficaram instáveis durante um reset do Docker Desktop.

**Aprendizado:** Para validar migrations e pgTAP, iniciar somente o banco reduz tempo, consumo e interferência de serviços não relacionados.

**Aplicação:** Usar `supabase start --exclude` com os serviços opcionais quando o objetivo for apenas schema, lint e testes SQL.

**Impacto futuro:** A validação local fica reproduzível mesmo sem subir toda a stack Supabase.

---

## Template para novos registros

```text
## LL-XXX — Título

**Data:** AAAA-MM-DD

**Contexto:**

**Aprendizado:**

**Aplicação:**

**Impacto futuro:**
```
