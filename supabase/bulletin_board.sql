-- Bulletin Board schema for Supabase (run via SQL editor)
create extension if not exists "uuid-ossp";

create table if not exists public.bulletin_threads (
    id uuid primary key default uuid_generate_v4(),
    title text not null,
    body text not null,
    tags text[] not null default '{}',
    pinned boolean not null default false,
    assignee_ids uuid[] not null default '{}',
    author_id uuid not null references public.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bulletin_comments (
    id uuid primary key default uuid_generate_v4(),
    thread_id uuid not null references public.bulletin_threads(id) on delete cascade,
    body text not null,
    author_id uuid not null references public.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists bulletin_threads_pinned_updated_idx on public.bulletin_threads (pinned desc, updated_at desc);
create index if not exists bulletin_comments_thread_idx on public.bulletin_comments (thread_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$ language plpgsql;

drop trigger if exists bulletin_threads_set_updated_at on public.bulletin_threads;
create trigger bulletin_threads_set_updated_at
before update on public.bulletin_threads
for each row execute procedure public.set_updated_at();

alter table public.bulletin_threads enable row level security;
alter table public.bulletin_comments enable row level security;

create policy "bulletin_threads_select_all"
    on public.bulletin_threads
    for select
    using ( true );

create policy "bulletin_threads_insert_author"
    on public.bulletin_threads
    for insert
    with check ( auth.uid() = author_id );

create policy "bulletin_threads_update_author_or_admin"
    on public.bulletin_threads
    for update
    using (
        author_id = auth.uid()
        or exists (
            select 1 from public.users u
            where u.id = auth.uid() and u.role = 'admin'
        )
    )
    with check (
        author_id = auth.uid()
        or exists (
            select 1 from public.users u
            where u.id = auth.uid() and u.role = 'admin'
        )
    );

create policy "bulletin_threads_delete_author_or_admin"
    on public.bulletin_threads
    for delete
    using (
        author_id = auth.uid()
        or exists (
            select 1 from public.users u
            where u.id = auth.uid() and u.role = 'admin'
        )
    );

create policy "bulletin_comments_select_all"
    on public.bulletin_comments
    for select
    using ( true );

create policy "bulletin_comments_insert_author"
    on public.bulletin_comments
    for insert
    with check ( auth.uid() = author_id );

create policy "bulletin_comments_delete_author_or_admin"
    on public.bulletin_comments
    for delete
    using (
        author_id = auth.uid()
        or exists (
            select 1 from public.users u
            where u.id = auth.uid() and u.role = 'admin'
        )
    );
