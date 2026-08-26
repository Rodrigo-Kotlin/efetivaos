-- ============================================================================
-- EFETIVA OS — ETAPA 08A — Fundação Contábil-Gerencial
-- Migration: Plano de Contas, Centros de Custo, Linhas de Serviço,
--            Categorias, Contas Financeiras, Formas de Pagamento,
--            Partes/Contrapartes, Fechamento de Período.
--
-- Referência canônica: Efetiva Financeiro 360 v2.0.0 (seed.js / server.js)
-- Preserva: classes, naturezas, postos, grupos BP, classes DRE, DFC, DVA,
--           centros de custo, linhas de serviço, categorias com mapeamento
--           contábil, formas de pagamento.
--
-- NÃO cria: transactions, journal_entries, journal_lines (ETAPA 08B).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Tipos de domínio
-- ---------------------------------------------------------------------------

create type public.financial_account_class as enum (
  'ATIVO', 'PASSIVO', 'PL', 'RECEITA', 'CUSTO', 'DESPESA'
);

create type public.financial_nature as enum (
  'DEBITO', 'CREDITO'
);

create type public.financial_current_class as enum (
  'CIRCULANTE', 'NAO_CIRCULANTE'
);

create type public.financial_dfc_class as enum (
  'OPERACIONAL', 'INVESTIMENTO', 'FINANCIAMENTO', 'NAO_CAIXA', 'TRANSFERENCIA'
);

create type public.financial_movement_type as enum (
  'RECEITA', 'DESPESA', 'TRANSFERENCIA', 'EMPRESTIMO_RECEBIDO',
  'EMPRESTIMO_PAGO', 'APORTE', 'RETIRADA', 'IMOBILIZADO',
  'SALDO_INICIAL', 'AJUSTE'
);

create type public.financial_account_type as enum (
  'CAIXA', 'CONTA_CORRENTE', 'POUPANCA', 'CARTAO', 'INVESTIMENTO', 'OUTRO'
);

-- ---------------------------------------------------------------------------
-- 1. Plano de Contas — financial_chart_accounts
-- ---------------------------------------------------------------------------

create table public.financial_chart_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  class public.financial_account_class not null,
  nature public.financial_nature not null,
  posting boolean not null default true,
  active boolean not null default true,
  current_class public.financial_current_class,
  bp_group text not null default '',
  dre_class text not null default '',
  dfc_default public.financial_dfc_class not null default 'OPERACIONAL',
  dva_class text not null default '',
  is_cash boolean not null default false,
  presentation_sign smallint not null default 1
    check (presentation_sign in (-1, 1)),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint chart_accounts_code_unique unique (code),
  constraint chart_accounts_name_length_chk check (char_length(name) between 2 and 200),
  constraint chart_accounts_bp_group_length_chk check (char_length(bp_group) <= 120),
  constraint chart_accounts_dre_class_length_chk check (char_length(dre_class) <= 60),
  constraint chart_accounts_dva_class_length_chk check (char_length(dva_class) <= 60)
);

create index idx_chart_accounts_class_active on public.financial_chart_accounts (class, active);
create index idx_chart_accounts_code on public.financial_chart_accounts (code);
create index idx_chart_accounts_dre_class on public.financial_chart_accounts (dre_class) where dre_class <> '';
create index idx_chart_accounts_is_cash on public.financial_chart_accounts (is_cash) where is_cash = true;

-- ---------------------------------------------------------------------------
-- 2. Centros de Custo — financial_cost_centers
-- ---------------------------------------------------------------------------

create table public.financial_cost_centers (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint cost_centers_name_length_chk check (char_length(name) between 2 and 120),
  constraint cost_centers_code_length_chk check (code is null or char_length(code) <= 20),
  constraint cost_centers_description_length_chk check (description is null or char_length(description) <= 500)
);

create unique index uq_cost_centers_name_ci on public.financial_cost_centers (lower(name)) where active = true;

-- ---------------------------------------------------------------------------
-- 3. Linhas de Serviço — financial_service_lines
-- ---------------------------------------------------------------------------

create table public.financial_service_lines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint service_lines_name_length_chk check (char_length(name) between 2 and 160),
  constraint service_lines_description_length_chk check (description is null or char_length(description) <= 500)
);

create unique index uq_service_lines_name_ci on public.financial_service_lines (lower(name)) where active = true;

-- ---------------------------------------------------------------------------
-- 4. Categorias Financeiras — financial_categories
--    A categoria é uma regra de classificação: mapeia tipo de movimento
--    a conta contábil de contrapartida, centro de custo, linha de serviço
--    e classificação DFC.
-- ---------------------------------------------------------------------------

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  movement_type public.financial_movement_type not null,
  counter_account_id uuid references public.financial_chart_accounts(id) on delete restrict,
  cost_center_id uuid references public.financial_cost_centers(id) on delete set null,
  service_line_id uuid references public.financial_service_lines(id) on delete set null,
  cash_flow_class public.financial_dfc_class not null default 'OPERACIONAL',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint categories_name_length_chk check (char_length(name) between 2 and 200)
);

create index idx_categories_movement_type on public.financial_categories (movement_type, active);
create unique index uq_categories_name_ci on public.financial_categories (lower(name)) where active = true;

-- ---------------------------------------------------------------------------
-- 5. Contas Financeiras — financial_accounts
--    Contas de caixa/banco operacional. Cada uma referência uma conta
--    contábil do plano (is_cash = true).
-- ---------------------------------------------------------------------------

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chart_account_id uuid not null references public.financial_chart_accounts(id) on delete restrict,
  institution text,
  account_type public.financial_account_type not null default 'CONTA_CORRENTE',
  active boolean not null default true,
  opening_date date,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint financial_accounts_name_length_chk check (char_length(name) between 2 and 120),
  constraint financial_accounts_institution_length_chk check (institution is null or char_length(institution) <= 120),
  constraint financial_accounts_notes_length_chk check (notes is null or char_length(notes) <= 500)
);

create index idx_financial_accounts_active on public.financial_accounts (active);

-- ---------------------------------------------------------------------------
-- 6. Formas de Pagamento — financial_payment_methods
-- ---------------------------------------------------------------------------

create table public.financial_payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint payment_methods_name_length_chk check (char_length(name) between 2 and 80)
);

create unique index uq_payment_methods_name_ci on public.financial_payment_methods (lower(name)) where active = true;

-- ---------------------------------------------------------------------------
-- 7. Partes / Contrapartes — financial_parties
--    Não duplica clients/suppliers. Referencia opcional quando o parceiro
--    financeiro também está cadastrado no CRM ou cadastro de fornecedores.
-- ---------------------------------------------------------------------------

create table public.financial_parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  party_type text not null default 'CLIENTE_FORNECEDOR',
  document text,
  email text,
  phone text,
  client_id uuid references public.clients(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint parties_name_length_chk check (char_length(name) between 2 and 160),
  constraint parties_document_length_chk check (document is null or char_length(document) <= 20),
  constraint parties_email_chk check (
    email is null or (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ),
  constraint parties_phone_chk check (phone is null or (phone ~ '^[0-9]+$' and char_length(phone) between 10 and 15)),
  constraint parties_notes_length_chk check (notes is null or char_length(notes) <= 1000)
);

create index idx_parties_active_name on public.financial_parties (active, lower(name));
create index idx_parties_client on public.financial_parties (client_id) where client_id is not null;
create index idx_parties_supplier on public.financial_parties (supplier_id) where supplier_id is not null;

-- ---------------------------------------------------------------------------
-- 8. Fechamento de Período — financial_period_locks
-- ---------------------------------------------------------------------------

create table public.financial_period_locks (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  locked_at timestamptz not null default now(),
  locked_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  constraint period_locks_dates_chk check (period_end >= period_start),
  constraint period_locks_reason_length_chk check (reason is null or char_length(reason) <= 500)
);

-- ---------------------------------------------------------------------------
-- 9. Triggers de auditoria (reutiliza set_audit_fields existente)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'financial_chart_accounts',
    'financial_cost_centers',
    'financial_service_lines',
    'financial_categories',
    'financial_accounts',
    'financial_payment_methods',
    'financial_parties',
    'financial_period_locks'
  ]
  loop
    execute format('drop trigger if exists trg_%I_audit on public.%I', t, t);
    execute format(
      'create trigger trg_%I_audit before insert or update on public.%I for each row execute function public.set_audit_fields()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Normalização de dados (trim, lowercase where appropriate)
-- ---------------------------------------------------------------------------

create or replace function public.normalize_financial_chart_account()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.code := btrim(new.code);
  new.name := btrim(new.name);
  new.bp_group := btrim(new.bp_group);
  new.dre_class := upper(btrim(new.dre_class));
  new.dva_class := upper(btrim(new.dva_class));
  new.current_class := coalesce(new.current_class, 'CIRCULANTE');
  new.presentation_sign := case when new.presentation_sign < 0 then -1 else 1 end;
  return new;
end;
$$;

revoke execute on function public.normalize_financial_chart_account() from public, anon, authenticated;

create trigger trg_financial_chart_accounts_00_normalize
before insert or update on public.financial_chart_accounts
for each row execute function public.normalize_financial_chart_account();

create or replace function public.normalize_financial_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  return new;
end;
$$;

revoke execute on function public.normalize_financial_category() from public, anon, authenticated;

create trigger trg_financial_categories_00_normalize
before insert or update on public.financial_categories
for each row execute function public.normalize_financial_category();

-- ---------------------------------------------------------------------------
-- 11. Proteção de exclusão: conta contábil vinculada a categorias
-- ---------------------------------------------------------------------------

create or replace function public.protect_chart_account_on_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.financial_categories c
      where c.counter_account_id = old.id
    ) then
      raise exception 'Conta contábil vinculada a categorias nao pode ser excluida; inative-a.';
    end if;
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_chart_account_on_category() from public, anon, authenticated;

create trigger trg_financial_chart_accounts_protect
before delete on public.financial_chart_accounts
for each row execute function public.protect_chart_account_on_category();

-- ---------------------------------------------------------------------------
-- 12. Validação: financial_accounts.chart_account_id deve ser is_cash = true
-- ---------------------------------------------------------------------------

create or replace function public.validate_financial_account_cash()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_cash boolean;
begin
  select ca.is_cash into v_is_cash
  from public.financial_chart_accounts ca
  where ca.id = new.chart_account_id;

  if coalesce(v_is_cash, false) = false then
    raise exception 'A conta contábil vinculada deve ser de caixa/banco (is_cash = true).';
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_financial_account_cash() from public, anon, authenticated;

create trigger trg_financial_accounts_00_validate_cash
before insert or update on public.financial_accounts
for each row execute function public.validate_financial_account_cash();

-- ---------------------------------------------------------------------------
-- 13. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.financial_chart_accounts enable row level security;
alter table public.financial_chart_accounts force row level security;
alter table public.financial_cost_centers enable row level security;
alter table public.financial_cost_centers force row level security;
alter table public.financial_service_lines enable row level security;
alter table public.financial_service_lines force row level security;
alter table public.financial_categories enable row level security;
alter table public.financial_categories force row level security;
alter table public.financial_accounts enable row level security;
alter table public.financial_accounts force row level security;
alter table public.financial_payment_methods enable row level security;
alter table public.financial_payment_methods force row level security;
alter table public.financial_parties enable row level security;
alter table public.financial_parties force row level security;
alter table public.financial_period_locks enable row level security;
alter table public.financial_period_locks force row level security;

-- --- chart_accounts ---
create policy fca_select_internal on public.financial_chart_accounts
for select to authenticated using (public.is_internal_user());
create policy fca_insert_internal on public.financial_chart_accounts
for insert to authenticated with check (public.is_internal_user());
create policy fca_update_internal on public.financial_chart_accounts
for update to authenticated
using (public.is_internal_user()) with check (public.is_internal_user());

-- --- cost_centers ---
create policy fcc_select_internal on public.financial_cost_centers
for select to authenticated using (public.is_internal_user());
create policy fcc_insert_internal on public.financial_cost_centers
for insert to authenticated with check (public.is_internal_user());
create policy fcc_update_internal on public.financial_cost_centers
for update to authenticated
using (public.is_internal_user()) with check (public.is_internal_user());

-- --- service_lines ---
create policy fsl_select_internal on public.financial_service_lines
for select to authenticated using (public.is_internal_user());
create policy fsl_insert_internal on public.financial_service_lines
for insert to authenticated with check (public.is_internal_user());
create policy fsl_update_internal on public.financial_service_lines
for update to authenticated
using (public.is_internal_user()) with check (public.is_internal_user());

-- --- categories ---
create policy fcat_select_internal on public.financial_categories
for select to authenticated using (public.is_internal_user());
create policy fcat_insert_internal on public.financial_categories
for insert to authenticated with check (public.is_internal_user());
create policy fcat_update_internal on public.financial_categories
for update to authenticated
using (public.is_internal_user()) with check (public.is_internal_user());

-- --- financial_accounts ---
create policy fa_select_internal on public.financial_accounts
for select to authenticated using (public.is_internal_user());
create policy fa_insert_internal on public.financial_accounts
for insert to authenticated with check (public.is_internal_user());
create policy fa_update_internal on public.financial_accounts
for update to authenticated
using (public.is_internal_user()) with check (public.is_internal_user());

-- --- payment_methods ---
create policy fpm_select_internal on public.financial_payment_methods
for select to authenticated using (public.is_internal_user());
create policy fpm_insert_internal on public.financial_payment_methods
for insert to authenticated with check (public.is_internal_user());
create policy fpm_update_internal on public.financial_payment_methods
for update to authenticated
using (public.is_internal_user()) with check (public.is_internal_user());

-- --- parties ---
create policy fp_select_internal on public.financial_parties
for select to authenticated using (public.is_internal_user());
create policy fp_insert_internal on public.financial_parties
for insert to authenticated with check (public.is_internal_user());
create policy fp_update_internal on public.financial_parties
for update to authenticated
using (public.is_internal_user()) with check (public.is_internal_user());

-- --- period_locks ---
create policy fpl_select_internal on public.financial_period_locks
for select to authenticated using (public.is_internal_user());
create policy fpl_insert_admin on public.financial_period_locks
for insert to authenticated with check (public.is_admin());
create policy fpl_update_admin on public.financial_period_locks
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 14. Grants PostgREST
-- ---------------------------------------------------------------------------

revoke all on public.financial_chart_accounts from public, anon, authenticated;
revoke all on public.financial_cost_centers from public, anon, authenticated;
revoke all on public.financial_service_lines from public, anon, authenticated;
revoke all on public.financial_categories from public, anon, authenticated;
revoke all on public.financial_accounts from public, anon, authenticated;
revoke all on public.financial_payment_methods from public, anon, authenticated;
revoke all on public.financial_parties from public, anon, authenticated;
revoke all on public.financial_period_locks from public, anon, authenticated;

grant select, insert, update on public.financial_chart_accounts to authenticated;
grant select, insert, update on public.financial_cost_centers to authenticated;
grant select, insert, update on public.financial_service_lines to authenticated;
grant select, insert, update on public.financial_categories to authenticated;
grant select, insert, update on public.financial_accounts to authenticated;
grant select, insert, update on public.financial_payment_methods to authenticated;
grant select, insert, update on public.financial_parties to authenticated;
grant select, insert, update on public.financial_period_locks to authenticated;

-- ---------------------------------------------------------------------------
-- 15. Seed — Plano de Contas completo (v2.0.0 canônico)
--     Preserva todos os códigos, nomes, classes, naturezas, postos,
--     grupos BP, classes DRE, DFC padrão, DVA e is_cash.
-- ---------------------------------------------------------------------------

insert into public.financial_chart_accounts (code, name, class, nature, posting, active, current_class, bp_group, dre_class, dfc_default, dva_class, is_cash, presentation_sign) values
-- ATIVO Circulante — Disponibilidades
('1.1.01.001', 'Caixa Geral', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', 'Disponibilidades', '', 'OPERACIONAL', '', true, 1),
('1.1.01.002', 'Banco Cora', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', 'Disponibilidades', '', 'OPERACIONAL', '', true, 1),
('1.1.01.003', 'Banco Nubank', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', 'Disponibilidades', '', 'OPERACIONAL', '', true, 1),
('1.1.01.004', 'Aplicacoes de Liquidez Imediata', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', 'Disponibilidades', '', 'OPERACIONAL', '', true, 1),
-- ATIVO Circulante — Creditos
('1.1.02.001', 'Clientes a Receber', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', 'Creditos', '', 'OPERACIONAL', '', false, 1),
('1.1.02.002', '(-) Perdas Estimadas em Creditos', 'ATIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Creditos', '', 'OPERACIONAL', '', false, -1),
('1.1.02.003', 'Adiantamentos a Empregados', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', 'Creditos', '', 'OPERACIONAL', '', false, 1),
('1.1.02.004', 'Adiantamentos a Fornecedores e Prestadores', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', 'Creditos', '', 'OPERACIONAL', '', false, 1),
('1.1.02.005', 'Outros Creditos', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', 'Creditos', '', 'OPERACIONAL', '', false, 1),
-- ATIVO Circulante — Tributos a Recuperar
('1.1.03.001', 'Tributos e Retencoes a Recuperar', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', 'Tributos a Recuperar', '', 'OPERACIONAL', '', false, 1),
-- ATIVO Circulante — Despesas Antecipadas
('1.1.04.001', 'Despesas Antecipadas', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', 'Despesas Antecipadas', '', 'OPERACIONAL', '', false, 1),
-- ATIVO Circulante — Estoques
('1.1.05.001', 'Materiais e Insumos em Estoque', 'ATIVO', 'DEBITO', true, true, 'CIRCULANTE', 'Estoques e Insumos', '', 'OPERACIONAL', '', false, 1),
-- ATIVO Nao Circulante — Realizavel a LP
('1.2.01.001', 'Depositos e Caucoes', 'ATIVO', 'DEBITO', true, true, 'NAO_CIRCULANTE', 'Realizavel a Longo Prazo', '', 'OPERACIONAL', '', false, 1),
-- ATIVO Nao Circulante — Imobilizado
('1.2.02.001', 'Equipamentos Medicos e Clinicos', 'ATIVO', 'DEBITO', true, true, 'NAO_CIRCULANTE', 'Imobilizado', '', 'OPERACIONAL', '', false, 1),
('1.2.02.002', 'Equipamentos de SST e Higiene Ocupacional', 'ATIVO', 'DEBITO', true, true, 'NAO_CIRCULANTE', 'Imobilizado', '', 'OPERACIONAL', '', false, 1),
('1.2.02.003', 'Equipamentos de Informatica', 'ATIVO', 'DEBITO', true, true, 'NAO_CIRCULANTE', 'Imobilizado', '', 'OPERACIONAL', '', false, 1),
('1.2.02.004', 'Moveis e Utensilios', 'ATIVO', 'DEBITO', true, true, 'NAO_CIRCULANTE', 'Imobilizado', '', 'OPERACIONAL', '', false, 1),
('1.2.02.005', 'Benfeitorias e Instalacoes', 'ATIVO', 'DEBITO', true, true, 'NAO_CIRCULANTE', 'Imobilizado', '', 'OPERACIONAL', '', false, 1),
('1.2.02.006', 'Veiculos', 'ATIVO', 'DEBITO', true, true, 'NAO_CIRCULANTE', 'Imobilizado', '', 'OPERACIONAL', '', false, 1),
('1.2.02.099', '(-) Depreciacao Acumulada', 'ATIVO', 'CREDITO', true, true, 'NAO_CIRCULANTE', 'Imobilizado', '', 'NAO_CAIXA', '', false, -1),
-- ATIVO Nao Circulante — Intangivel
('1.2.03.001', 'Softwares e Direitos de Uso Capitalizados', 'ATIVO', 'DEBITO', true, true, 'NAO_CIRCULANTE', 'Intangivel', '', 'OPERACIONAL', '', false, 1),
('1.2.03.099', '(-) Amortizacao Acumulada', 'ATIVO', 'CREDITO', true, true, 'NAO_CIRCULANTE', 'Intangivel', '', 'NAO_CAIXA', '', false, -1),

-- PASSIVO Circulante — Fornecedores
('2.1.01.001', 'Fornecedores a Pagar', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Fornecedores e Prestadores', '', 'OPERACIONAL', '', false, 1),
('2.1.01.002', 'Prestadores de Servicos a Pagar', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Fornecedores e Prestadores', '', 'OPERACIONAL', '', false, 1),
-- PASSIVO Circulante — Obrigatorias Trabalhistas
('2.1.02.001', 'Salarios a Pagar', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Obrigatorias Trabalhistas', '', 'OPERACIONAL', '', false, 1),
('2.1.02.002', 'Pro-labore a Pagar', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Obrigatorias Trabalhistas', '', 'OPERACIONAL', '', false, 1),
('2.1.02.003', 'Ferias e Encargos a Pagar', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Obrigatorias Trabalhistas', '', 'OPERACIONAL', '', false, 1),
('2.1.02.004', '13o Salario e Encargos a Pagar', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Obrigatorias Trabalhistas', '', 'OPERACIONAL', '', false, 1),
-- PASSIVO Circulante — Obrigatorias Sociais e Tributarias
('2.1.03.001', 'FGTS a Recolher', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Obrigatorias Sociais e Tributarias', '', 'OPERACIONAL', '', false, 1),
('2.1.03.002', 'INSS e Retencoes Previdenciarias a Recolher', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Obrigatorias Sociais e Tributarias', '', 'OPERACIONAL', '', false, 1),
('2.1.04.001', 'DAS / Simples Nacional a Recolher', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Obrigatorias Sociais e Tributarias', '', 'OPERACIONAL', '', false, 1),
('2.1.04.002', 'ISS a Recolher', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Obrigatorias Sociais e Tributarias', '', 'OPERACIONAL', '', false, 1),
('2.1.04.003', 'IRRF / PIS / COFINS / CSLL Retidos a Recolher', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Obrigatorias Sociais e Tributarias', '', 'OPERACIONAL', '', false, 1),
('2.1.04.004', 'DARF e Outros Tributos a Recolher', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Obrigatorias Sociais e Tributarias', '', 'OPERACIONAL', '', false, 1),
-- PASSIVO Circulante — Obrigatorias Financeiras
('2.1.05.001', 'Cartoes de Credito a Pagar', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Obrigatorias Financeiras', '', 'OPERACIONAL', '', false, 1),
-- PASSIVO Circulante — Emprestimos CP
('2.1.06.001', 'Emprestimos e Financiamentos - Curto Prazo', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Emprestimos e Financiamentos', '', 'OPERACIONAL', '', false, 1),
-- PASSIVO Circulante — Parcelamentos
('2.1.07.001', 'Parcelamentos Tributarios - Curto Prazo', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Parcelamentos', '', 'OPERACIONAL', '', false, 1),
-- PASSIVO Circulante — Outras Obrigacoes
('2.1.08.001', 'Adiantamentos de Clientes / Receitas a Apropriar', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Outras Obrigacoes', '', 'OPERACIONAL', '', false, 1),
('2.1.09.001', 'Outras Obrigacoes a Pagar', 'PASSIVO', 'CREDITO', true, true, 'CIRCULANTE', 'Outras Obrigacoes', '', 'OPERACIONAL', '', false, 1),
-- PASSIVO Nao Circulante
('2.2.01.001', 'Emprestimos e Financiamentos - Longo Prazo', 'PASSIVO', 'CREDITO', true, true, 'NAO_CIRCULANTE', 'Emprestimos e Financiamentos', '', 'OPERACIONAL', '', false, 1),
('2.2.02.001', 'Parcelamentos Tributarios - Longo Prazo', 'PASSIVO', 'CREDITO', true, true, 'NAO_CIRCULANTE', 'Parcelamentos', '', 'OPERACIONAL', '', false, 1),
('2.2.03.001', 'Provisoes e Contingencias', 'PASSIVO', 'CREDITO', true, true, 'NAO_CIRCULANTE', 'Provisoes', '', 'OPERACIONAL', '', false, 1),

-- PATRIMONIO LIQUIDO
('2.3.01.001', 'Capital Social', 'PL', 'CREDITO', true, true, null, 'Capital Social', '', 'OPERACIONAL', '', false, 1),
('2.3.01.002', 'Adiantamento para Futuro Aumento de Capital - AFAC', 'PL', 'CREDITO', true, true, null, 'Capital Social', '', 'OPERACIONAL', '', false, 1),
('2.3.02.001', 'Reservas de Lucros', 'PL', 'CREDITO', true, true, null, 'Reservas', '', 'OPERACIONAL', '', false, 1),
('2.3.03.001', 'Lucros / Prejuizos Acumulados', 'PL', 'CREDITO', true, true, null, 'Resultados Acumulados', '', 'OPERACIONAL', '', false, 1),
('2.3.03.002', 'Ajustes de Exercicios Anteriores', 'PL', 'CREDITO', true, true, null, 'Resultados Acumulados', '', 'OPERACIONAL', '', false, 1),
('2.3.04.001', 'Distribuicoes de Lucros / Dividendos', 'PL', 'DEBITO', true, true, null, 'Distribuicoes', '', 'OPERACIONAL', 'CAPITAL_PROPRIO', false, -1),
('2.3.99.001', 'Contrapartida de Saldos Iniciais', 'PL', 'CREDITO', true, true, null, 'Saldos Iniciais', '', 'NAO_CAIXA', '', false, 1),

-- RECEITAS
('3.1.01.001', 'Receita de Assessoria e Consultoria SST', 'RECEITA', 'CREDITO', true, true, null, '', 'RECEITA_BRUTA', 'OPERACIONAL', 'RECEITAS', false, 1),
('3.1.01.002', 'Receita de Clinica Ocupacional', 'RECEITA', 'CREDITO', true, true, null, '', 'RECEITA_BRUTA', 'OPERACIONAL', 'RECEITAS', false, 1),
('3.1.01.003', 'Receita de Engenharia, Laudos e Documentos', 'RECEITA', 'CREDITO', true, true, null, '', 'RECEITA_BRUTA', 'OPERACIONAL', 'RECEITAS', false, 1),
('3.1.01.004', 'Receita Recorrente eSocial / Mensageria / SGG', 'RECEITA', 'CREDITO', true, true, null, '', 'RECEITA_BRUTA', 'OPERACIONAL', 'RECEITAS', false, 1),
('3.1.01.005', 'Receita de Treinamentos', 'RECEITA', 'CREDITO', true, true, null, '', 'RECEITA_BRUTA', 'OPERACIONAL', 'RECEITAS', false, 1),
('3.1.01.006', 'Receita de Bombeiro Civil / SESMT Terceirizado', 'RECEITA', 'CREDITO', true, true, null, '', 'RECEITA_BRUTA', 'OPERACIONAL', 'RECEITAS', false, 1),
('3.1.01.099', 'Outras Receitas de Servicos', 'RECEITA', 'CREDITO', true, true, null, '', 'RECEITA_BRUTA', 'OPERACIONAL', 'RECEITAS', false, 1),
('3.2.01.001', '(-) Cancelamentos, Devolucoes e Descontos Concedidos', 'RECEITA', 'DEBITO', true, true, null, '', 'DEDUCAO_RECEITA', 'OPERACIONAL', 'RECEITAS', false, -1),
('3.2.01.002', '(-) Tributos sobre Faturamento - Gerencial', 'RECEITA', 'DEBITO', true, true, null, '', 'DEDUCAO_RECEITA', 'OPERACIONAL', 'TRIBUTOS', false, -1),
('3.3.01.001', 'Receitas Financeiras e Rendimentos', 'RECEITA', 'CREDITO', true, true, null, '', 'RECEITA_FINANCEIRA', 'OPERACIONAL', 'VALOR_RECEBIDO_TRANSFERENCIA', false, 1),
('3.4.01.001', 'Outras Receitas e Ganhos', 'RECEITA', 'CREDITO', true, true, null, '', 'OUTRAS_RECEITAS', 'OPERACIONAL', 'VALOR_RECEBIDO_TRANSFERENCIA', false, 1),

-- CUSTOS DIRETOS
('4.1.01.001', 'Laboratorios e Exames Terceirizados', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('4.1.01.002', 'Medicos, Responsaveis Tecnicos e Assistenciais', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('4.1.01.003', 'Fonoaudiologia / Audiometria Terceirizada', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('4.1.01.004', 'Toxicologicos e Exames Complementares', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('4.1.01.005', 'Materiais Clinicos e Descartaveis Aplicados', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('4.1.01.006', 'Gestao de Residuos Clinicos', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('4.2.01.001', 'Prestadores Tecnicos de Engenharia / SST', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('4.2.01.002', 'ART / CREA / Taxas Diretamente Vinculadas a Servicos', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'TRIBUTOS', false, 1),
('4.2.01.003', 'Calibracao e Locacao de Equipamentos para Servicos', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('4.2.01.004', 'Viagens, Deslocamentos e Diarias de Projetos', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('4.3.01.001', 'Licencas e Sistemas Diretamente Vinculados ao eSocial', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('4.4.01.001', 'Prestadores de Bombeiro Civil / SESMT Terceirizado', 'CUSTO', 'DEBITO', true, true, null, '', 'CUSTO_SERVICO', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),

-- DESPESAS OPERACIONAIS
('5.1.01.001', 'Salarios Administrativos', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'PESSOAL', false, 1),
('5.1.01.002', 'Pro-labore', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'PESSOAL', false, 1),
('5.1.01.003', 'Beneficios, Vales e Auxilios', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'PESSOAL', false, 1),
('5.1.01.004', 'FGTS, INSS e Encargos Trabalhistas', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'PESSOAL', false, 1),
('5.1.01.005', 'Rescisoes, Ferias e 13o Salario', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'PESSOAL', false, 1),
('5.2.01.001', 'Alugueis e Condominio', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'CAPITAL_TERCEIROS', false, 1),
('5.2.01.002', 'Energia Eletrica', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('5.2.01.003', 'Telefonia e Internet', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('5.2.01.004', 'Vigilancia, Limpeza e Manutencao Predial', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('5.3.01.001', 'Sistemas, Softwares e Assinaturas', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('5.3.01.002', 'Associacoes e Mensalidades Institucionais', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('5.4.01.001', 'Contabilidade, Juridico e Consultorias Administrativas', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('5.4.01.002', 'Marketing, Publicidade e Brindes', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('5.5.01.001', 'Combustivel e Despesas com Veiculos Administrativos', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('5.5.01.002', 'Aluguel e Manutencao de Veiculos', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'CAPITAL_TERCEIROS', false, 1),
('5.6.01.001', 'Material de Escritorio, Limpeza e Copa', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('5.6.01.002', 'Uniformes, EPIs e Materiais de Uso Administrativo', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('5.7.01.001', 'Taxas, Licencas e Anuidades', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'TRIBUTOS', false, 1),
('5.7.01.002', 'Cursos e Capacitacao', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('5.8.01.001', 'Depreciacao', 'DESPESA', 'DEBITO', true, true, null, '', 'DEPRECIACAO_AMORTIZACAO', 'NAO_CAIXA', 'RETENCOES', false, 1),
('5.8.01.002', 'Amortizacao', 'DESPESA', 'DEBITO', true, true, null, '', 'DEPRECIACAO_AMORTIZACAO', 'NAO_CAIXA', 'RETENCOES', false, 1),
('5.9.01.001', 'Outras Despesas Operacionais', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_OPERACIONAL', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),

-- FINANCEIRO / OUTROS / TRIBUTOS RESULTADO
('6.1.01.001', 'Juros e Encargos Financeiros', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_FINANCEIRA', 'FINANCIAMENTO', 'CAPITAL_TERCEIROS', false, 1),
('6.1.01.002', 'Tarifas Bancarias e IOF', 'DESPESA', 'DEBITO', true, true, null, '', 'DESPESA_FINANCEIRA', 'OPERACIONAL', 'CAPITAL_TERCEIROS', false, 1),
('6.2.01.001', 'Outras Despesas e Perdas', 'DESPESA', 'DEBITO', true, true, null, '', 'OUTRAS_DESPESAS', 'OPERACIONAL', 'INSUMOS_TERCEIROS', false, 1),
('7.1.01.001', 'IRPJ / CSLL sobre Resultado', 'DESPESA', 'DEBITO', true, true, null, '', 'IMPOSTO_RESULTADO', 'OPERACIONAL', 'TRIBUTOS', false, 1)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 16. Seed — Centros de Custo
-- ---------------------------------------------------------------------------

insert into public.financial_cost_centers (code, name, active) values
('CLI', 'Clinica Ocupacional', true),
('ENG', 'Engenharia / SST', true),
('ESO', 'eSocial / Recorrencias', true),
('BC', 'Bombeiro Civil / SESMT', true),
('TRN', 'Treinamentos', true),
('ADM', 'Administrativo / Financeiro', true),
('COM', 'Comercial / Marketing', true),
('CORP', 'Corporativo / Compartilhado', true)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 17. Seed — Linhas de Servico
-- ---------------------------------------------------------------------------

insert into public.financial_service_lines (name, active) values
('Assessoria e Consultoria SST', true),
('Clinica Ocupacional', true),
('Engenharia / Laudos / Documentos', true),
('eSocial / Mensageria / SGG', true),
('Treinamentos', true),
('Bombeiro Civil / SESMT Terceirizado', true),
('Administrativo / Nao Aplicavel', true)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 18. Seed — Formas de Pagamento
-- ---------------------------------------------------------------------------

insert into public.financial_payment_methods (name, active) values
('PIX', true),
('Boleto', true),
('Transferencia Bancaria', true),
('Cartao de Credito', true),
('Cartao de Debito', true),
('Dinheiro', true),
('Debito Automatico', true),
('Outro', true)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 19. Seed — Categorias Financeiras
--     Mapeia tipo de movimento → conta contábil de contrapartida,
--     centro de custo padrão e linha de serviço padrão.
--     Preserva o mapeamento exato do seed.js v2.0.0.
-- ---------------------------------------------------------------------------

-- Helper: IDs das contas contábeis para referência nas categorias.
-- Usaremos subqueries correlacionadas para evitar hardcode de UUIDs.

-- Categorias de RECEITA
insert into public.financial_categories (name, movement_type, counter_account_id, cost_center_id, service_line_id, cash_flow_class, active)
select v.name, 'RECEITA'::public.financial_movement_type, ca.id, cc.id, sl.id, 'OPERACIONAL'::public.financial_dfc_class, true
from (values
  ('Receita - Assessoria e Consultoria SST', '3.1.01.001', 'Engenharia / SST', 'Assessoria e Consultoria SST'),
  ('Receita - Clinica Ocupacional', '3.1.01.002', 'Clinica Ocupacional', 'Clinica Ocupacional'),
  ('Receita - Engenharia / Laudos', '3.1.01.003', 'Engenharia / SST', 'Engenharia / Laudos / Documentos'),
  ('Receita - eSocial / Mensageria / SGG', '3.1.01.004', 'eSocial / Recorrencias', 'eSocial / Mensageria / SGG'),
  ('Receita - Treinamentos', '3.1.01.005', 'Treinamentos', 'Treinamentos'),
  ('Receita - Bombeiro Civil / SESMT', '3.1.01.006', 'Bombeiro Civil / SESMT', 'Bombeiro Civil / SESMT Terceirizado')
) as v(name, account_code, cc_name, sl_name)
cross join lateral (select id from public.financial_chart_accounts where code = v.account_code limit 1) ca
cross join lateral (select id from public.financial_cost_centers where name = v.cc_name limit 1) cc
cross join lateral (select id from public.financial_service_lines where name = v.sl_name limit 1) sl
on conflict do nothing;

-- Categorias de DESPESA — CUSTOS DIRETOS
insert into public.financial_categories (name, movement_type, counter_account_id, cost_center_id, service_line_id, cash_flow_class, active)
select v.name, 'DESPESA'::public.financial_movement_type, ca.id, cc.id, sl.id, 'OPERACIONAL'::public.financial_dfc_class, true
from (values
  ('Laboratorios e exames terceirizados', '4.1.01.001', 'Clinica Ocupacional', 'Clinica Ocupacional'),
  ('Medico / RT / Assistencial', '4.1.01.002', 'Clinica Ocupacional', 'Clinica Ocupacional'),
  ('Fonoaudiologia / Audiometria', '4.1.01.003', 'Clinica Ocupacional', 'Clinica Ocupacional'),
  ('Toxicologico e exames complementares', '4.1.01.004', 'Clinica Ocupacional', 'Clinica Ocupacional'),
  ('Materiais clinicos e descartaveis', '4.1.01.005', 'Clinica Ocupacional', 'Clinica Ocupacional'),
  ('Prestadores tecnicos SST', '4.2.01.001', 'Engenharia / SST', 'Engenharia / Laudos / Documentos'),
  ('ART / CREA vinculados a projeto', '4.2.01.002', 'Engenharia / SST', 'Engenharia / Laudos / Documentos'),
  ('Calibracao / locacao de equipamentos', '4.2.01.003', 'Engenharia / SST', 'Engenharia / Laudos / Documentos'),
  ('Viagens e deslocamentos de projeto', '4.2.01.004', 'Engenharia / SST', 'Engenharia / Laudos / Documentos'),
  ('Sistema diretamente ligado ao eSocial', '4.3.01.001', 'eSocial / Recorrencias', 'eSocial / Mensageria / SGG'),
  ('Prestadores de Bombeiro Civil / SESMT', '4.4.01.001', 'Bombeiro Civil / SESMT', 'Bombeiro Civil / SESMT Terceirizado')
) as v(name, account_code, cc_name, sl_name)
cross join lateral (select id from public.financial_chart_accounts where code = v.account_code limit 1) ca
cross join lateral (select id from public.financial_cost_centers where name = v.cc_name limit 1) cc
cross join lateral (select id from public.financial_service_lines where name = v.sl_name limit 1) sl
on conflict do nothing;

-- Categorias de DESPESA — DESPESAS OPERACIONAIS
insert into public.financial_categories (name, movement_type, counter_account_id, cost_center_id, service_line_id, cash_flow_class, active)
select v.name, 'DESPESA'::public.financial_movement_type, ca.id, cc.id, sl.id, v.dfc::public.financial_dfc_class, true
from (values
  ('Salarios administrativos', '5.1.01.001', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Pro-labore', '5.1.01.002', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Beneficios / vales / auxilios', '5.1.01.003', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Encargos trabalhistas', '5.1.01.004', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Rescisoes / ferias / 13o', '5.1.01.005', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Aluguel / ocupacao', '5.2.01.001', 'Corporativo / Compartilhado', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Energia eletrica', '5.2.01.002', 'Corporativo / Compartilhado', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Telefonia / internet', '5.2.01.003', 'Corporativo / Compartilhado', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Vigilancia / limpeza / manutencao', '5.2.01.004', 'Corporativo / Compartilhado', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Sistemas / softwares / assinaturas', '5.3.01.001', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Associacoes e mensalidades', '5.3.01.002', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Contabilidade / juridico / consultoria administrativa', '5.4.01.001', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Marketing / publicidade / brindes', '5.4.01.002', 'Comercial / Marketing', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Combustivel / veiculo administrativo', '5.5.01.001', 'Corporativo / Compartilhado', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Aluguel / manutencao de veiculo', '5.5.01.002', 'Corporativo / Compartilhado', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Material escritorio / limpeza / copa', '5.6.01.001', 'Corporativo / Compartilhado', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Uniformes / EPIs administrativos', '5.6.01.002', 'Corporativo / Compartilhado', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Taxas / licencas / anuidades', '5.7.01.001', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Cursos / capacitacao', '5.7.01.002', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'OPERACIONAL'),
  ('Juros / encargos financeiros', '6.1.01.001', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'FINANCIAMENTO'),
  ('Tarifas bancarias / IOF', '6.1.01.002', 'Administrativo / Financeiro', 'Administrativo / Nao Aplicavel', 'OPERACIONAL')
) as v(name, account_code, cc_name, sl_name, dfc)
cross join lateral (select id from public.financial_chart_accounts where code = v.account_code limit 1) ca
cross join lateral (select id from public.financial_cost_centers where name = v.cc_name limit 1) cc
cross join lateral (select id from public.financial_service_lines where name = v.sl_name limit 1) sl
on conflict do nothing;

-- Categorias de IMOBILIZADO
insert into public.financial_categories (name, movement_type, counter_account_id, cost_center_id, service_line_id, cash_flow_class, active)
select v.name, 'IMOBILIZADO'::public.financial_movement_type, ca.id, cc.id, sl.id, 'INVESTIMENTO'::public.financial_dfc_class, true
from (values
  ('Compra - Equipamentos Medicos / Clinicos', '1.2.02.001', 'Clinica Ocupacional', 'Clinica Ocupacional'),
  ('Compra - Equipamentos SST / Higiene', '1.2.02.002', 'Engenharia / SST', 'Engenharia / Laudos / Documentos'),
  ('Compra - Informatica', '1.2.02.003', 'Corporativo / Compartilhado', 'Administrativo / Nao Aplicavel'),
  ('Compra - Moveis / Utensilios', '1.2.02.004', 'Corporativo / Compartilhado', 'Administrativo / Nao Aplicavel')
) as v(name, account_code, cc_name, sl_name)
cross join lateral (select id from public.financial_chart_accounts where code = v.account_code limit 1) ca
cross join lateral (select id from public.financial_cost_centers where name = v.cc_name limit 1) cc
cross join lateral (select id from public.financial_service_lines where name = v.sl_name limit 1) sl
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 20. View auxiliar — financial_chart_accounts_list_v
--     Retorna plano de contas com campos formatados para UI.
-- ---------------------------------------------------------------------------

create or replace view public.financial_chart_accounts_list_v
with (security_invoker = true)
as
select
  ca.id,
  ca.code,
  ca.name,
  ca.class,
  ca.nature,
  ca.posting,
  ca.active,
  ca.current_class,
  ca.bp_group,
  ca.dre_class,
  ca.dfc_default,
  ca.dva_class,
  ca.is_cash,
  ca.presentation_sign,
  ca.created_at,
  ca.updated_at
from public.financial_chart_accounts ca
order by ca.code;

revoke all on table public.financial_chart_accounts_list_v from public, anon, authenticated;
grant select on table public.financial_chart_accounts_list_v to authenticated;

-- ---------------------------------------------------------------------------
-- 21. View auxiliar — financial_categories_list_v
-- ---------------------------------------------------------------------------

create or replace view public.financial_categories_list_v
with (security_invoker = true)
as
select
  c.id,
  c.name,
  c.movement_type,
  c.counter_account_id,
  ca.code as counter_account_code,
  ca.name as counter_account_name,
  c.cost_center_id,
  cc.name as cost_center_name,
  c.service_line_id,
  sl.name as service_line_name,
  c.cash_flow_class,
  c.active,
  c.created_at,
  c.updated_at
from public.financial_categories c
left join public.financial_chart_accounts ca on ca.id = c.counter_account_id
left join public.financial_cost_centers cc on cc.id = c.cost_center_id
left join public.financial_service_lines sl on sl.id = c.service_line_id
order by c.name;

revoke all on table public.financial_categories_list_v from public, anon, authenticated;
grant select on table public.financial_categories_list_v to authenticated;

-- ---------------------------------------------------------------------------
-- 22. View auxiliar — financial_accounts_list_v
-- ---------------------------------------------------------------------------

create or replace view public.financial_accounts_list_v
with (security_invoker = true)
as
select
  fa.id,
  fa.name,
  fa.chart_account_id,
  ca.code as chart_account_code,
  ca.name as chart_account_name,
  fa.institution,
  fa.account_type,
  fa.active,
  fa.opening_date,
  fa.notes,
  fa.created_at,
  fa.updated_at
from public.financial_accounts fa
left join public.financial_chart_accounts ca on ca.id = fa.chart_account_id
order by fa.name;

revoke all on table public.financial_accounts_list_v from public, anon, authenticated;
grant select on table public.financial_accounts_list_v to authenticated;

-- ---------------------------------------------------------------------------
-- FIM DA MIGRATION
-- ---------------------------------------------------------------------------
commit;
