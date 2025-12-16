-- Table to store per-user Google OAuth tokens for calendar sync
create table if not exists public.user_google_tokens (
    user_id uuid primary key,
    provider text not null default 'google',
    access_token text not null,
    refresh_token text not null,
    expires_at timestamptz not null,
    scope text,
    token_type text,
    id_token text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.update_user_google_tokens_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_google_tokens_updated_at on public.user_google_tokens;
create trigger trg_user_google_tokens_updated_at
before update on public.user_google_tokens
for each row execute function public.update_user_google_tokens_updated_at();
