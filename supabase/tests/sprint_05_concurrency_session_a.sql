begin;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);

create temporary table session_a_state (
  decision_token text not null,
  result text
) on commit drop;

insert into session_a_state (decision_token)
select decision_token
from public.pricing_comparison_v
where catalog_item_id = '51000000-0000-0000-0000-000000000030';

select pg_sleep(6);

do $$
declare
  v_token text;
  v_expected_message constant text := 'Decisao de preco desatualizada: ofertas, regra ou aprovacao mudaram. Recarregue antes de continuar.';
begin
  select decision_token into strict v_token from session_a_state;

  begin
    perform public.approve_price(
      '51000000-0000-0000-0000-000000000030',
      v_token
    );
    raise exception 'A aprovacao obsoleta nao foi rejeitada.';
  exception
    when others then
      if sqlerrm is distinct from v_expected_message then
        raise;
      end if;
  end;

  update session_a_state set result = 'stale_approval_rejected';
end;
$$;

select result as session_a_result from session_a_state;

rollback;
