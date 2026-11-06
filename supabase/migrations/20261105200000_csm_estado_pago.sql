-- Estado de pago de GHL (Deudor / Apurar / Situacion normal) para el listado diario de CSM.
alter table public.csm add column if not exists estado_pago text;
create index if not exists csm_estado_pago_idx on public.csm (estado_pago) where estado_pago in ('Deudor','Apurar');
