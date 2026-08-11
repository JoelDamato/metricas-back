create table if not exists public.csm_diagnosticos (
  id uuid primary key default gen_random_uuid(),
  client_ghlid text,
  client_name text not null,
  business_name text,
  client_email text,
  csm_name text,
  data jsonb not null default '{}'::jsonb,
  public_token text not null unique,
  created_by_email text,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_csm_diagnosticos_updated_at on public.csm_diagnosticos (updated_at desc);
