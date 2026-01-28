-- Create minutes table for meeting transcription service
CREATE TABLE IF NOT EXISTS minutes (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  file_name TEXT NOT NULL,
  author TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  department TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('解析済み', '共有済み', '下書き', '解析中')),
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'team', 'public')),
  transcript JSONB NOT NULL DEFAULT '[]',
  summary JSONB,
  word_count INTEGER NOT NULL DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_minutes_created_at ON minutes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_minutes_owner_id ON minutes(owner_id);
CREATE INDEX IF NOT EXISTS idx_minutes_status ON minutes(status);
CREATE INDEX IF NOT EXISTS idx_minutes_visibility ON minutes(visibility);

-- Enable RLS (Row Level Security)
ALTER TABLE minutes ENABLE ROW LEVEL SECURITY;

-- Create policy for users to see their own minutes
CREATE POLICY "Users can view their own minutes" ON minutes
  FOR SELECT USING (auth.uid()::text = owner_id);

-- Create policy for users to insert their own minutes
CREATE POLICY "Users can insert their own minutes" ON minutes
  FOR INSERT WITH CHECK (auth.uid()::text = owner_id);

-- Create policy for users to update their own minutes
CREATE POLICY "Users can update their own minutes" ON minutes
  FOR UPDATE USING (auth.uid()::text = owner_id);

-- Create policy for users to delete their own minutes
CREATE POLICY "Users can delete their own minutes" ON minutes
  FOR DELETE USING (auth.uid()::text = owner_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_minutes_updated_at 
  BEFORE UPDATE ON minutes 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
