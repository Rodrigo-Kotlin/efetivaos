select
  (select count(*) from public.suppliers where name like 'E2E_S2_%') as e2e_suppliers,
  (select count(*) from public.catalog_categories where name like 'E2E_S2_%') as e2e_categories,
  (select count(*) from public.catalog_items where code like 'E2E_S2_%') as e2e_items,
  (select count(*) from public.quotations where reference_number like 'E2E_S2_%') as e2e_quotations,
  (select count(*) from pg_extension where extname = 'pgtap') as pgtap_extensions;
