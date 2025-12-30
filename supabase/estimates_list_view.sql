create or replace view public.estimates_list_view as
with detail_costs as (
    select
        nullif(trim(ed.estimate_id::text), '') as estimate_business_id,
        count(*) as detail_count,
        sum(case when trim(ed.valiable_cost::text) ~ '^[0-9]+(\\.[0-9]+)?$' then ed.valiable_cost::numeric end) as detail_variable_cost_num,
        sum(
            case
                when trim(ed.quantity::text) ~ '^[0-9]+(\\.[0-9]+)?$'
                 and trim(ed.unit_price::text) ~ '^[0-9]+(\\.[0-9]+)?$'
                then ed.quantity::numeric * ed.unit_price::numeric
            end
        ) as detail_sales_amount_num
    from public.estimate_details ed
    group by nullif(trim(ed.estimate_id::text), '')
),
cleaned as (
    select
        e.*,
        dc.detail_variable_cost_num,
        dc.detail_sales_amount_num,
        dc.detail_count,
        p.project_name as project_name_joined,
        p.customer_id as project_customer_id,
        cust.customer_name as customer_name_joined,
        case when trim(e.copies::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.copies::numeric end as copies_num,
        case when trim(e.unit_price::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.unit_price::numeric end as unit_price_num,
        case when trim(e.subtotal::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.subtotal::numeric end as subtotal_num,
        case when trim(e.total::text)    ~ '^[0-9]+(\\.[0-9]+)?$' then e.total::numeric end as total_num,
        case when trim(e.tax_rate::text) ~ '^[0-9]+(\\.[0-9]+)?$' then replace(e.tax_rate::text, '%', '')::numeric end as tax_rate_num,
        case when trim(e.consumption::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.consumption::numeric end as consumption_num,
        case when trim(e.valiable_cost::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.valiable_cost::numeric end as variable_cost_num,
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
    left join public.projects p on nullif(trim(e.project_id::text), '') = nullif(trim(p.project_id::text), '')
    left join public.customers cust on nullif(trim(p.customer_id::text), '') = cust.id::text
),
calc as (
    select
        c.*,
        coalesce(
            c.subtotal_num,
            case when c.copies_num is not null and c.unit_price_num is not null then c.copies_num * c.unit_price_num end,
            c.detail_sales_amount_num
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
                c.detail_sales_amount_num
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
        ) as variable_cost_calc,
        coalesce(c.detail_count, 0) as detail_count_calc
    from cleaned c
),
mq as (
    select
        calc.*,
        coalesce(nullif(calc.project_name::text, ''), nullif(calc.project_name_joined::text, '')) as project_name_resolved,
        coalesce(nullif(calc.customer_name::text, ''), nullif(calc.customer_name_joined::text, '')) as customer_name_resolved,
        coalesce(
            coalesce(nullif(calc.project_name::text, ''), nullif(calc.project_name_joined::text, '')),
            nullif(calc.pattern_name::text, ''),
            nullif(calc.specification::text, ''),
            '見積#' || coalesce(nullif(trim(calc.estimates_id::text), ''), calc.id::text)
        ) as display_name,
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
        end as mq_rate,
        case
            when calc.subtotal_calc is not null and calc.variable_cost_calc is not null then 'OK'
            when calc.detail_count_calc = 0 then 'A' -- 明細なし
            when calc.detail_count_calc > 0 and (calc.variable_cost_calc is null or calc.variable_cost_calc = 0) then 'B' -- 原価未入力
            else 'B'
        end as mq_missing_reason
    from calc
)
select
    display_name,
    estimates_id,
    id,
    pattern_no,
    pattern_name,
    project_id,
    project_name_resolved as project_name,
    customer_name_resolved as customer_name,
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
    detail_sales_amount_num,
    detail_count_calc as detail_count,
    variable_cost_calc as variable_cost_amount,
    subtotal_calc as sales_amount,
    mq_amount,
    mq_rate,
    mq_missing_reason
from mq;

-- Display-safe: estimate_details
create or replace view public.estimate_details_list_view as
with cleaned as (
    select
        ed.*,
        case when trim(ed.quantity::text) ~ '^[0-9]+(\\.[0-9]+)?$' then ed.quantity::numeric end as quantity_num,
        case when trim(ed.unit_price::text) ~ '^[0-9]+(\\.[0-9]+)?$' then ed.unit_price::numeric end as unit_price_num,
        case when trim(ed.valiable_cost::text) ~ '^[0-9]+(\\.[0-9]+)?$' then ed.valiable_cost::numeric end as variable_cost_num
    from public.estimate_details ed
),
calc as (
    select
        c.*,
        case when c.quantity_num is not null and c.unit_price_num is not null then c.quantity_num * c.unit_price_num end as sales_amount,
        c.variable_cost_num as variable_cost_amount
    from cleaned c
)
select
    estimate_id,
    detail_id,
    item_name,
    quantity_num as quantity,
    unit_price_num as unit_price,
    sales_amount as amount,
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
    select project_id, 'estimate' as source, delivery_date as dt, sales_amount, variable_cost_amount, 0::integer as order_count from public.estimates_list_view
    union all
    select project_id, 'order' as source, order_date, sales_amount, variable_cost_amount, 1::integer as order_count from public.orders_list_view
    union all
    select project_id, 'invoice' as source, invoice_date, sales_amount, variable_cost_amount, 0::integer as order_count from public.invoices_list_view
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
join public.projects p on p.project_id = m.project_id
group by p.customer_id, m.month;

-- Lifetime KPI per customer (LTV / MQ)
create or replace view public.mq_customer_ltv_view as
with base as (
    select project_id, 'estimate' as source, delivery_date as dt, sales_amount, variable_cost_amount, 0::integer as order_count from public.estimates_list_view
    union all
    select project_id, 'order' as source, order_date, sales_amount, variable_cost_amount, 1::integer as order_count from public.orders_list_view
    union all
    select project_id, 'invoice' as source, invoice_date, sales_amount, variable_cost_amount, 0::integer as order_count from public.invoices_list_view
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
join public.projects p on p.project_id = r.project_id
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
  or m.mq_rate > 1.2
  or (m.sales_amount = 0 and m.variable_cost_amount > 0);
