-- Fix orders and invoices views to use actual column names
-- Drop dependent views first
drop view if exists public.mq_anomalies_view;
drop view if exists public.mq_customer_ltv_view;
drop view if exists public.mq_customer_monthly_view;
drop view if exists public.mq_project_monthly_view;
drop view if exists public.invoices_list_view;
drop view if exists public.orders_list_view;

-- orders: 金額は subamount→amount の順で採用、原価は現状不明なので null
create or replace view public.orders_list_view as
with cleaned as (
  select
    o.*,
    case
      when regexp_replace(coalesce(o.subamount, o.amount), '[^0-9\\.-]', '', 'g') ~ '^[+-]?[0-9]+(\\.[0-9]+)?$'
        then regexp_replace(coalesce(o.subamount, o.amount), '[^0-9\\.-]', '', 'g')::numeric
    end as sales_amount_num,
    null::numeric as variable_cost_num,
    case when coalesce(nullif(trim(o.order_date), ''), '') ~ '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}$'
      then to_date(replace(o.order_date, '/', '-'), 'YYYY-MM-DD') end as order_date_clean,
    case when coalesce(nullif(trim(o.delivery_date), ''), '') ~ '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}$'
      then to_date(replace(o.delivery_date, '/', '-'), 'YYYY-MM-DD') end as delivery_date_clean,
    coalesce(nullif(trim(o.approval_status1), ''), '') as status_raw
  from public.orders o
),
calc as (
  select
    c.*,
    sales_amount_num as sales_amount,
    variable_cost_num as variable_cost_amount,
    case when sales_amount_num is not null and variable_cost_num is not null then sales_amount_num - variable_cost_num end as mq_amount,
    case when sales_amount_num > 0 and variable_cost_num is not null then (sales_amount_num - variable_cost_num) / sales_amount_num end as mq_rate,
    case
      when coalesce(trim(status_raw), '') in ('受注確定', 'ordered', 'confirmed') then 'confirmed'
      when coalesce(trim(status_raw), '') in ('進行中', 'in_progress') then 'in_progress'
      when coalesce(trim(status_raw), '') in ('納品済', 'delivered', 'completed', 'done') then 'delivered'
      when coalesce(trim(status_raw), '') in ('キャンセル', 'cancel', 'cancelled') then 'cancelled'
      when coalesce(trim(status_raw), '') = '' then 'draft'
      else 'unknown_' || coalesce(status_raw, 'null')
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

-- invoices: 最小限の情報のみ
create or replace view public.invoices_list_view as
with cleaned as (
  select
    i.*,
    i.status::text as status_raw
  from public.invoices i
),
calc as (
  select
    c.*,
    null::numeric as sales_amount,
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
  null::text as invoice_id,
  null::text as project_id,
  null::text as order_id,
  null::date as invoice_date,
  null::date as due_date,
  sales_amount,
  variable_cost_amount,
  mq_amount,
  mq_rate,
  status_raw as status,
  status_label,
  null::numeric as subtotal_num,
  null::numeric as total_num
from calc;

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
join public.projects p on p.project_id::text = m.project_id
group by p.customer_id, m.month;

-- MQ customer LTV
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
join public.projects p on p.project_id::text = r.project_id
where r.source_rank = 1
group by p.customer_id;

-- Anomalies
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
  or m.mq_rate > 1.2
  or (m.sales_amount = 0 and m.variable_cost_amount > 0);