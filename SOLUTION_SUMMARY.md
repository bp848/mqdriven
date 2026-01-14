# Fix for PostgREST Relationship Error

## Error Message
```
[PGRST200] Could not find a relationship between 'projects' and 'customer_id' in the schema cache
```

## Two Solutions Available

### Solution 1: Add Foreign Key Constraint (Recommended)

**Steps:**
1. Open your Supabase SQL Editor
2. Run the SQL in `ADD_FOREIGN_KEY.sql`:
   ```sql
   ALTER TABLE public.projects 
   ADD CONSTRAINT projects_customer_id_fkey 
   FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
   ```

**Benefits:**
- ✅ Permanent fix
- ✅ Maintains data integrity
- ✅ Enables PostgREST relationships automatically
- ✅ No code changes needed

### Solution 2: Code Fix (Immediate Workaround)

**What I changed:**
- Modified `getProjects()` in `services/dataService.ts`
- Added try/catch to attempt relationship query first
- Falls back to manual join if relationship fails
- Handles both scenarios seamlessly

**Benefits:**
- ✅ Works immediately without database changes
- ✅ Graceful degradation
- ✅ Will automatically use relationships when FK is added

## Current Status

- ✅ Data quality verified: 1000 projects with valid customer_id values
- ✅ All customer_id values exist in customers table
- ✅ Code fix implemented and ready
- ⏳ Database fix pending (run the SQL)

## Testing

After applying either fix:
1. Reload your application
2. The error should disappear
3. Projects should load with customer information

## Recommendation

Use **Solution 1** (add foreign key) for the permanent fix, but the code fix (Solution 2) provides immediate relief and future-proofs the application.
