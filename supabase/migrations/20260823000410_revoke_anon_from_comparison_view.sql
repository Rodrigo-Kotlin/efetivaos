-- ============================================================================
-- EFETIVA OS - Sprint 3 / Motor de Precos
-- Ajuste defensivo de grants sobre a view de comparacao
--
-- A migration 20260823000400 concedeu SELECT para authenticated e, por
-- cascata, para anon atraves do GRANT padrao de PUBLIC. A view usa
-- security_invoker = true, entao o SELECT efetivo de anon e bloqueado
-- pelos privilegios ausentes sobre as views base. Este arquivo explicita
-- a defesa em profundidade revogando anon, public e demais roles nao
-- explicitamente autorizados.
-- ============================================================================

begin;

revoke select on public.comparison_current_v from anon;
revoke select on public.comparison_current_v from public;

commit;
