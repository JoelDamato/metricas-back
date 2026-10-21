begin;
create table if not exists public.administration_resources (
  id uuid primary key,
  kind text not null check (kind in ('team','tutorials')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  archived boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null
);
create index if not exists administration_resources_kind_id on public.administration_resources(kind,id);
alter table public.administration_resources enable row level security;
revoke all on public.administration_resources from public, anon, authenticated;
grant select,insert,update on public.administration_resources to service_role;
notify pgrst, 'reload schema';
commit;
