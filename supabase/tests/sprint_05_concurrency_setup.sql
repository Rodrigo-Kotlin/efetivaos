insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '51000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'sprint05-concurrency@test.local', '', now(),
  '{}', '{"full_name":"Sprint 05 Concorrencia"}', now(), now()
);

update public.profiles
set role = 'admin'
where id = '51000000-0000-0000-0000-000000000001';

insert into public.suppliers (id, name)
values ('51000000-0000-0000-0000-000000000010', 'Fornecedor Concorrencia Sprint 05');

insert into public.catalog_categories (id, name)
values ('51000000-0000-0000-0000-000000000020', 'Categoria Concorrencia Sprint 05');

insert into public.catalog_items (id, code, name, category_id, unit)
values (
  '51000000-0000-0000-0000-000000000030', 'S05-CONC', 'Item Concorrencia',
  '51000000-0000-0000-0000-000000000020', 'un'
);

insert into public.margin_rules (id, scope_type, catalog_item_id, calculation_type, value)
values (
  '51000000-0000-0000-0000-000000000060', 'item',
  '51000000-0000-0000-0000-000000000030', 'percentage', 10
);

insert into public.quotations (id, supplier_id, received_at, valid_until)
values (
  '51000000-0000-0000-0000-000000000040',
  '51000000-0000-0000-0000-000000000010', current_date, current_date + 30
);

insert into public.quotation_items (id, quotation_id, catalog_item_id, unit_price)
values (
  '51000000-0000-0000-0000-000000000050',
  '51000000-0000-0000-0000-000000000040',
  '51000000-0000-0000-0000-000000000030', 100
);

update public.quotations
set status = 'active'
where id = '51000000-0000-0000-0000-000000000040';

select 'fixture_ready' as concurrency_setup;
