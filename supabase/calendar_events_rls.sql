-- Enable RLS on calendar_events table
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT SELECT ON public.calendar_events TO anon;

-- Policy for anonymous users (read-only, no user_id restriction)
CREATE POLICY "anon_read_all" ON public.calendar_events
  FOR SELECT TO anon
  USING (true);

-- Policy for authenticated users (full access to their own data)
CREATE POLICY "user_full_access" ON public.calendar_events
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
