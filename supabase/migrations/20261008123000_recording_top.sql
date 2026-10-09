begin;
create table if not exists public.recording_top (
 recording_id text primary key check (recording_id ~ '^[a-f0-9]{64}$'),
 selected_by text not null,
 selected_name text not null,
 selected_at timestamptz not null default now()
);
alter table public.recording_top enable row level security;
revoke all on public.recording_top from public,anon,authenticated;
grant select,insert,delete on public.recording_top to service_role;
commit;
