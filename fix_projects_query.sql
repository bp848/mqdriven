-- Fix the projects table relationship issue
-- The problem is that the old 'projects' table doesn't have proper foreign key relationships
-- We need to either:
-- 1. Add the foreign key relationship to the existing projects table, or
-- 2. Update the application to use projects_v2 instead

-- Option 1: Add foreign key relationship to existing projects table
-- This assumes the customers table exists and has an id column

-- First, check if customers.id exists and projects.customer_id references it
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'projects'
    AND kcu.column_name = 'customer_id';

-- If no relationship exists, we can add it (only if customer_id values are valid UUIDs)
-- ALTER TABLE public.projects 
-- ADD CONSTRAINT projects_customer_id_fkey 
-- FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- Option 2: Create a view that maps projects_v2 to the old projects structure
-- This would be the safer approach if the application expects the old schema

CREATE OR REPLACE VIEW public.projects_view AS
SELECT 
    p.id,
    p.project_code,
    c.customer_code,
    p.customer_id,
    p.created_by::text as sales_user_id,  -- Map created_by to sales_user_id for compatibility
    NULL::text as sales_user_code,
    NULL::uuid as estimate_id,
    p.project_code as estimate_code,  -- Use project_code as estimate_code for compatibility
    NULL::uuid as order_id,
    NULL::text as order_code,
    p.project_name,
    p.status as project_status,
    NULL::uuid as classification_id,
    NULL::uuid as section_code_id,
    NULL::uuid as product_class_id,
    p.created_at::date as create_date,
    p.created_by as create_user_id,
    NULL::text as create_user_code,
    p.updated_at::date as update_date,
    p.created_by as update_user_id,
    NULL::text as update_user_code,
    NULL::uuid as project_id,
    p.updated_at,
    p.budget_sales as amount,
    p.budget_cost as total_cost,
    NULL::numeric as subamount,
    p.due_date as delivery_date,
    NULL::numeric as quantity,
    CASE WHEN p.status != 'canceled' THEN true ELSE false END as is_active
FROM public.projects_v2 p
LEFT JOIN public.customers c ON p.customer_id = c.id;

-- Check the data in both tables to understand the migration status
SELECT 'projects' as table_name, COUNT(*) as record_count FROM public.projects
UNION ALL
SELECT 'projects_v2' as table_name, COUNT(*) as record_count FROM public.projects_v2
UNION ALL  
SELECT 'customers' as table_name, COUNT(*) as record_count FROM public.customers;
