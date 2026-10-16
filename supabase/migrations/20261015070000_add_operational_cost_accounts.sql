-- FIN-IMPORT-2.5.2 — contas de custo operacional aprovadas para a matriz de fevereiro/2026.
-- Somente plano de contas; não cria categorias, transações ou partidas.

begin;

do $$
declare
  v_account record;
begin
  for v_account in
    select *
    from (values
      (
        '4.4.01.002'::text,
        'Uniformes, EPIs e Materiais da Operação de Bombeiro Civil'::text
      ),
      (
        '4.1.01.007'::text,
        'Aluguel e Ocupação da Unidade Clínica'::text
      )
    ) as approved(code, name)
  loop
    if exists (select 1 from public.financial_chart_accounts where code = v_account.code) then
      if not exists (
        select 1
        from public.financial_chart_accounts
        where code = v_account.code
          and name = v_account.name
          and class = 'CUSTO'
          and nature = 'DEBITO'
          and posting = true
          and active = true
          and dre_class = 'CUSTO_SERVICO'
          and dfc_default = 'OPERACIONAL'
          and is_cash = false
      ) then
        raise exception 'Existing account code % is incompatible with FIN-IMPORT-2.5.2', v_account.code;
      end if;
    else
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
      ) values (
        v_account.code,
        v_account.name,
        'CUSTO',
        'DEBITO',
        true,
        true,
        null,
        '',
        'CUSTO_SERVICO',
        'OPERACIONAL',
        'INSUMOS_TERCEIROS',
        false,
        1
      );
    end if;
  end loop;
end;
$$;

commit;
