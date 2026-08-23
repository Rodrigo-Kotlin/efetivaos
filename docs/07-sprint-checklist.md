# 07 — Checklist de Sprint

Use este checklist ao iniciar e concluir cada etapa do Efetiva OS.

## Antes de iniciar

- [ ] Confirmar número e nome da sprint.
- [ ] Confirmar escopo autorizado.
- [ ] Ler `AGENTS.md`.
- [ ] Ler `docs/00-LEIA-PRIMEIRO.md`.
- [ ] Ler handoff mais recente.
- [ ] Revisar Decision Register.
- [ ] Revisar wireframes relacionados.
- [ ] Revisar migrations/schema relacionados.
- [ ] Identificar critérios de aceite da etapa.
- [ ] Confirmar branch de trabalho.

## Durante a implementação

- [ ] Não extrapolar o escopo autorizado.
- [ ] Manter componentes pequenos e coesos.
- [ ] Não duplicar server state em Zustand.
- [ ] Aplicar RLS para dados sensíveis.
- [ ] Não inserir secrets no repositório.
- [ ] Criar migrations para mudanças de banco.
- [ ] Implementar loading/empty/error states quando aplicável.
- [ ] Preservar rastreabilidade e histórico.
- [ ] Registrar decisões relevantes.
- [ ] Fazer commits pequenos e coerentes.

## Testes

- [ ] `npm run build` aprovado.
- [ ] TypeScript sem erros.
- [ ] Lint aprovado, se configurado.
- [ ] Testes unitários aprovados.
- [ ] Testes de integração aprovados quando aplicável.
- [ ] Auth validado quando afetado.
- [ ] RLS validado para Admin.
- [ ] RLS validado para Equipe.
- [ ] Usuário anônimo bloqueado onde necessário.
- [ ] Fluxo feliz validado.
- [ ] Cenários de erro relevantes validados.
- [ ] Responsividade mínima validada quando houver UI.

## Antes de concluir

- [ ] Atualizar `docs/04-decision-register.md` se necessário.
- [ ] Atualizar `docs/05-roadmap.md`.
- [ ] Atualizar `docs/06-learning-log.md` quando houver aprendizado relevante.
- [ ] Atualizar handoff se a milestone justificar.
- [ ] Verificar `git status`.
- [ ] Garantir ausência de secrets versionados.
- [ ] Informar último commit.
- [ ] Informar findings conhecidos.
- [ ] Informar somente o próximo passo recomendado.
- [ ] Não iniciar automaticamente a sprint seguinte.
