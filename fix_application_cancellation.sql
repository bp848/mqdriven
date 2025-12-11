-- Fix for application cancellation errors
-- This script adds the missing updated_at column to the applications table
-- and creates triggers for automatic timestamp management

-- Add the missing updated_at column to the applications table
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create a universal function to update updated_at columns
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for tables that have updated_at columns
-- Applications table trigger
DROP TRIGGER IF EXISTS set_applications_updated_at ON public.applications;
CREATE TRIGGER set_applications_updated_at
    BEFORE UPDATE ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Bulletin threads trigger (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bulletin_threads' AND table_schema = 'public') THEN
        DROP TRIGGER IF EXISTS set_bulletin_threads_updated_at ON public.bulletin_threads;
        CREATE TRIGGER set_bulletin_threads_updated_at
            BEFORE UPDATE ON public.bulletin_threads
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- Fax intakes trigger (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fax_intakes' AND table_schema = 'public') THEN
        DROP TRIGGER IF EXISTS set_fax_intakes_updated_at ON public.fax_intakes;
        CREATE TRIGGER set_fax_intakes_updated_at
            BEFORE UPDATE ON public.fax_intakes
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- Customers info trigger (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers_info' AND table_schema = 'public') THEN
        DROP TRIGGER IF EXISTS set_customers_info_updated_at ON public.customers_info;
        CREATE TRIGGER set_customers_info_updated_at
            BEFORE UPDATE ON public.customers_info
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- Verify the applications table column was added successfully
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'applications' 
  AND table_schema = 'public' 
  AND column_name = 'updated_at';

-- Show all triggers we created
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgfoid::regproc as function_name
FROM pg_trigger 
WHERE tgname LIKE 'set_%_updated_at'
  AND tgrelid::regclass::text IN ('public.applications', 'public.bulletin_threads', 'public.fax_intakes', 'public.customers_info')
ORDER BY table_name, trigger_name;
