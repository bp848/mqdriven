-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the approval reminder function to run every morning at 9:00 AM (UTC time, check your DB timezone)
-- NOTE: You must replace <SERVICE_ROLE_KEY> with your actual Supabase Service Role Key.
-- This key acts as the authorization for invoking the Edge Function.
SELECT cron.schedule(
    'approval_reminder_daily',
    '0 0 * * *', -- 00:00 UTC = 09:00 JST
    $$
    select
        net.http_post(
            url:='https://rwjhpfghhgstvplmggks.supabase.co/functions/v1/approval-reminder',
            headers:=jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
            )
        ) as request_id;
    $$
);

-- To verify if it's scheduled:
-- SELECT * FROM cron.job;

-- To un-schedule:
-- SELECT cron.unschedule('approval_reminder_daily');
