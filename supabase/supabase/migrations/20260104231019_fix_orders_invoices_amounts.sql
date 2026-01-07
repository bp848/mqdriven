-- Fix orders and invoices views to properly extract amounts from actual data
-- Drop dependent views first
drop view if exists public.mq_anomalies_view;
drop view if exists public.mq_customer_ltv_view;
drop view if exists public.mq_customer_monthly_view;
drop view if exists public.mq_project_monthly_view;
drop view if exists public.invoices_list_view;
drop view if exists public.orders_list_view;

-- Display-safe: orders
create or replace view public.orders_list_view as
with cleaned as (
    select
        o.*,
        case
            when regexp_replace(coalesce(to_jsonb(o)->>'order_amount', to_jsonb(o)->>'amount', to_jsonb(o)->>'subamount', to_jsonb(o)->>'total_amount'), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                then regexp_replace(coalesce(to_jsonb(o)->>'order_amount', to_jsonb(o)->>'amount', to_jsonb(o)->>'subamount', to_jsonb(o)->>'total_amount'), '[^0-9\\.-]', '', 'g')::numeric
        end as sales_amount_num,
        case
            when regexp_replace(coalesce(to_jsonb(o)->>'variable_cost', to_jsonb(o)->>'total_cost', to_jsonb(o)->>'cost', to_jsonb(o)->>'subamount'), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                then regexp_replace(coalesce(to_jsonb(o)->>'variable_cost', to_jsonb(o)->>'total_cost', to_jsonb(o)->>'cost', to_jsonb(o)->>'subamount'), '[^0-9\\.-]', '', 'g')::numeric
        end as variable_cost_num,
        case when coalesce(nullif(trim(o.order_date::text), ''), '') ~ '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}$'
            then to_date(replace(o.order_date::text, '/', '-'), 'YYYY-MM-DD') end as order_date_clean,
        case when coalesce(nullif(trim(o.delivery_date::text), ''), '') ~ '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}$'
            then to_date(replace(o.delivery_date::text, '/', '-'), 'YYYY-MM-DD') end as delivery_date_clean,
        coalesce(
            nullif(trim(to_jsonb(o)->>'status'), ''),
            nullif(trim(to_jsonb(o)->>'approval_status1'), ''),
            nullif(trim(to_jsonb(o)->>'order_status'), '')
        ) as status_raw
    from public.orders o
),
calc as (
    select
        c.*,
        c.sales_amount_num as sales_amount,
        c.variable_cost_num as variable_cost_amount,
        case
            when c.sales_amount_num is not null and c.variable_cost_num is not null then c.sales_amount_num - c.variable_cost_num
        end as mq_amount,
        case
            when c.sales_amount_num > 0 and c.variable_cost_num is not null then (c.sales_amount_num - c.variable_cost_num) / c.sales_amount_num
        end as mq_rate,
        case
            when coalesce(trim(c.status_raw), '') in ('受注確定', 'ordered', 'confirmed') then 'confirmed'
            when coalesce(trim(c.status_raw), '') in ('進行中', 'in_progress') then 'in_progress'
            when coalesce(trim(c.status_raw), '') in ('納品済', 'delivered', 'completed', 'done') then 'delivered'
            when coalesce(trim(c.status_raw), '') in ('キャンセル', 'cancel', 'cancelled') then 'cancelled'
            when coalesce(trim(c.status_raw), '') = '' then 'draft'
            else 'unknown_' || coalesce(c.status_raw, 'null')
        end as status_label
    from cleaned c
)
select
    order_id,
    project_id,
    order_date_clean as order_date,
    delivery_date_clean as delivery_date,
    sales_amount,
    variable_cost_amount,
    mq_amount,
    mq_rate,
    status_raw as status,
    status_label,
    sales_amount_num as order_amount_num,
    variable_cost_num
from calc;

-- Display-safe: invoices
create or replace view public.invoices_list_view as
with cleaned as (
    select
        i.*,
        coalesce(
            nullif(trim(to_jsonb(i)->>'invoice_id'), ''),
            nullif(trim(to_jsonb(i)->>'id'), '')
        ) as invoice_id_resolved,
        coalesce(
            nullif(trim(to_jsonb(i)->>'project_id'), ''),
            nullif(trim(to_jsonb(i)->>'projectid'), ''),
            nullif(trim(to_jsonb(i)->>'project_code'), '')
        ) as project_id_resolved,
        coalesce(
            nullif(trim(to_jsonb(i)->>'order_id'), ''),
            nullif(trim(to_jsonb(i)->>'orderid'), ''),
            nullif(trim(to_jsonb(i)->>'order_code'), '')
        ) as order_id_resolved,
        case
            when regexp_replace(coalesce(to_jsonb(i)->>'total', to_jsonb(i)->>'total_amount', to_jsonb(i)->>'amount', to_jsonb(i)->>'grand_total', to_jsonb(i)->>'subamount'), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                then regexp_replace(coalesce(to_jsonb(i)->>'total', to_jsonb(i)->>'total_amount', to_jsonb(i)->>'amount', to_jsonb(i)->>'grand_total', to_jsonb(i)->>'subamount'), '[^0-9\\.-]', '', 'g')::numeric
        end as total_num,
        case
            when regexp_replace(coalesce(to_jsonb(i)->>'subtotal', to_jsonb(i)->>'subtotal_amount', to_jsonb(i)->>'subamount'), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
                then regexp_replace(coalesce(to_jsonb(i)->>'subtotal', to_jsonb(i)->>'subtotal_amount', to_jsonb(i)->>'subamount'), '[^0-9\\.-]', '', 'g')::numeric
        end as subtotal_num,
        case when coalesce(nullif(trim(i.invoice_date::text), ''), '') ~ '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}$'
            then to_date(replace(i.invoice_date::text, '/', '-'), 'YYYY-MM-DD') end as invoice_date_clean,
        case when coalesce(nullif(trim(i.due_date::text), ''), '') ~ '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}$'
            then to_date(replace(i.due_date::text, '/', '-'), 'YYYY-MM-DD') end as due_date_clean,
        nullif(trim(i.status::text), '') as status_raw
    from public.invoices i
),
calc as (
    select
        c.*,
        coalesce(c.total_num, c.subtotal_num) as sales_amount,
        null::numeric as variable_cost_amount,
        null::numeric as mq_amount,
        null::numeric as mq_rate,
        case
            when coalesce(trim(c.status_raw), '') in ('draft', '下書き') then 'draft'
            when coalesce(trim(c.status_raw), '') in ('発行', '発行済', 'issued') then 'issued'
            when coalesce(trim(c.status_raw), '') in ('入金済', 'paid') then 'paid'
            when coalesce(trim(c.status_raw), '') in ('遅延', 'late', 'overdue') then 'overdue'
            when coalesce(trim(c.status_raw), '') = '' then 'draft'
            else 'unknown_' || coalesce(c.status_raw, 'null')
        end as status_label
    from cleaned c
)
select
    invoice_id_resolved as invoice_id,
    project_id_resolved as project_id,
    order_id_resolved as order_id,
    invoice_date_clean as invoice_date,
    due_date_clean as due_date,
    sales_amount,
    variable_cost_amount,
    mq_amount,
    mq_rate,
    status_raw as status,
    status_label,
    subtotal_num,
    total_num
from calc;

-- Recreate dependent views with proper project_id casting
-- MQ monthly per project
create or replace view public.mq_project_monthly_view as
with base as (
    select project_id::text, 'estimate' as source, delivery_date as dt, sales_amount, variable_cost_amount, 0::integer as order_count from public.estimates_list_view
    union all
    select project_id::text, 'order' as source, order_date, sales_amount, variable_cost_amount, 1::integer as order_count from public.orders_list_view
    union all
    select project_id::text, 'invoice' as source, invoice_date, sales_amount, variable_cost_amount, 0::integer as order_count from public.invoices_list_view
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
            order by case pms.source when 'order' then 1 when 'invoice' then 2 else 3 end
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

-- MQ monthly per customer (joins project -> customer)
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
join public.projects p on p.project_id::text = m.project_id::text
group by p.customer_id, m.month;

-- Lifetime KPI per customer (LTV / MQ)
create or replace view public.mq_customer_ltv_view as
with base as (
    select project_id::text, 'estimate' as source, delivery_date as dt, sales_amount, variable_cost_amount, 0::integer as order_count from public.estimates_list_view
    union all
    select project_id::text, 'order' as source, order_date, sales_amount, variable_cost_amount, 1::integer as order_count from public.orders_list_view
    union all
    select project_id::text, 'invoice' as source, invoice_date, sales_amount, variable_cost_amount, 0::integer as order_count from public.invoices_list_view
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
            order by case pst.source when 'order' then 1 when 'invoice' then 2 else 3 end
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
join public.projects p on p.project_id::text = r.project_id::text
where r.source_rank = 1
group by p.customer_id;

-- Anomaly detection view
create or replace view public.mq_anomalies_view as
select
  'estimate' as level,
  e.project_id,
  e.estimates_id as record_id,
  e.delivery_date as dt,
  e.sales_amount,
  e.variable_cost_amount,
  e.mq_amount,
  e.mq_rate,
  e.mq_missing_reason,
  case
    when e.mq_missing_reason = 'A' then '明細なし'
    when e.mq_missing_reason = 'B' then '原価未入力'
    when e.mq_rate < 0 then 'MQ率<0'
    when e.mq_rate > 1.2 then 'MQ率>1.2'
    when e.sales_amount = 0 and e.variable_cost_amount > 0 then '売上0で変動費あり'
  end as anomaly_reason
from public.estimates_list_view e
where
  e.mq_missing_reason in ('A', 'B')
  or e.mq_rate < 0
  or e.mq_rate > 1.2
  or (e.sales_amount = 0 and e.variable_cost_amount > 0)
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
  null::text as mq_missing_reason,
  case
    when m.sales_amount is null then '売上null'
    when m.variable_cost_amount is null then '変動費null'
    when m.mq_rate is null then 'MQ率null'
    when m.mq_rate < 0 then 'MQ率<0'
    when m.mq_rate > 1.2 then 'MQ率>1.2'
    when m.sales_amount = 0 and m.variable_cost_amount > 0 then '売上0で変動費あり'
  end as anomaly_reason
from public.mq_project_monthly_view m
where
  m.sales_amount is null
  or m.variable_cost_amount is null
  or m.mq_rate is null
  or m.mq_rate < 0
  or m.mq_rate > 1.2;