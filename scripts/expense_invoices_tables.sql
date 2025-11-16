-- Expense invoice tables / triggers for Supabase (PostgreSQL)
-- Enables pgcrypto for gen_random_uuid() and creates normalized expense tables.

create extension if not exists pgcrypto;

-- Reusable trigger to keep updated_at in sync.
create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.expense_invoices (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id),
  payment_recipient_id uuid references public.payment_recipients(id),
  supplier_name text not null,
  registration_number text,
  invoice_date date not null,
  due_date date,
  total_gross numeric(18,2) not null,
  total_net numeric(18,2) not null,
  tax_amount numeric(18,2) not null,
  bank_account_info jsonb default '{}'::jsonb,
  status text not null default 'Draft',
  submitted_by uuid references public.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint expense_invoices_status_check
    check (status in ('Draft', 'Pending', 'Approved', 'Rejected'))
);

comment on column public.expense_invoices.bank_account_info
  is '銀行名・支店名・口座種別・口座番号などを保持する柔軟なJSONBフィールド';

create index if not exists expense_invoices_application_idx
  on public.expense_invoices (application_id);

create index if not exists expense_invoices_payment_recipient_idx
  on public.expense_invoices (payment_recipient_id);

create index if not exists expense_invoices_submitted_by_idx
  on public.expense_invoices (submitted_by);

create trigger set_expense_invoices_updated_at
before update on public.expense_invoices
for each row
execute function public.set_updated_at_timestamp();

create table if not exists public.expense_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  expense_invoice_id uuid not null
    references public.expense_invoices(id)
    on delete cascade,
  line_number integer,
  line_date date,
  description text not null,
  quantity numeric(18,5),
  unit text,
  unit_price numeric(18,5),
  amount_excl_tax numeric(18,2) not null,
  tax_rate numeric(5,2),
  account_item_id uuid references public.account_items(id),
  allocation_division_id uuid references public.allocation_divisions(id),
  project_id uuid references public.projects(id),
  customer_id uuid references public.customers(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists expense_invoice_lines_invoice_idx
  on public.expense_invoice_lines (expense_invoice_id);

create index if not exists expense_invoice_lines_customer_idx
  on public.expense_invoice_lines (customer_id);

create index if not exists expense_invoice_lines_project_idx
  on public.expense_invoice_lines (project_id);

create trigger set_expense_invoice_lines_updated_at
before update on public.expense_invoice_lines
for each row
execute function public.set_updated_at_timestamp();
