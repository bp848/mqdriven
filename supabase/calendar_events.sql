-- Calendar events table for system <-> Google sync
create table if not exists public.calendar_events (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null,
    title text not null,
    description text,
    start_at timestamptz not null,
    end_at timestamptz not null,
    all_day boolean not null default false,
    source text default 'system', -- system | google
    google_event_id text, -- linkage to Google Calendar event id
    updated_by_source text default 'system', -- system | google
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_calendar_events_user_start on public.calendar_events(user_id, start_at);
create index if not exists idx_calendar_events_google_event on public.calendar_events(google_event_id);

comment on table public.calendar_events is 'User calendar events for ERP <-> Google Calendar sync';
comment on column public.calendar_events.google_event_id is 'Google Calendar event id mapped to this record';

-- Optional trigger for updated_at (if your project already uses set_updated_at, attach here)
-- create trigger set_timestamp before update on public.calendar_events
-- for each row execute function public.set_updated_at();
