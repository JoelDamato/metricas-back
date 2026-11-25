-- Modelo de negocio y rubro que el CCM completa desde el panel (TA-8289).
-- Tabla nueva y aparte: no modifica ninguna tabla, vista ni trigger existente.
begin;
create table if not exists public.csm_business_segments (
  ghlid text primary key,
  modelo text not null,
  rubro text not null,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.csm_business_segments enable row level security;
revoke all on public.csm_business_segments from public, anon, authenticated;
grant select, insert, update on public.csm_business_segments to service_role;
notify pgrst, 'reload schema';
commit;
