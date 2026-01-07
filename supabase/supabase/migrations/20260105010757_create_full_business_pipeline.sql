-- Rebuild the lead → estimate → project → order → invoice → accounting pipeline
-- Fresh, typed objects; idempotent for forward-only datasets.

-- Reset views to avoid dependency issues during recreate
drop view if exists public.mq_anomalies_view;
drop view if exists public.mq_customer_ltv_view;
drop view if exists public.mq_customer_monthly_view;
drop view if exists public.mq_project_monthly_view;
drop view if exists public.customer_estimate_analysis_view;
drop view if exists public.customer_revenue_analytics_view;
drop view if exists public.customer_ar_status_view;
drop view if exists public.project_cash_status_view;
drop view if exists public.lead_to_cash_view;
drop view if exists public.project_financials_view;
drop view if exists public.pl_monthly_view;
drop view if exists public.bs_monthly_view;
drop view if exists public.project_accounting_view;
drop view if exists public.invoices_list_view;
drop view if exists public.orders_list_view;
drop view if exists public.estimate_details_list_view;
drop view if exists public.estimates_list_view;

-- Sequences for human-friendly codes
create sequence if not exists public.lead_code_seq;
create sequence if not exists public.project_code_seq;
create sequence if not exists public.order_code_seq;
create sequence if not exists public.invoice_code_seq;
create sequence if not exists public.estimate_number_seq;

-- Lead capture
create table if not exists public.leads_v2 (
    id uuid primary key default gen_random_uuid(),
    lead_code text not null unique,
    customer_id uuid references public.customers(id) on delete set null,
    title text not null,
    status text not null check (status in ('new', 'qualified', 'proposal', 'won', 'lost')),
    source text,
    owner_id uuid references public.users(id) on delete set null,
    expected_close_date date,
    expected_amount numeric(14,2),
    notes text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_leads_v2_status_close on public.leads_v2(status, expected_close_date);

-- Project hub with budgets
create table if not exists public.projects_v2 (
    id uuid primary key default gen_random_uuid(),
    project_code text not null unique,
    lead_id uuid references public.leads_v2(id) on delete set null,
    customer_id uuid not null references public.customers(id) on delete restrict,
    project_name text not null,
    status text not null check (status in ('planning', 'in_progress', 'delivery', 'done', 'canceled')),
    delivery_status text not null default 'not_started' check (delivery_status in ('not_started', 'in_progress', 'delivered', 'delayed')),
    budget_sales numeric(14,2) not null default 0,
    budget_cost numeric(14,2) not null default 0,
    baseline_mq_rate numeric(6,4),
    due_date date,
    delivery_date date,
    created_by uuid references public.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_projects_v2_customer on public.projects_v2(customer_id);
create index if not exists idx_projects_v2_status_due on public.projects_v2(status, due_date);

-- Optional monthly/phase budgets
create table if not exists public.project_budgets_v2 (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects_v2(id) on delete cascade,
    period_start date not null,
    period_end date not null,
    budget_sales numeric(14,2) not null default 0,
    budget_cost numeric(14,2) not null default 0,
    notes text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint project_budgets_v2_period_chk check (period_start <= period_end),
    constraint project_budgets_v2_unique unique (project_id, period_start, period_end)
);

-- Estimates (header)
create table if not exists public.estimates_v2 (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects_v2(id) on delete cascade,
    lead_id uuid references public.leads_v2(id) on delete set null,
    estimate_number text not null,
    version integer not null default 1,
    status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'canceled')),
    subtotal numeric(14,2) not null default 0,
    tax_rate numeric(6,4) default 0.1000,
    tax_amount numeric(14,2) generated always as (round(subtotal * coalesce(tax_rate, 0), 2)) stored,
    total numeric(14,2) generated always as (subtotal + round(subtotal * coalesce(tax_rate, 0), 2)) stored,
    currency text not null default 'JPY',
    valid_until date,
    delivery_date date,
    notes text,
    created_by uuid references public.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint estimates_v2_unique_number_per_project unique (project_id, estimate_number, version)
);

-- Estimate detail rows
create table if not exists public.estimate_items_v2 (
    id uuid primary key default gen_random_uuid(),
    estimate_id uuid not null references public.estimates_v2(id) on delete cascade,
    line_no integer not null,
    item_name text not null,
    category text not null default 'other',
    quantity numeric(14,4) not null default 1,
    unit text default 'unit',
    unit_price numeric(14,2) not null default 0,
    variable_cost numeric(14,2) not null default 0,
    tax_rate numeric(6,4),
    amount numeric(14,2) generated always as (quantity * unit_price) stored,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint estimate_items_v2_line_unique unique (estimate_id, line_no)
);
create index if not exists idx_estimate_items_v2_estimate on public.estimate_items_v2(estimate_id);

-- Orders (both revenue and cost types)
create table if not exists public.orders_v2 (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects_v2(id) on delete cascade,
    estimate_id uuid references public.estimates_v2(id) on delete set null,
    order_code text not null unique,
    order_type text not null check (order_type in ('sales', 'purchase', 'subcontract', 'internal')),
    order_date date not null default current_date,
    delivery_date date,
    quantity numeric(14,4) not null default 1,
    unit_price numeric(14,2) not null default 0,
    amount numeric(14,2) generated always as (quantity * unit_price) stored,
    variable_cost numeric(14,2) not null default 0,
    status text not null default 'ordered' check (status in ('ordered', 'in_progress', 'delivered', 'invoiced', 'closed', 'cancelled')),
    cost_confirmed boolean not null default false,
    cost_confirmed_at timestamptz,
    cost_confirmed_by uuid references public.users(id) on delete set null,
    created_by uuid references public.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_orders_v2_project_date on public.orders_v2(project_id, order_date);
create index if not exists idx_orders_v2_status on public.orders_v2(status);
create index if not exists idx_orders_v2_type on public.orders_v2(order_type);

-- Direct project expenses that bypass purchasing
create table if not exists public.project_expenses_v2 (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects_v2(id) on delete cascade,
    expense_date date not null default current_date,
    category text not null,
    description text,
    amount numeric(14,2) not null,
    status text not null default 'submitted' check (status in ('submitted', 'approved', 'paid')),
    created_by uuid references public.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_project_expenses_v2_project_date on public.project_expenses_v2(project_id, expense_date);

-- Invoices (revenue recognition)
create table if not exists public.invoices_v2 (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references public.orders_v2(id) on delete set null,
    project_id uuid not null references public.projects_v2(id) on delete cascade,
    invoice_code text not null unique,
    invoice_date date not null,
    due_date date,
    subtotal numeric(14,2) not null default 0,
    tax_amount numeric(14,2) not null default 0,
    total numeric(14,2) generated always as (subtotal + tax_amount) stored,
    status text not null default 'draft' check (status in ('draft', 'issued', 'sent', 'paid', 'overdue', 'cancelled')),
    created_by uuid references public.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_invoices_v2_project_date on public.invoices_v2(project_id, invoice_date);
create index if not exists idx_invoices_v2_status on public.invoices_v2(status);

-- Receivables (billing)
create table if not exists public.receivables_v2 (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid references public.invoices_v2(id) on delete set null,
    project_id uuid not null references public.projects_v2(id) on delete cascade,
    customer_id uuid references public.customers(id) on delete set null,
    due_date date not null,
    amount numeric(14,2) not null,
    paid_amount numeric(14,2) not null default 0,
    status text not null default 'outstanding' check (status in ('outstanding', 'partially_paid', 'paid', 'overdue')),
    last_payment_date date,
    created_by uuid references public.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_receivables_v2_customer on public.receivables_v2(customer_id);
create index if not exists idx_receivables_v2_project on public.receivables_v2(project_id);
create index if not exists idx_receivables_v2_due on public.receivables_v2(due_date, status);

-- Receipts (cash-in)
create table if not exists public.receipts_v2 (
    id uuid primary key default gen_random_uuid(),
    receivable_id uuid not null references public.receivables_v2(id) on delete cascade,
    payment_date date not null default current_date,
    amount numeric(14,2) not null,
    method text,
    reference text,
    memo text,
    created_by uuid references public.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_receipts_v2_receivable on public.receipts_v2(receivable_id);
create index if not exists idx_receipts_v2_date on public.receipts_v2(payment_date);

-- Payables (cash-out)
create table if not exists public.payables_v2 (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects_v2(id) on delete cascade,
    supplier_id uuid references public.payment_recipients(id) on delete set null,
    order_id uuid references public.orders_v2(id) on delete set null,
    due_date date not null,
    amount numeric(14,2) not null,
    paid_amount numeric(14,2) not null default 0,
    status text not null default 'outstanding' check (status in ('outstanding', 'partially_paid', 'paid', 'overdue')),
    last_payment_date date,
    description text,
    created_by uuid references public.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_payables_v2_project on public.payables_v2(project_id);
create index if not exists idx_payables_v2_due on public.payables_v2(due_date, status);
create index if not exists idx_payables_v2_supplier on public.payables_v2(supplier_id);

-- Disbursements (cash-out payments)
create table if not exists public.disbursements_v2 (
    id uuid primary key default gen_random_uuid(),
    payable_id uuid not null references public.payables_v2(id) on delete cascade,
    payment_date date not null default current_date,
    amount numeric(14,2) not null,
    method text,
    reference text,
    memo text,
    created_by uuid references public.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_disbursements_v2_payable on public.disbursements_v2(payable_id);
create index if not exists idx_disbursements_v2_date on public.disbursements_v2(payment_date);

-- RPCs / helpers
create or replace function public.generate_lead_code()
returns text
language plpgsql
stable
as $$
declare
    seq bigint;
begin
    select nextval('public.lead_code_seq') into seq;
    return 'L' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || lpad(seq::text, 4, '0');
end;
$$;

create or replace function public.generate_project_code()
returns text
language plpgsql
stable
as $$
declare
    seq bigint;
begin
    select nextval('public.project_code_seq') into seq;
    return 'P' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || lpad(seq::text, 4, '0');
end;
$$;

create or replace function public.generate_order_code()
returns text
language plpgsql
stable
as $$
declare
    seq bigint;
begin
    select nextval('public.order_code_seq') into seq;
    return 'O' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || lpad(seq::text, 4, '0');
end;
$$;

create or replace function public.generate_invoice_code()
returns text
language plpgsql
stable
as $$
declare
    seq bigint;
begin
    select nextval('public.invoice_code_seq') into seq;
    return 'I' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || lpad(seq::text, 4, '0');
end;
$$;

create or replace function public.generate_estimate_number()
returns text
language plpgsql
stable
as $$
declare
    seq bigint;
begin
    select nextval('public.estimate_number_seq') into seq;
    return 'E' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || lpad(seq::text, 4, '0');
end;
$$;

-- Make codes auto-generated for direct inserts
alter table if exists public.leads_v2
    alter column lead_code set default public.generate_lead_code();

alter table if exists public.projects_v2
    alter column project_code set default public.generate_project_code();

alter table if exists public.estimates_v2
    alter column estimate_number set default public.generate_estimate_number();

alter table if exists public.orders_v2
    alter column order_code set default public.generate_order_code();

alter table if exists public.invoices_v2
    alter column invoice_code set default public.generate_invoice_code();

-- Create lead with generated code
create or replace function public.create_lead_v2(
    p_title text,
    p_customer_id uuid default null,
    p_status text default 'new',
    p_source text default null,
    p_owner_id uuid default null,
    p_expected_close_date date default null,
    p_expected_amount numeric default null,
    p_notes text default null
)
returns public.leads_v2
language plpgsql
as $$
declare
    v_code text;
    v_row public.leads_v2;
begin
    v_code := public.generate_lead_code();
    insert into public.leads_v2 (
        lead_code, customer_id, title, status, source, owner_id, expected_close_date,
        expected_amount, notes
    )
    values (
        v_code, p_customer_id, p_title, coalesce(p_status, 'new'), p_source, p_owner_id,
        p_expected_close_date, p_expected_amount, p_notes
    )
    returning * into v_row;
    return v_row;
end;
$$;

-- Create project linked to lead/customer with budgets and generated code
create or replace function public.create_project_v2(
    p_lead_id uuid,
    p_customer_id uuid,
    p_project_name text,
    p_budget_sales numeric default 0,
    p_budget_cost numeric default 0,
    p_due_date date default null,
    p_status text default 'planning',
    p_delivery_status text default 'not_started',
    p_created_by uuid default null
)
returns public.projects_v2
language plpgsql
as $$
declare
    v_code text;
    v_project public.projects_v2;
begin
    v_code := public.generate_project_code();

    insert into public.projects_v2 (
        project_code, lead_id, customer_id, project_name,
        status, delivery_status, budget_sales, budget_cost,
        due_date, created_by
    )
    values (
        v_code, p_lead_id, p_customer_id, p_project_name,
        p_status, p_delivery_status, coalesce(p_budget_sales, 0), coalesce(p_budget_cost, 0),
        p_due_date, p_created_by
    )
    returning * into v_project;

    return v_project;
end;
$$;

-- Upsert project budget period
create or replace function public.upsert_project_budget_v2(
    p_project_id uuid,
    p_period_start date,
    p_period_end date,
    p_budget_sales numeric,
    p_budget_cost numeric,
    p_notes text default null
)
returns public.project_budgets_v2
language plpgsql
as $$
declare
    v_row public.project_budgets_v2;
begin
    insert into public.project_budgets_v2 (
        project_id, period_start, period_end, budget_sales, budget_cost, notes
    )
    values (
        p_project_id, p_period_start, p_period_end, coalesce(p_budget_sales,0), coalesce(p_budget_cost,0), p_notes
    )
    on conflict (project_id, period_start, period_end) do update
    set budget_sales = excluded.budget_sales,
        budget_cost = excluded.budget_cost,
        notes = excluded.notes,
        updated_at = timezone('utc', now())
    returning * into v_row;

    return v_row;
end;
$$;

-- Accept an estimate: mark siblings as rejected, push forecast into project
create or replace function public.accept_estimate_v2(p_estimate_id uuid)
returns public.estimates_v2
language plpgsql
as $$
declare
    v_est public.estimates_v2;
begin
    select * into v_est from public.estimates_v2 where id = p_estimate_id;
    if not found then
        raise exception 'estimate % not found', p_estimate_id;
    end if;

    update public.estimates_v2
    set status = 'rejected',
        updated_at = timezone('utc', now())
    where project_id = v_est.project_id
      and id <> v_est.id
      and status not in ('canceled', 'rejected');

    update public.estimates_v2
    set status = 'accepted',
        updated_at = timezone('utc', now())
    where id = v_est.id;

    update public.projects_v2
    set baseline_mq_rate = nullif(
        case
            when v_est.subtotal > 0 and exists (
                select 1 from public.estimate_items_v2 ei where ei.estimate_id = v_est.id
            ) then (
                v_est.subtotal - coalesce((
                    select sum(variable_cost) from public.estimate_items_v2 where estimate_id = v_est.id
                ), 0)
            ) / v_est.subtotal
        end, 0
    ),
    updated_at = timezone('utc', now())
    where id = v_est.project_id;

    return (select * from public.estimates_v2 where id = v_est.id);
end;
$$;

-- Create estimate with items and optional auto-numbering
create or replace function public.create_estimate_with_items_v2(
    p_project_id uuid,
    p_lead_id uuid default null,
    p_estimate_number text default null,
    p_version integer default 1,
    p_status text default 'draft',
    p_tax_rate numeric default 0.1,
    p_delivery_date date default null,
    p_valid_until date default null,
    p_notes text default null,
    p_currency text default 'JPY',
    p_items jsonb default '[]'::jsonb,
    p_created_by uuid default null
)
returns public.estimates_v2
language plpgsql
as $$
declare
    v_est public.estimates_v2;
    v_subtotal numeric(14,2) := 0;
    v_line_no integer := 0;
    rec jsonb;
    v_number text;
begin
    v_number := coalesce(nullif(p_estimate_number, ''), public.generate_estimate_number());

    -- compute subtotal
    for rec in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
        v_subtotal := v_subtotal + coalesce((rec->>'quantity')::numeric, 1) * coalesce((rec->>'unit_price')::numeric, 0);
    end loop;

    insert into public.estimates_v2 (
        project_id, lead_id, estimate_number, version, status, subtotal,
        tax_rate, currency, valid_until, delivery_date, notes, created_by
    ) values (
        p_project_id, p_lead_id, v_number, coalesce(p_version, 1), coalesce(p_status, 'draft'),
        coalesce(v_subtotal, 0), coalesce(p_tax_rate, 0.1), coalesce(p_currency, 'JPY'),
        p_valid_until, p_delivery_date, p_notes, p_created_by
    )
    returning * into v_est;

    -- insert items
    v_line_no := 0;
    for rec in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
        v_line_no := coalesce((rec->>'line_no')::integer, v_line_no + 1);
        insert into public.estimate_items_v2 (
            estimate_id, line_no, item_name, category, quantity, unit, unit_price, variable_cost, tax_rate
        ) values (
            v_est.id,
            v_line_no,
            coalesce(nullif(rec->>'item_name', ''), 'Item ' || v_line_no),
            coalesce(nullif(rec->>'category', ''), 'other'),
            coalesce((rec->>'quantity')::numeric, 1),
            coalesce(nullif(rec->>'unit', ''), 'unit'),
            coalesce((rec->>'unit_price')::numeric, 0),
            coalesce((rec->>'variable_cost')::numeric, 0),
            nullif((rec->>'tax_rate')::numeric, 0)
        );
    end loop;

    return (select * from public.estimates_v2 where id = v_est.id);
end;
$$;

-- Create order with generated code
create or replace function public.create_order_v2(
    p_project_id uuid,
    p_order_type text,
    p_estimate_id uuid default null,
    p_order_date date default current_date,
    p_delivery_date date default null,
    p_quantity numeric default 1,
    p_unit_price numeric default 0,
    p_variable_cost numeric default 0,
    p_status text default 'ordered',
    p_created_by uuid default null
)
returns public.orders_v2
language plpgsql
as $$
declare
    v_code text;
    v_row public.orders_v2;
begin
    v_code := public.generate_order_code();

    insert into public.orders_v2 (
        project_id, estimate_id, order_code, order_type, order_date, delivery_date,
        quantity, unit_price, variable_cost, status, created_by
    )
    values (
        p_project_id, p_estimate_id, v_code, p_order_type, coalesce(p_order_date, current_date), p_delivery_date,
        coalesce(p_quantity, 1), coalesce(p_unit_price, 0), coalesce(p_variable_cost, 0),
        coalesce(p_status, 'ordered'), p_created_by
    )
    returning * into v_row;

    return v_row;
end;
$$;

-- Confirm order cost
create or replace function public.confirm_order_cost_v2(p_order_id uuid, p_user_id uuid)
returns public.orders_v2
language plpgsql
as $$
declare
    v_row public.orders_v2;
begin
    update public.orders_v2
    set cost_confirmed = true,
        cost_confirmed_at = timezone('utc', now()),
        cost_confirmed_by = p_user_id,
        updated_at = timezone('utc', now())
    where id = p_order_id
    returning * into v_row;

    if not found then
        raise exception 'order % not found', p_order_id;
    end if;
    return v_row;
end;
$$;

-- Create invoice with generated code
create or replace function public.create_invoice_v2(
    p_project_id uuid,
    p_invoice_date date,
    p_subtotal numeric,
    p_order_id uuid default null,
    p_due_date date default null,
    p_tax_amount numeric default 0,
    p_status text default 'draft',
    p_created_by uuid default null
)
returns public.invoices_v2
language plpgsql
as $$
declare
    v_code text;
    v_row public.invoices_v2;
begin
    if p_invoice_date is null then
        raise exception 'invoice_date is required';
    end if;

    v_code := public.generate_invoice_code();

    insert into public.invoices_v2 (
        order_id, project_id, invoice_code, invoice_date, due_date,
        subtotal, tax_amount, status, created_by
    )
    values (
        p_order_id, p_project_id, v_code, p_invoice_date, p_due_date,
        coalesce(p_subtotal, 0), coalesce(p_tax_amount, 0),
        coalesce(p_status, 'draft'), p_created_by
    )
    returning * into v_row;

    return v_row;
end;
$$;

-- Create receivable from invoice
create or replace function public.create_receivable_from_invoice_v2(
    p_invoice_id uuid,
    p_due_date date default null,
    p_amount numeric default null,
    p_created_by uuid default null
)
returns public.receivables_v2
language plpgsql
as $$
declare
    v_inv public.invoices_v2;
    v_row public.receivables_v2;
begin
    select * into v_inv from public.invoices_v2 where id = p_invoice_id;
    if not found then
        raise exception 'invoice % not found', p_invoice_id;
    end if;

    insert into public.receivables_v2 (
        invoice_id, project_id, customer_id, due_date, amount, created_by
    )
    values (
        v_inv.id, v_inv.project_id, (select customer_id from public.projects_v2 where id = v_inv.project_id),
        coalesce(p_due_date, v_inv.due_date, v_inv.invoice_date), coalesce(p_amount, v_inv.total), p_created_by
    )
    returning * into v_row;

    return v_row;
end;
$$;

-- Record receipt against receivable
create or replace function public.record_receipt_v2(
    p_receivable_id uuid,
    p_payment_date date,
    p_amount numeric,
    p_method text default null,
    p_reference text default null,
    p_memo text default null,
    p_created_by uuid default null
)
returns public.receipts_v2
language plpgsql
as $$
declare
    v_receivable public.receivables_v2;
    v_row public.receipts_v2;
    v_new_paid numeric;
begin
    select * into v_receivable from public.receivables_v2 where id = p_receivable_id for update;
    if not found then
        raise exception 'receivable % not found', p_receivable_id;
    end if;

    insert into public.receipts_v2 (
        receivable_id, payment_date, amount, method, reference, memo, created_by
    ) values (
        p_receivable_id, coalesce(p_payment_date, current_date), coalesce(p_amount, 0),
        p_method, p_reference, p_memo, p_created_by
    ) returning * into v_row;

    v_new_paid := v_receivable.paid_amount + v_row.amount;

    update public.receivables_v2
    set paid_amount = v_new_paid,
        last_payment_date = v_row.payment_date,
        status = case
            when v_new_paid >= v_receivable.amount then 'paid'
            when v_row.payment_date > v_receivable.due_date then 'overdue'
            else 'partially_paid'
        end,
        updated_at = timezone('utc', now())
    where id = v_receivable.id;

    return v_row;
end;
$$;

-- Create payable (e.g., from purchase/subcontract order)
create or replace function public.create_payable_v2(
    p_project_id uuid,
    p_due_date date,
    p_amount numeric,
    p_supplier_id uuid default null,
    p_order_id uuid default null,
    p_description text default null,
    p_status text default 'outstanding',
    p_created_by uuid default null
)
returns public.payables_v2
language plpgsql
as $$
declare
    v_row public.payables_v2;
    v_order public.orders_v2;
begin
    if p_due_date is null then
        raise exception 'due_date is required';
    end if;

    if p_order_id is not null then
        select * into v_order from public.orders_v2 where id = p_order_id;
    end if;

    insert into public.payables_v2 (
        project_id, supplier_id, order_id, due_date, amount, description, status, created_by
    )
    values (
        coalesce(p_project_id, v_order.project_id),
        p_supplier_id,
        p_order_id,
        p_due_date,
        coalesce(p_amount, case when v_order.order_type = 'sales' then v_order.variable_cost else v_order.amount end),
        p_description,
        coalesce(p_status, 'outstanding'),
        p_created_by
    )
    returning * into v_row;

    return v_row;
end;
$$;

-- Record disbursement against payable
create or replace function public.record_disbursement_v2(
    p_payable_id uuid,
    p_payment_date date,
    p_amount numeric,
    p_method text default null,
    p_reference text default null,
    p_memo text default null,
    p_created_by uuid default null
)
returns public.disbursements_v2
language plpgsql
as $$
declare
    v_payable public.payables_v2;
    v_row public.disbursements_v2;
    v_new_paid numeric;
begin
    select * into v_payable from public.payables_v2 where id = p_payable_id for update;
    if not found then
        raise exception 'payable % not found', p_payable_id;
    end if;

    insert into public.disbursements_v2 (
        payable_id, payment_date, amount, method, reference, memo, created_by
    ) values (
        p_payable_id, coalesce(p_payment_date, current_date), coalesce(p_amount, 0),
        p_method, p_reference, p_memo, p_created_by
    ) returning * into v_row;

    v_new_paid := v_payable.paid_amount + v_row.amount;

    update public.payables_v2
    set paid_amount = v_new_paid,
        last_payment_date = v_row.payment_date,
        status = case
            when v_new_paid >= v_payable.amount then 'paid'
            when v_row.payment_date > v_payable.due_date then 'overdue'
            else 'partially_paid'
        end,
        updated_at = timezone('utc', now())
    where id = v_payable.id;

    return v_row;
end;
$$;

-- Display-safe: estimate details
create or replace view public.estimate_details_list_view as
select
    ei.estimate_id,
    ei.id as detail_id,
    ei.line_no,
    ei.item_name,
    ei.category,
    ei.quantity,
    ei.unit,
    ei.unit_price,
    ei.amount as sales_amount,
    ei.variable_cost as variable_cost_amount,
    ei.amount - ei.variable_cost as mq_amount,
    case when ei.amount > 0 then (ei.amount - ei.variable_cost) / ei.amount end as mq_rate,
    ei.tax_rate,
    ei.created_at,
    ei.updated_at
from public.estimate_items_v2 ei;

-- Display-safe: estimates
create or replace view public.estimates_list_view as
with item_rollup as (
    select
        estimate_id,
        sum(amount) as sales_amount,
        sum(variable_cost) as variable_cost_amount,
        count(*) as line_count,
        max(tax_rate) as item_tax_rate
    from public.estimate_items_v2
    group by estimate_id
),
ranked_estimates as (
    select
        e.*,
        row_number() over (
            partition by e.project_id
            order by case when e.status = 'accepted' then 0 when e.status = 'sent' then 1 else 2 end,
                     e.version desc,
                     e.created_at desc
        ) as rn
    from public.estimates_v2 e
)
select
    e.id as estimate_id,
    e.project_id,
    p.project_code,
    p.project_name,
    p.customer_id,
    c.customer_name,
    e.lead_id,
    l.lead_code,
    e.estimate_number,
    e.version,
    e.status,
    e.delivery_date,
    e.valid_until,
    coalesce(e.subtotal, ir.sales_amount) as subtotal,
    coalesce(e.tax_amount, round(coalesce(e.subtotal, ir.sales_amount) * coalesce(e.tax_rate, ir.item_tax_rate, 0), 2)) as tax_amount,
    coalesce(e.total, coalesce(e.subtotal, ir.sales_amount) + round(coalesce(e.subtotal, ir.sales_amount) * coalesce(e.tax_rate, ir.item_tax_rate, 0), 2)) as total,
    ir.variable_cost_amount,
    coalesce(e.subtotal, ir.sales_amount) - coalesce(ir.variable_cost_amount, 0) as mq_amount,
    case when coalesce(e.subtotal, ir.sales_amount) > 0
        then (coalesce(e.subtotal, ir.sales_amount) - coalesce(ir.variable_cost_amount, 0)) / coalesce(e.subtotal, ir.sales_amount)
    end as mq_rate,
    ir.line_count as detail_count,
    e.currency,
    e.notes,
    e.created_by,
    e.created_at,
    e.updated_at,
    (re.rn = 1) as is_primary_for_project
from ranked_estimates re
join public.estimates_v2 e on e.id = re.id
left join item_rollup ir on ir.estimate_id = e.id
left join public.projects_v2 p on p.id = e.project_id
left join public.customers c on c.id = p.customer_id
left join public.leads_v2 l on l.id = e.lead_id;

-- Display-safe: orders
create or replace view public.orders_list_view as
select
    o.id as order_id,
    o.order_code,
    o.project_id,
    p.project_code,
    p.project_name,
    p.customer_id,
    o.estimate_id,
    o.order_type,
    o.order_date,
    o.delivery_date,
    o.quantity,
    o.unit_price,
    case when o.order_type = 'sales' then o.amount else 0 end as sales_amount,
    case when o.order_type = 'sales' then o.variable_cost else o.amount end as variable_cost_amount,
    case
        when o.order_type = 'sales' then o.amount - o.variable_cost
        else 0 - o.amount
    end as mq_amount,
    case
        when o.order_type = 'sales' and o.amount > 0 then (o.amount - o.variable_cost) / o.amount
        when o.order_type <> 'sales' and o.amount > 0 then (0 - o.amount) / o.amount
    end as mq_rate,
    o.status,
    o.cost_confirmed,
    o.cost_confirmed_at,
    o.cost_confirmed_by,
    o.created_by,
    o.created_at,
    o.updated_at
from public.orders_v2 o
join public.projects_v2 p on p.id = o.project_id;

-- Display-safe: invoices
create or replace view public.invoices_list_view as
select
    i.id as invoice_id,
    i.invoice_code,
    i.project_id,
    p.project_code,
    p.project_name,
    p.customer_id,
    i.order_id,
    i.invoice_date,
    i.due_date,
    i.subtotal,
    i.tax_amount,
    i.total as sales_amount,
    null::numeric as variable_cost_amount,
    null::numeric as mq_amount,
    null::numeric as mq_rate,
    i.status,
    i.created_by,
    i.created_at,
    i.updated_at
from public.invoices_v2 i
join public.projects_v2 p on p.id = i.project_id;

-- Budget vs. actual at project level
create or replace view public.project_financials_view as
with estimate_primary as (
    select *
    from public.estimates_list_view
    where is_primary_for_project
),
order_agg as (
    select
        o.project_id,
        sum(case when o.order_type = 'sales' then o.amount else 0 end) as sales_amount,
        sum(case when o.order_type = 'sales' then o.variable_cost else o.amount end) as variable_cost_amount
    from public.orders_v2 o
    group by o.project_id
),
invoice_agg as (
    select
        project_id,
        sum(total) as sales_amount
    from public.invoices_v2
    group by project_id
),
expense_agg as (
    select project_id, sum(amount) as expense_amount
    from public.project_expenses_v2
    group by project_id
)
select
    p.id as project_id,
    p.project_code,
    p.project_name,
    p.customer_id,
    p.status,
    p.delivery_status,
    p.due_date,
    p.budget_sales,
    p.budget_cost,
    ep.estimate_id as primary_estimate_id,
    ep.total as forecast_sales,
    ep.variable_cost_amount as forecast_cost,
    ep.mq_rate as forecast_mq_rate,
    coalesce(inv.sales_amount, oa.sales_amount, 0) as sales_actual,
    coalesce(oa.variable_cost_amount, 0) + coalesce(exa.expense_amount, 0) as cost_actual,
    coalesce(inv.sales_amount, oa.sales_amount, 0) - (coalesce(oa.variable_cost_amount, 0) + coalesce(exa.expense_amount, 0)) as mq_amount,
    case
        when coalesce(inv.sales_amount, oa.sales_amount, 0) > 0
            then (
                coalesce(inv.sales_amount, oa.sales_amount, 0) - (coalesce(oa.variable_cost_amount, 0) + coalesce(exa.expense_amount, 0))
            ) / coalesce(inv.sales_amount, oa.sales_amount, 0)
    end as mq_rate,
    p.budget_sales - coalesce(inv.sales_amount, oa.sales_amount, 0) as sales_variance,
    p.budget_cost - (coalesce(oa.variable_cost_amount, 0) + coalesce(exa.expense_amount, 0)) as cost_variance,
    ep.status as estimate_status,
    ep.delivery_date as estimated_delivery_date
from public.projects_v2 p
left join estimate_primary ep on ep.project_id = p.id
left join order_agg oa on oa.project_id = p.id
left join invoice_agg inv on inv.project_id = p.id
left join expense_agg exa on exa.project_id = p.id;

-- Lead → cash view
create or replace view public.lead_to_cash_view as
with order_dates as (
    select project_id, min(order_date) as first_order_date, max(order_date) as last_order_date
    from public.orders_v2
    group by project_id
),
invoice_dates as (
    select project_id, min(invoice_date) as first_invoice_date, max(invoice_date) as last_invoice_date
    from public.invoices_v2
    group by project_id
)
select
    l.id as lead_id,
    l.lead_code,
    l.status as lead_status,
    l.expected_close_date,
    l.expected_amount,
    p.id as project_id,
    p.project_code,
    p.project_name,
    p.status as project_status,
    ep.estimate_id as estimate_id,
    ep.status as estimate_status,
    od.first_order_date,
    od.last_order_date,
    inv.first_invoice_date,
    inv.last_invoice_date,
    pf.sales_actual,
    pf.cost_actual,
    pf.mq_amount,
    pf.mq_rate
from public.leads_v2 l
left join public.projects_v2 p on p.lead_id = l.id
left join public.estimates_list_view ep on ep.project_id = p.id and ep.is_primary_for_project
left join order_dates od on od.project_id = p.id
left join invoice_dates inv on inv.project_id = p.id
left join public.project_financials_view pf on pf.project_id = p.id;

-- MQ monthly per project (invoice > order > estimate precedence)
create or replace view public.mq_project_monthly_view as
with base as (
    select project_id, 'estimate' as source, coalesce(delivery_date, valid_until) as dt,
        subtotal as sales_amount,
        variable_cost_amount,
        0::integer as order_count
    from public.estimates_list_view
    union all
    select project_id, 'order' as source, order_date as dt,
        case when order_type = 'sales' then amount else 0 end as sales_amount,
        case when order_type = 'sales' then variable_cost else amount end as variable_cost_amount,
        case when order_type = 'sales' then 1 else 0 end as order_count
    from public.orders_v2
    union all
    select project_id, 'invoice' as source, invoice_date as dt,
        total as sales_amount,
        0::numeric as variable_cost_amount,
        0::integer as order_count
    from public.invoices_v2
),
project_month_source as (
    select
        b.project_id,
        date_trunc('month', b.dt)::date as month,
        b.source,
        sum(b.sales_amount) as sales_amount,
        sum(b.variable_cost_amount) as variable_cost_amount,
        sum(b.order_count) as order_count
    from base b
    where b.dt is not null
    group by b.project_id, date_trunc('month', b.dt)::date, b.source
),
ranked as (
    select
        pms.*,
        row_number() over (
            partition by pms.project_id, pms.month
            order by case pms.source when 'invoice' then 1 when 'order' then 2 else 3 end
        ) as source_rank
    from project_month_source pms
)
select
    project_id,
    month,
    sales_amount,
    variable_cost_amount,
    case when sales_amount is not null and variable_cost_amount is not null then sales_amount - variable_cost_amount end as mq_amount,
    case when sales_amount > 0 and variable_cost_amount is not null then (sales_amount - variable_cost_amount) / sales_amount end as mq_rate,
    order_count
from ranked
where source_rank = 1;

-- MQ monthly per customer
create or replace view public.mq_customer_monthly_view as
select
    p.customer_id,
    m.month,
    sum(m.sales_amount) as sales_amount,
    sum(m.variable_cost_amount) as variable_cost_amount,
    sum(m.order_count) as order_count,
    sum(m.sales_amount) - sum(m.variable_cost_amount) as mq_amount,
    case when sum(m.sales_amount) > 0 then (sum(m.sales_amount) - sum(m.variable_cost_amount)) / sum(m.sales_amount) end as mq_rate
from public.mq_project_monthly_view m
join public.projects_v2 p on p.id = m.project_id
group by p.customer_id, m.month;

-- Lifetime KPI per customer
create or replace view public.mq_customer_ltv_view as
with base as (
    select project_id, 'estimate' as source, delivery_date as dt, subtotal as sales_amount, variable_cost_amount, 0::integer as order_count from public.estimates_list_view
    union all
    select project_id, 'order' as source, order_date, case when order_type = 'sales' then amount else 0 end, case when order_type = 'sales' then variable_cost else amount end, case when order_type = 'sales' then 1 else 0 end from public.orders_v2
    union all
    select project_id, 'invoice' as source, invoice_date, total, 0::numeric, 0::integer from public.invoices_v2
),
project_source_totals as (
    select
        b.project_id,
        b.source,
        sum(b.sales_amount) as sales_amount,
        sum(b.variable_cost_amount) as variable_cost_amount,
        sum(b.order_count) as order_count,
        max(b.dt) as last_transaction_date
    from base b
    where b.dt is not null
    group by b.project_id, b.source
),
ranked as (
    select
        pst.*,
        row_number() over (
            partition by pst.project_id
            order by case pst.source when 'invoice' then 1 when 'order' then 2 else 3 end
        ) as source_rank
    from project_source_totals pst
)
select
    p.customer_id,
    sum(r.sales_amount) as lifetime_sales_amount,
    sum(r.variable_cost_amount) as lifetime_variable_cost_amount,
    case
        when sum(r.variable_cost_amount) is null then null
        else sum(r.sales_amount) - sum(r.variable_cost_amount)
    end as lifetime_mq_amount,
    case
        when sum(r.sales_amount) > 0 and sum(r.variable_cost_amount) is not null
            then (sum(r.sales_amount) - sum(r.variable_cost_amount)) / sum(r.sales_amount)
    end as lifetime_mq_rate,
    max(r.last_transaction_date) as last_transaction_date,
    sum(r.order_count) as order_count
from ranked r
join public.projects_v2 p on p.id = r.project_id
where r.source_rank = 1
group by p.customer_id;

-- Customer lifetime + recency analytics (invoice > order > estimate precedence)
create or replace view public.customer_revenue_analytics_view as
with base as (
    select project_id, 'invoice' as source, invoice_date as dt, total as sales_amount, 0::numeric as variable_cost_amount from public.invoices_v2
    union all
    select project_id, 'order' as source, order_date as dt,
        case when order_type = 'sales' then amount else 0 end as sales_amount,
        case when order_type = 'sales' then variable_cost else amount end as variable_cost_amount
    from public.orders_v2
    union all
    select project_id, 'estimate' as source, delivery_date as dt, subtotal as sales_amount, variable_cost_amount
    from public.estimates_list_view
),
ranked as (
    select
        b.*,
        row_number() over (
            partition by b.project_id
            order by case b.source when 'invoice' then 1 when 'order' then 2 else 3 end
        ) as source_rank
    from base b
    where b.dt is not null
)
select
    p.customer_id,
    count(distinct p.id) as project_count,
    min(r.dt) as first_transaction_date,
    max(r.dt) as last_transaction_date,
    sum(r.sales_amount) as lifetime_sales_amount,
    sum(r.variable_cost_amount) as lifetime_variable_cost_amount,
    sum(r.sales_amount) - sum(r.variable_cost_amount) as lifetime_mq_amount,
    case
        when sum(r.sales_amount) > 0 then (sum(r.sales_amount) - sum(r.variable_cost_amount)) / sum(r.sales_amount)
    end as lifetime_mq_rate
from ranked r
join public.projects_v2 p on p.id = r.project_id
where r.source_rank = 1
group by p.customer_id;

-- Customer estimate analysis (hit rate, totals)
create or replace view public.customer_estimate_analysis_view as
with base as (
    select
        p.customer_id,
        e.status,
        e.total,
        e.mq_rate,
        e.detail_count,
        e.created_at
    from public.estimates_list_view e
    join public.projects_v2 p on p.id = e.project_id
)
select
    customer_id,
    count(*) as estimate_count,
    sum(case when status = 'accepted' then 1 else 0 end) as accepted_count,
    sum(case when status = 'sent' then 1 else 0 end) as sent_count,
    sum(case when status = 'rejected' then 1 else 0 end) as rejected_count,
    sum(coalesce(total, 0)) as estimate_total_amount,
    sum(case when status = 'accepted' then coalesce(total, 0) else 0 end) as accepted_total_amount,
    case when count(*) > 0 then sum(case when status = 'accepted' then 1 else 0 end)::numeric / count(*) end as hit_rate_count,
    case when sum(coalesce(total, 0)) > 0 then sum(case when status = 'accepted' then coalesce(total, 0) else 0 end) / sum(coalesce(total, 0)) end as hit_rate_amount,
    avg(mq_rate) as avg_mq_rate,
    avg(detail_count) as avg_detail_lines,
    max(created_at) as last_estimate_created_at
from base
group by customer_id;

-- Customer AR snapshot
create or replace view public.customer_ar_status_view as
select
    r.customer_id,
    sum(case when r.status in ('outstanding','partially_paid') then r.amount - r.paid_amount else 0 end) as ar_outstanding,
    sum(case when r.status = 'overdue' then r.amount - r.paid_amount else 0 end) as ar_overdue,
    max(r.last_payment_date) as last_receipt_date,
    max(r.due_date) filter (where r.status in ('outstanding','partially_paid','overdue')) as next_due_date
from public.receivables_v2 r
group by r.customer_id;

-- Project cash (AR/AP) snapshot
create or replace view public.project_cash_status_view as
select
    p.id as project_id,
    p.project_code,
    p.project_name,
    coalesce(ar.ar_outstanding, 0) as ar_outstanding,
    coalesce(ap.ap_outstanding, 0) as ap_outstanding,
    ar.next_ar_due_date,
    ap.next_ap_due_date
from public.projects_v2 p
left join lateral (
    select
        sum(coalesce(r.amount,0) - coalesce(r.paid_amount,0)) as ar_outstanding,
        max(r.due_date) filter (where coalesce(r.amount,0) - coalesce(r.paid_amount,0) > 0) as next_ar_due_date
    from public.receivables_v2 r
    where r.project_id = p.id
) ar on true
left join lateral (
    select
        sum(coalesce(pa.amount,0) - coalesce(pa.paid_amount,0)) as ap_outstanding,
        max(pa.due_date) filter (where coalesce(pa.amount,0) - coalesce(pa.paid_amount,0) > 0) as next_ap_due_date
    from public.payables_v2 pa
    where pa.project_id = p.id
) ap on true;

-- Accounting rollups (P/L)
create or replace view public.pl_monthly_view as
select
    date_trunc('month', je.entry_date)::date as month,
    acc.category_code,
    acc.code as account_code,
    acc.name as account_name,
    sum(
        case
            when upper(acc.category_code) in ('REVENUE', 'INCOME') then (jl.credit - jl.debit)
            when upper(acc.category_code) in ('EXPENSE', 'COST', 'COGS') then (jl.debit - jl.credit)
            else (jl.debit - jl.credit)
        end
    ) as amount
from accounting.journal_lines jl
join accounting.journal_entries je on je.id = jl.journal_entry_id
join accounting.accounts acc on acc.id = jl.account_id
group by date_trunc('month', je.entry_date)::date, acc.category_code, acc.code, acc.name;

-- Accounting rollups (B/S snapshot by month-end)
create or replace view public.bs_monthly_view as
select
    date_trunc('month', je.entry_date)::date as month,
    acc.category_code,
    acc.code as account_code,
    acc.name as account_name,
    sum(jl.debit - jl.credit) as balance
from accounting.journal_lines jl
join accounting.journal_entries je on je.id = jl.journal_entry_id
join accounting.accounts acc on acc.id = jl.account_id
where upper(acc.category_code) in ('ASSET', 'LIABILITY', 'EQUITY')
group by date_trunc('month', je.entry_date)::date, acc.category_code, acc.code, acc.name;

-- Accounting tagged by project for granular profitability
create or replace view public.project_accounting_view as
select
    coalesce(jl.project_id, p.id) as project_id,
    date_trunc('month', je.entry_date)::date as month,
    sum(case when upper(acc.category_code) in ('REVENUE', 'INCOME') then (jl.credit - jl.debit) else 0 end) as revenue_amount,
    sum(case when upper(acc.category_code) in ('EXPENSE', 'COST', 'COGS') then (jl.debit - jl.credit) else 0 end) as cost_amount,
    sum(jl.debit - jl.credit) as net_amount
from accounting.journal_lines jl
join accounting.journal_entries je on je.id = jl.journal_entry_id
join accounting.accounts acc on acc.id = jl.account_id
left join public.projects_v2 p on p.id = jl.project_id
group by coalesce(jl.project_id, p.id), date_trunc('month', je.entry_date)::date;

-- Anomaly detection tuned for clean data
create or replace view public.mq_anomalies_view as
select
  'estimate' as level,
  e.project_id,
  e.estimate_id::text as record_id,
  e.delivery_date as dt,
  e.subtotal as sales_amount,
  e.variable_cost_amount as variable_cost_amount,
  e.mq_amount,
  e.mq_rate,
  case
    when e.detail_count = 0 then '明細なし'
    when e.variable_cost_amount is null or e.variable_cost_amount = 0 then '原価未入力'
    when e.mq_rate < 0 then 'MQ率<0'
    when e.mq_rate > 1.2 then 'MQ率>1.2'
  end as anomaly_reason
from public.estimates_list_view e
where
  e.detail_count = 0
  or e.variable_cost_amount is null
  or e.mq_rate < 0
  or e.mq_rate > 1.2
union all
select
  'project_month' as level,
  m.project_id,
  null::text as record_id,
  m.month as dt,
  m.sales_amount,
  m.variable_cost_amount,
  m.mq_amount,
  m.mq_rate,
  case
    when m.sales_amount is null then '売上null'
    when m.variable_cost_amount is null then '変動費null'
    when m.mq_rate is null then 'MQ率null'
    when m.mq_rate < 0 then 'MQ率<0'
    when m.mq_rate > 1.2 then 'MQ率>1.2'
  end as anomaly_reason
from public.mq_project_monthly_view m
where
  m.sales_amount is null
  or m.variable_cost_amount is null
  or m.mq_rate is null
  or m.mq_rate < 0
  or m.mq_rate > 1.2;
