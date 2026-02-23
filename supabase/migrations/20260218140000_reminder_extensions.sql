-- Add last_reminded_at column to projects if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'last_reminded_at') THEN
        ALTER TABLE projects ADD COLUMN last_reminded_at TIMESTAMPTZ;
    END IF;
END $$;

-- Drop function if exists to update signature
DROP FUNCTION IF EXISTS get_project_reminders();

-- Create function to identify projects needing reminders
CREATE OR REPLACE FUNCTION get_project_reminders()
RETURNS TABLE (
  id UUID,
  project_name TEXT,
  reminder_type TEXT,
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  days_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH overdue AS (
    SELECT
      p.id,
      p.project_name,
      'overdue'::TEXT as reminder_type,
      p.sales_user_id as user_id,
      u.email as user_email,
      u.name as user_name,
      EXTRACT(DAY FROM (NOW() - p.delivery_date))::INTEGER as days_overdue
    FROM projects p
    LEFT JOIN users u ON p.sales_user_id = u.id
    WHERE p.project_status != '完了' AND p.project_status != 'Completed'
      AND p.delivery_date < NOW()
      -- Remind if never reminded or reminded more than 3 days ago (to avoid daily spam)
      AND (p.last_reminded_at IS NULL OR p.last_reminded_at < NOW() - INTERVAL '3 days')
      -- Check notification setting
      AND (u.notification_enabled IS NOT FALSE)
  ),
  uninvoiced AS (
    SELECT
      p.id,
      p.project_name,
      'uninvoiced'::TEXT as reminder_type,
      p.sales_user_id as user_id,
      u.email as user_email,
      u.name as user_name,
      EXTRACT(DAY FROM (NOW() - p.updated_at))::INTEGER as days_overdue
    FROM projects p
    LEFT JOIN users u ON p.sales_user_id = u.id
    WHERE (p.project_status = '完了' OR p.project_status = 'Completed')
      AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.project_id = p.id)
      -- Remind if un-invoiced for more than 3 days
      AND p.updated_at < NOW() - INTERVAL '3 days'
      AND (p.last_reminded_at IS NULL OR p.last_reminded_at < NOW() - INTERVAL '7 days')
      -- Check notification setting
      AND (u.notification_enabled IS NOT FALSE)
  )
  SELECT * FROM overdue
  UNION ALL
  SELECT * FROM uninvoiced;
END;
$$ LANGUAGE plpgsql;
