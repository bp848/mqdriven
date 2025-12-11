-- Test script to verify application cancellation functionality
-- This script creates a test application and verifies that cancellation works

-- First, let's verify our table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'applications' 
  AND table_schema = 'public' 
  AND column_name IN ('id', 'applicant_id', 'status', 'updated_at', 'cancelled', 'rejected_at', 'approved_at')
ORDER BY column_name;

-- Check if the cancelled status exists in the enum
SELECT 
    unnest(enumlabel) as status_value
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'application_status'
)
ORDER BY status_value;

-- Show existing applications to understand current data
SELECT 
    id,
    applicant_id,
    status,
    created_at,
    updated_at,
    approved_at,
    rejected_at
FROM public.applications 
LIMIT 5;

-- If you want to test the cancellation functionality, you can run this update statement:
-- UPDATE public.applications 
-- SET status = 'cancelled',
--     approver_id = NULL,
--     rejection_reason = '申請者による取り消し',
--     rejected_at = NOW(),
--     approved_at = NULL
-- WHERE id = 'your-test-application-id'
-- AND applicant_id = 'your-user-id';

-- Verify the trigger is working by checking if updated_at changes
-- SELECT updated_at FROM public.applications WHERE id = 'your-test-application-id';
