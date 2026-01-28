create table if not exists public.meeting_minutes_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    media_name text not null,
    media_type text,
    media_size bigint,
    transcript jsonb not null,
    summary jsonb not null,
    word_count integer,
    char_count integer,
    top_words jsonb,
    logs text[] default array[]::text[],
    created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_meeting_minutes_sessions_user on public.meeting_minutes_sessions(user_id);
