alter table public.csm_diagnosticos
  add column if not exists client_ghlid text;

create unique index if not exists idx_csm_diagnosticos_client_ghlid
  on public.csm_diagnosticos (client_ghlid)
  where client_ghlid is not null;
