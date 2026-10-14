-- FIN-FIX-3.1: preserve the approved Portuguese account name.

update public.financial_chart_accounts
set name = 'Adiantamentos a Sócios e Administradores',
    updated_at = now()
where code = '1.1.02.006';
