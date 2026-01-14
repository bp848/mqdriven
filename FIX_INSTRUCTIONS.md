# Fix Projects Relationship Error

## Problem
The frontend is getting this error:
```
[PGRST200] Could not find a relationship between 'projects' and 'customer_id' in the schema cache
```

## Root Cause
The `projects` table has `customer_id` values but no foreign key constraint to the `customers` table, so PostgREST can't establish the relationship.

## Solution

### Step 1: Add Foreign Key Constraint
Run this SQL in your Supabase SQL Editor:

```sql
ALTER TABLE public.projects 
ADD CONSTRAINT projects_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
```

### Step 2: Verify the Fix
After running the SQL, test it with this query:

```sql
SELECT 
    p.id,
    p.project_code,
    p.customer_id,
    c.customer_name
FROM projects p
LEFT JOIN customers c ON p.customer_id = c.id
LIMIT 5;
```

### Step 3: Test Frontend
Reload your application - the error should be resolved.

## Data Quality Verification ✅
- 1000 projects have customer_id values
- All 219 unique customer_id values are valid UUIDs
- All customer_id values exist in the customers table
- No orphaned data found

## Why This Works
PostgREST automatically detects foreign key relationships and exposes them as API endpoints. When you query `projects?select=customers(*)`, PostgREST looks for a foreign key relationship between `projects.customer_id` and `customers.id`. Without the constraint, PostgREST can't establish this relationship and throws the PGRST200 error.

## Alternative Solutions (if needed)
If you can't add the foreign key constraint, you could:

1. **Use a manual join**: Query projects and customers separately and join in the frontend
2. **Create a view**: Create a database view that includes the customer data
3. **Use projects_v2**: Migrate to the newer schema (but this requires data migration)

The foreign key constraint is the best solution as it maintains data integrity and enables PostgREST relationships.
