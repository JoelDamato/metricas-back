create table if not exists public.pdi_closer_records (
  id bigint generated always as identity primary key,
  closer_key text not null unique,
  closer_name text not null,
  performance jsonb not null default '{}'::jsonb,
  action_plan jsonb not null default '[]'::jsonb,
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pdi_closer_records_key_length check (char_length(closer_key) between 1 and 120),
  constraint pdi_closer_records_name_length check (char_length(closer_name) between 1 and 180),
  constraint pdi_closer_records_performance_object check (jsonb_typeof(performance) = 'object'),
  constraint pdi_closer_records_action_plan_array check (jsonb_typeof(action_plan) = 'array')
);

create index if not exists pdi_closer_records_updated_at_idx
  on public.pdi_closer_records (updated_at desc);

alter table public.pdi_closer_records enable row level security;
alter table public.pdi_closer_records force row level security;

revoke all on table public.pdi_closer_records from anon, authenticated;
grant select, insert, update, delete on table public.pdi_closer_records to service_role;
grant usage, select on sequence public.pdi_closer_records_id_seq to service_role;

comment on table public.pdi_closer_records is
  'Planes de Desafío Individual de closers; acceso exclusivo mediante API autorizada para Mati y Leo.';
