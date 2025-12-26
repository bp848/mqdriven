-- Normalized, display-safe view for estimates.
-- Cleans numeric/text fields, recalculates status, and parses delivery dates for UI/KPI use.
create or replace view public.estimates_list_view as
with cleaned as (
    select
        e.*,
        case when trim(e.copies::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.copies::numeric end as copies_num,
        case when trim(e.unit_price::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.unit_price::numeric end as unit_price_num,
        case when trim(e.subtotal::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.subtotal::numeric end as subtotal_num,
        case when trim(e.total::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.total::numeric end as total_num,
        case when trim(e.tax_rate::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.tax_rate::numeric end as tax_rate_num,
        case when trim(e.consumption::text) ~ '^[0-9]+(\\.[0-9]+)?$' then e.consumption::numeric end as consumption_num,
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
        end as status_clean
    from public.estimates e
),
calc as (
    select
        c.*,
        coalesce(
            c.subtotal_num,
            case when c.copies_num is not null and c.unit_price_num is not null then c.copies_num * c.unit_price_num end
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
                case when c.copies_num is not null and c.unit_price_num is not null then c.copies_num * c.unit_price_num end
            ) + coalesce(
                c.consumption_num,
                case
                    when c.subtotal_num is not null and c.tax_rate_num is not null then floor(c.subtotal_num * (c.tax_rate_num / 100))
                end,
                0
            )
        ) as total_calc
    from cleaned c
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
    note,
    order_id_clean as order_id,
    create_id,
    create_date,
    update_id,
    update_date,
    order_flg
from calc;
