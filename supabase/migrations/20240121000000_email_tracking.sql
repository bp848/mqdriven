-- Email tracking tables
CREATE TABLE IF NOT EXISTS email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT NOT NULL,
  lead_id UUID REFERENCES leads(id),
  opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 1,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_email_tracking_email_id ON email_tracking(email_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_opened_at ON email_tracking(opened_at DESC);

-- Function to track email opens
CREATE OR REPLACE FUNCTION track_email_open(
  email_id_param TEXT,
  user_agent_param TEXT DEFAULT 'Unknown',
  ip_address_param TEXT DEFAULT 'Unknown'
)
RETURNS VOID AS $$
BEGIN
  -- Check if this email_id has been opened before
  IF EXISTS (SELECT 1 FROM email_tracking WHERE email_id = email_id_param) THEN
    -- Update existing record
    UPDATE email_tracking 
    SET 
      opened_at = NOW(),
      open_count = email_tracking.open_count + 1,
      user_agent = user_agent_param,
      ip_address = ip_address_param
    WHERE email_id = email_id_param;
  ELSE
    -- Insert new record
    INSERT INTO email_tracking (email_id, opened_at, user_agent, ip_address)
    VALUES (email_id_param, NOW(), user_agent_param, ip_address_param);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add last_email_id column to leads table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'leads' AND column_name = 'last_email_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN last_email_id TEXT;
  END IF;
END
$$;
