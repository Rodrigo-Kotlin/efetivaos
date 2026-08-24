begin;

set local session_replication_role = replica;

delete from public.price_list
where catalog_item_id = '51000000-0000-0000-0000-000000000030';

delete from public.quotation_items
where id = '51000000-0000-0000-0000-000000000050';

delete from public.quotations
where id = '51000000-0000-0000-0000-000000000040';

delete from public.margin_rules
where id = '51000000-0000-0000-0000-000000000060';

delete from public.catalog_items
where id = '51000000-0000-0000-0000-000000000030';

delete from public.catalog_categories
where id = '51000000-0000-0000-0000-000000000020';

delete from public.suppliers
where id = '51000000-0000-0000-0000-000000000010';

delete from auth.users
where id = '51000000-0000-0000-0000-000000000001';

commit;

select 'fixture_removed' as concurrency_cleanup;
