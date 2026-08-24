-- Supabase pode materializar grants padrao para anon/authenticated depois da
-- criacao das funcoes. Mantemos executaveis apenas os contratos de aplicacao.
revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_internal_user() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.set_user_role(uuid, public.app_role) from public, anon;
revoke execute on function public.resolve_margin_rule(uuid) from public, anon;
revoke execute on function public.price_decision_token(uuid) from public, anon;
revoke execute on function public.approve_price(uuid, text, uuid) from public, anon;
revoke execute on function public.inactivate_price(uuid, text) from public, anon;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.assert_active_quotation_integrity(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_quotation_integrity_deferred() from public, anon, authenticated;
