begin;
create table if not exists public.recording_comments (
 id uuid primary key default gen_random_uuid(),
 recording_id text not null check (recording_id ~ '^[a-f0-9]{64}$'),
 author_email text not null,
 author_name text not null,
 body text not null check (length(trim(body)) between 1 and 4000),
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists recording_comments_thread on public.recording_comments(recording_id,created_at,id);
alter table public.recording_comments enable row level security;
revoke all on public.recording_comments from public, anon, authenticated;
grant select,insert,update,delete on public.recording_comments to service_role;
commit;
