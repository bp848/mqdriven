create or replace view public.estimates_list_view as
with detail_costs as (
    select
        nullif(trim(ed.estimate_id::text), '') as estimate_business_id,
        sum(case when trim(ed.variable_cost::text) ~ '^[0-9]+(\\.[0-9]+)?$' then ed.variable_cost::numeric end) as detail_variable_cost_num,
        sum(case when trim(ed.amount::text) ~ '^[0-9]+(\\.[0-9]+)?$' then ed.amount::numeric end) as detail_amount_num
    from public.estimate_details ed
    group by nullif(trim(ed.estimate_id::text), '')
),
cleaned as (
    select
        e.*,
        dc.detail_variable_cost_num,
        dc.detail_amount_num,
        case when trim(e.copies::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.copies::numeric end as copies_num,
        case when trim(e.unit_price::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.unit_price::numeric end as unit_price_num,
        case when trim(e.subtotal::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.subtotal::numeric end as subtotal_num,
        case when trim(e.total::text)    ~ '^[0-9]+(\\.[0-9]+)?$' then e.total::numeric end as total_num,
        case when trim(e.tax_rate::text) ~ '^[0-9]+(\\.[0-9]+)?$' then replace(e.tax_rate::text, '%', '')::numeric end as tax_rate_num,
        case when trim(e.consumption::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.consumption::numeric end as consumption_num,
        case when trim(e.variable_cost::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.variable_cost::numeric end as variable_cost_num,
        nullif(trim(e.order_id::text), '') as order_id_clean,
        case
            when coalesce(nullif(trim(e.delivery_date::text), ''), '') ~ '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}$'
                then to_date(replace(e.delivery_date::text, '/', '-'), 'YYYY-MM-DD')
            when e.delivery_date::date is not null
                then e.delivery_date::date
            else null
        end as delivery_date_clean,
        case
            when coalesce(nullif(trim(e.order_flg::text), ''), '') = '1' or nullif(trim(e.order_id::text), '') is not null then '2'  -- ordered
            when (e.status::text) ~ '^[0-9]+$' then e.status::text                    -- keep numeric code
            else '0'                                                                 -- draft/default
        end as status_clean,
        nullif(trim(e.status::text), '') as status_raw
    from public.estimates e
    left join detail_costs dc on dc.estimate_business_id = nullif(trim(e.estimates_id::text), '')
),
calc as (
    select
        c.*,
        coalesce(
            c.subtotal_num,
            case when c.copies_num is not null and c.unit_price_num is not null then c.copies_num * c.unit_price_num end,
            c.detail_amount_num
        ) as subtotal_calc,
        coalesce(
            c.consumption_num,
            case
                when c.subtotal_num is not null and c.tax_rate_num is not null then floor(c.subtotal_num * (c.tax_rate_num / 100))
            end
        ) as consumption_calc,
        coalesce(
            c.total_num,
            coalesce(
                c.subtotal_num,
                case when c.copies_num is not null and c.unit_price_num is not null then c.copies_num * c.unit_price_num end,
                c.detail_amount_num
            ) + coalesce(
                c.consumption_num,
                case
                    when c.subtotal_num is not null and c.tax_rate_num is not null then floor(c.subtotal_num * (c.tax_rate_num / 100))
                end,
                0
            )
        ) as total_calc,
        coalesce(
            c.variable_cost_num,
            c.detail_variable_cost_num
        ) as variable_cost_calc
    from cleaned c
),
mq as (
    select
        calc.*,
        case
            when coalesce(trim(calc.status_raw), '') in ('2', '受注', '受注済') then 'ordered'
            when coalesce(trim(calc.status_raw), '') in ('9', '失注', 'キャンセル') then 'lost'
            when coalesce(trim(calc.status_raw), '') in ('1', '提出', '提出済') then 'submitted'
            when coalesce(trim(calc.status_raw), '') in ('0', 'draft', '見積中', '') then 'draft'
            when coalesce(trim(calc.status_raw), '') = '' and (calc.order_flg::text) = '1' then 'ordered'
            when calc.order_id_clean is not null then 'ordered'
            else 'unknown_' || coalesce(calc.status_raw, 'null')
        end as status_label,
        calc.subtotal_calc as sales_amount,
        calc.variable_cost_calc as variable_cost_amount,
        case
            when calc.subtotal_calc is not null and calc.variable_cost_calc is not null then calc.subtotal_calc - calc.variable_cost_calc
        end as mq_amount,
        case
            when calc.subtotal_calc > 0 and calc.variable_cost_calc is not null then (calc.subtotal_calc - calc.variable_cost_calc) / calc.subtotal_calc
        end as mq_rate
    from calc
)
select
    estimates_id,
    id,
    pattern_no,
    pattern_name,
    project_id,
    specification,
    delivery_place,
    transaction_method,
    expiration_date,
    copies_num as copies,
    unit_price_num as unit_price,
    subtotal_calc as subtotal,
    tax_rate_num as tax_rate,
    consumption_calc as consumption,
    total_calc as total,
    delivery_date_clean as delivery_date,
    status_clean as status,
    status_label,
    note,
    order_id_clean as order_id,
    create_id,
    create_date,
    update_id,
    update_date,
    order_flg,
    -- numeric helper columns for downstream KPIs
    copies_num,
    unit_price_num,
    subtotal_num,
    total_num,
    tax_rate_num as tax_rate_num_raw,
    consumption_num,
    variable_cost_num,
    detail_variable_cost_num,
    detail_amount_num,
    variable_cost_calc as variable_cost_amount,
    subtotal_calc as sales_amount,
    mq_amount,
    mq_rate
from mq;

-- Display-safe: estimate_details
create or replace view public.estimate_details_list_view as
with cleaned as (
    select
        ed.*,
        case when trim(ed.quantity::text) ~ '^[0-9]+(\\.[0-9]+)?$' then ed.quantity::numeric end as quantity_num,
        case when trim(ed.unit_price::text) ~ '^[0-9]+(\\.[0-9]+)?$' then ed.unit_price::numeric end as unit_price_num,
        case when trim(ed.amount::text) ~ '^[0-9]+(\\.[0-9]+)?$' then ed.amount::numeric end as amount_num,
        case when trim(ed.variable_cost::text) ~ '^[0-9]+(\\.[0-9]+)?$' then ed.variable_cost::numeric end as variable_cost_num
    from public.estimate_details ed
),
calc as (
    select
        c.*,
        coalesce(
            c.amount_num,
            case when c.quantity_num is not null and c.unit_price_num is not null then c.quantity_num * c.unit_price_num end
        ) as sales_amount,
        c.variable_cost_num as variable_cost_amount
    from cleaned c
)
select
    estimate_id,
    detail_id,
    item_name,
    quantity_num as quantity,
    unit_price_num as unit_price,
    amount_num as amount,
    variable_cost_num as variable_cost,
    sales_amount,
    variable_cost_amount,
    case
        when sales_amount is not null and variable_cost_amount is not null then sales_amount - variable_cost_amount
    end as mq_amount,
    case
        when sales_amount > 0 and variable_cost_amount is not null then (sales_amount - variable_cost_amount) / sales_amount
    end as mq_rate,
    note
from calc;

-- Display-safe: orders
create or replace view public.orders_list_view as
with cleaned as (
    select
        o.*,
        case when trim(o.order_amount::text) ~ '^[0-9]+(\\.[0-9]+)?$' then o.order_amount::numeric end as order_amount_num,
        case when trim(o.variable_cost::text) ~ '^[0-9]+(\\.[0-9]+)?$' then o.variable_cost::numeric end as variable_cost_num,
        case when coalesce(nullif(trim(o.order_date::text), ''), '') ~ '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}$'
            then to_date(replace(o.order_date::text, '/', '-'), 'YYYY-MM-DD') end as order_date_clean,
        case when coalesce(nullif(trim(o.delivery_date::text), ''), '') ~ '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}$'
            then to_date(replace(o.delivery_date::text, '/', '-'), 'YYYY-MM-DD') end as delivery_date_clean,
        nullif(trim(o.status::text), '') as status_raw
    from public.orders o
),
calc as (
    select
        c.*,
        c.order_amount_num as sales_amount,
        c.variable_cost_num as variable_cost_amount,
        case
            when c.order_amount_num is not null and c.variable_cost_num is not null then c.order_amount_num - c.variable_cost_num
        end as mq_amount,
        case
            when c.order_amount_num > 0 and c.variable_cost_num is not null then (c.order_amount_num - c.variable_cost_num) / c.order_amount_num
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
    order_amount_num,
    variable_cost_num
from calc;

-- Display-safe: invoices
create or replace view public.invoices_list_view as
with cleaned as (
    select
        i.*,
        case when trim(i.total::text) ~ '^[0-9]+(\\.[0-9]+)?$' then i.total::numeric end as total_num,
        case when trim(i.subtotal::text) ~ '^[0-9]+(\\.[0-9]+)?$' then i.subtotal::numeric end as subtotal_num,
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
        coalesce(c.subtotal_num, c.total_num) as sales_amount,
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
    invoice_id,
    project_id,
    order_id,
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

-- MQ monthly per project
create or replace view public.mq_project_monthly_view as
with base as (
    select project_id, 'estimate' as source, delivery_date as dt, sales_amount, variable_cost_amount from public.estimates_list_view
    union all
    select project_id, 'order' as source, order_date, sales_amount, variable_cost_amount from public.orders_list_view
    union all
    select project_id, 'invoice' as source, invoice_date, sales_amount, variable_cost_amount from public.invoices_list_view
)
select
    b.project_id,
    date_trunc('month', b.dt)::date as month,
    sum(b.sales_amount) as sales_amount,
    sum(b.variable_cost_amount) as variable_cost_amount,
    sum(b.sales_amount) - sum(b.variable_cost_amount) as mq_amount,
    case when sum(b.sales_amount) > 0 then (sum(b.sales_amount) - sum(b.variable_cost_amount)) / sum(b.sales_amount) end as mq_rate
from base b
where b.dt is not null
group by b.project_id, date_trunc('month', b.dt)::date;

-- MQ monthly per customer (joins project -> customer)
create or replace view public.mq_customer_monthly_view as
select
    p.customer_id,
    m.month,
    sum(m.sales_amount) as sales_amount,
    sum(m.variable_cost_amount) as variable_cost_amount,
    sum(m.mq_amount) as mq_amount,
    case when sum(m.sales_amount) > 0 then sum(m.mq_amount) / sum(m.sales_amount) end as mq_rate
from public.mq_project_monthly_view m
join public.projects p on p.project_id = m.project_id
group by p.customer_id, m.month;

-- Anomaly detection view
create or replace view public.mq_anomalies_view as
select
  'project_month' as level,
  project_id,
  month,
  sales_amount,
  variable_cost_amount,
  mq_amount,
  mq_rate,
  case
    when sales_amount is null then '売上null'
    when variable_cost_amount is null then '変動費null'
    when mq_rate is null then 'MQ率null'
    when mq_rate < 0 or mq_rate > 1.2 then 'MQ率異常'
    when sales_amount = 0 and variable_cost_amount > 0 then '売上0で変動費あり'
  end as anomaly_reason
from public.mq_project_monthly_view
where
  sales_amount is null
  or variable_cost_amount is null
  or mq_rate is null
  or mq_rate < 0
  or mq_rate > 1.2
  or (sales_amount = 0 and variable_cost_amount > 0);
