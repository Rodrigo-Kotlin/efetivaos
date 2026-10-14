-- FIN-FIX-3.2: restore structural account validation for asset creation.
-- No historical assets, transactions, or journal rows are modified.

begin;

create or replace function public.validate_asset_accounts(
  p_asset_account_id uuid,
  p_accumulated_account_id uuid,
  p_expense_account_id uuid
)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_class public.financial_account_class;
  v_nature public.financial_nature;
  v_current_class public.financial_current_class;
  v_bp_group text;
  v_dre_class text;
  v_is_cash boolean;
  v_posting boolean;
begin
  if p_asset_account_id is not null then
    select ca.class, ca.nature, ca.current_class, ca.bp_group,
           ca.is_cash, ca.posting
      into v_class, v_nature, v_current_class, v_bp_group,
           v_is_cash, v_posting
    from public.financial_chart_accounts ca
    where ca.id = p_asset_account_id and ca.active = true;

    if not found then
      raise exception 'Conta de imobilizado nao encontrada ou inativa';
    end if;

    if v_class is distinct from 'ATIVO'
       or v_current_class is distinct from 'NAO_CIRCULANTE'
       or v_bp_group is distinct from 'Imobilizado'
       or v_is_cash is distinct from false
       or v_posting is not true then
      raise exception 'Conta de imobilizado deve ser um ativo nao circulante de imobilizado';
    end if;
  end if;

  if p_accumulated_account_id is not null then
    select ca.class, ca.nature, ca.current_class, ca.bp_group,
           ca.is_cash, ca.posting
      into v_class, v_nature, v_current_class, v_bp_group,
           v_is_cash, v_posting
    from public.financial_chart_accounts ca
    where ca.id = p_accumulated_account_id and ca.active = true;

    if not found then
      raise exception 'Conta de depreciacao acumulada nao encontrada ou inativa';
    end if;

    if v_class is distinct from 'ATIVO'
       or v_nature is distinct from 'CREDITO'
       or v_current_class is distinct from 'NAO_CIRCULANTE'
       or v_bp_group is distinct from 'Imobilizado'
       or v_is_cash is distinct from false
       or v_posting is not true then
      raise exception 'Conta de depreciacao acumulada deve ser contra-ativo de imobilizado';
    end if;
  end if;

  if p_expense_account_id is not null then
    select ca.class, ca.nature, ca.dre_class, ca.is_cash, ca.posting
      into v_class, v_nature, v_dre_class, v_is_cash, v_posting
    from public.financial_chart_accounts ca
    where ca.id = p_expense_account_id and ca.active = true;

    if not found then
      raise exception 'Conta de despesa de depreciacao nao encontrada ou inativa';
    end if;

    if v_class is distinct from 'DESPESA'
       or v_nature is distinct from 'DEBITO'
       or v_dre_class is distinct from 'DEPRECIACAO_AMORTIZACAO'
       or v_is_cash is distinct from false
       or v_posting is not true then
      raise exception 'Conta de despesa de depreciacao deve ser uma despesa de depreciacao ativa';
    end if;
  end if;
end;
$$;

create or replace function public.create_asset(
  p_asset_code text,
  p_name text,
  p_description text default null,
  p_category text default null,
  p_acquisition_date date default current_date,
  p_acquisition_value numeric default 0,
  p_residual_value numeric default 0,
  p_useful_life_months integer default 60,
  p_depreciation_start_date date default null,
  p_location text default null,
  p_responsible text default null,
  p_serial_number text default null,
  p_patrimony_number text default null,
  p_notes text default null,
  p_asset_chart_account_id uuid default null,
  p_accumulated_depreciation_account_id uuid default null,
  p_depreciation_expense_account_id uuid default null,
  p_cost_center_id uuid default null,
  p_service_line_id uuid default null,
  p_party_id uuid default null,
  p_acquisition_transaction_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if public.is_admin() is not true then
    raise exception 'Apenas administradores podem cadastrar ativos';
  end if;

  if p_acquisition_value <= 0 then
    raise exception 'Valor de aquisicao deve ser maior que zero';
  end if;

  if p_residual_value < 0 then
    raise exception 'Valor residual nao pode ser negativo';
  end if;

  if p_residual_value > p_acquisition_value then
    raise exception 'Valor residual nao pode exceder valor de aquisicao';
  end if;

  if p_useful_life_months <= 0 then
    raise exception 'Vida util deve ser maior que zero meses';
  end if;

  perform public.validate_asset_accounts(
    p_asset_chart_account_id,
    p_accumulated_depreciation_account_id,
    p_depreciation_expense_account_id
  );

  insert into public.financial_assets (
    asset_code, name, description, category, acquisition_date,
    acquisition_value, residual_value, useful_life_months,
    depreciation_start_date, location, responsible, serial_number,
    patrimony_number, notes, asset_chart_account_id,
    accumulated_depreciation_account_id, depreciation_expense_account_id,
    cost_center_id, service_line_id, party_id, acquisition_transaction_id
  ) values (
    p_asset_code, p_name, p_description, p_category, p_acquisition_date,
    p_acquisition_value, p_residual_value, p_useful_life_months,
    p_depreciation_start_date, p_location, p_responsible, p_serial_number,
    p_patrimony_number, p_notes, p_asset_chart_account_id,
    p_accumulated_depreciation_account_id, p_depreciation_expense_account_id,
    p_cost_center_id, p_service_line_id, p_party_id, p_acquisition_transaction_id
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_asset(
  text, text, text, text, date, numeric, numeric, integer, date,
  text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public, anon;

grant execute on function public.create_asset(
  text, text, text, text, date, numeric, numeric, integer, date,
  text, text, text, text, text, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) to authenticated;

revoke all on function public.validate_asset_accounts(uuid, uuid, uuid)
from public, anon, authenticated;

commit;
