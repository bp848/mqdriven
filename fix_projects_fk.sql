-- Add foreign key relationship to projects table
-- This will fix the PostgREST relationship error

-- First, let's check if there are any invalid customer_id values in projects
SELECT 
    'invalid_customer_ids' as check_type,
    COUNT(*) as total_projects,
    COUNT(customer_id) as has_customer_id,
    COUNT(CASE WHEN customer_id IS NOT NULL AND customer_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 1 END) as valid_uuid_count,
    COUNT(CASE WHEN customer_id IS NOT NULL AND NOT (customer_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN 1 END) as invalid_uuid_count
FROM projects;

-- Check if any customer_id values actually exist in customers table
SELECT 
    'orphaned_projects' as check_type,
    COUNT(*) as total_with_customer_id,
    COUNT(c.id) as matching_customers,
    COUNT(*) - COUNT(c.id) as orphaned_projects
FROM projects p
LEFT JOIN customers c ON p.customer_id = c.id
WHERE p.customer_id IS NOT NULL;

-- If the counts look good, we can add the foreign key constraint
-- Uncomment the following lines if the data is valid:

-- ALTER TABLE public.projects 
-- ADD CONSTRAINT projects_customer_id_fkey 
-- FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

-- After adding the constraint, test the relationship
-- SELECT p.id, p.project_code, p.customer_id, c.customer_name 
-- FROM projects p 
-- LEFT JOIN customers c ON p.customer_id = c.id 
-- LIMIT 5;
