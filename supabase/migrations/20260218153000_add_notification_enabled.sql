-- Add notification_enabled column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT TRUE;

-- Update existing users to have notification_enabled = true
UPDATE users SET notification_enabled = TRUE WHERE notification_enabled IS NULL;
