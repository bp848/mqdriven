-- Sales Analysis View for ORDER_V2
-- Provides comprehensive sales data for dashboard analytics

CREATE OR REPLACE VIEW v_sales_analysis AS
SELECT 
    o.id,
    o.order_code,
    o.order_type,
    o.order_date,
    o.delivery_date,
    o.quantity,
    o.unit_price,
    o.amount,
    o.variable_cost,
    o.status,
    o.created_at,
    
    -- Project information
    p.id as project_id,
    p.project_code,
    p.project_name,
    p.customer_id,
    
    -- Customer information (handle missing customers table)
    COALESCE(c.customer_name, '未設定顧客') as customer_name,
    COALESCE(c.customer_code, p.customer_id::text) as customer_code,
    
    -- Estimate information
    e.id as estimate_id,
    e.estimate_code,
    e.estimate_name,
    
    -- Calculated fields for analysis
    CASE 
        WHEN o.order_type = 'sales' THEN o.amount 
        ELSE 0 
    END as sales_amount,
    
    CASE 
        WHEN o.order_type IN ('purchase', 'subcontract') THEN o.amount 
        ELSE 0 
    END as purchase_amount,
    
    CASE 
        WHEN o.order_type = 'sales' THEN o.variable_cost 
        ELSE 0 
    END as sales_variable_cost,
    
    -- Profit calculation for sales orders
    CASE 
        WHEN o.order_type = 'sales' THEN o.amount - o.variable_cost 
        ELSE 0 
    END as gross_profit,
    
    -- Profit margin
    CASE 
        WHEN o.order_type = 'sales' AND o.amount > 0 
        THEN (o.amount - o.variable_cost) * 100.0 / o.amount 
        ELSE 0 
    END as profit_margin,
    
    -- Time-based analysis
    DATE_TRUNC('month', o.order_date) as order_month,
    DATE_TRUNC('quarter', o.order_date) as order_quarter,
    DATE_TRUNC('year', o.order_date) as order_year,
    
    -- Status categorization
    CASE 
        WHEN o.status IN ('ordered', 'in_progress') THEN 'active'
        WHEN o.status IN ('delivered', 'invoiced', 'closed') THEN 'completed'
        WHEN o.status = 'cancelled' THEN 'cancelled'
        ELSE 'other'
    END as status_category,
    
    -- Delivery analysis
    CASE 
        WHEN o.delivery_date IS NOT NULL 
        THEN o.delivery_date - o.order_date 
        ELSE NULL 
    END as delivery_days,

    -- Overdue delivery flag
    CASE 
        WHEN o.delivery_date IS NOT NULL 
        AND CURRENT_DATE > o.delivery_date 
        AND o.status NOT IN ('delivered', 'invoiced', 'closed', 'cancelled')
        THEN true 
        ELSE false 
    END as is_overdue

FROM orders_v2 o
LEFT JOIN projects_v2 p ON o.project_id = p.id
LEFT JOIN LATERAL (
    SELECT id, customer_name, customer_code 
    FROM customers 
    WHERE id = p.customer_id
    LIMIT 1
) c ON true
LEFT JOIN estimates_v2 e ON o.estimate_id = e.id
WHERE o.order_date IS NOT NULL;

-- Grant access
GRANT SELECT ON v_sales_analysis TO authenticated;
GRANT SELECT ON v_sales_analysis TO anon;
