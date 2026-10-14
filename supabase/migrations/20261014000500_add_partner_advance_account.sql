-- FIN-FIX-3.1: separate partner/admin advances from generic other credits.
-- Configuration only; historical transactions and journal rows are preserved.

begin;

insert into public.financial_chart_accounts (
  code,
  name,
  class,
  nature,
  posting,
  active,
  current_class,
  bp_group,
  dre_class,
  dfc_default,
  dva_class,
  is_cash,
  presentation_sign
)
values (
  '1.1.02.006',
  'Adiantamentos a Sócios e Administradores',
  'ATIVO',
  'DEBITO',
  true,
  true,
  'CIRCULANTE',
  'Creditos',
  '',
  'OPERACIONAL',
  '',
  false,
  1
)
on conflict (code) do update
set name = excluded.name,
    class = excluded.class,
    nature = excluded.nature,
    posting = excluded.posting,
    active = excluded.active,
    current_class = excluded.current_class,
    bp_group = excluded.bp_group,
    dre_class = excluded.dre_class,
    dfc_default = excluded.dfc_default,
    dva_class = excluded.dva_class,
    is_cash = excluded.is_cash,
    presentation_sign = excluded.presentation_sign,
    updated_at = now();

update public.financial_categories
set counter_account_id = (
      select id
      from public.financial_chart_accounts
      where code = '1.1.02.006'
    ),
    updated_at = now()
where id = 'cb191d40-b9f5-46c6-8f60-8844339c9697'::uuid;

commit;
