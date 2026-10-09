-- Laboratorio Supabase-first para comprobantes.
-- Esta migracion esta preparada pero NO debe aplicarse hasta aprobar la paridad local.
-- Mantiene public.comprobantes como tabla compatible con las vistas existentes.

create extension if not exists pgcrypto;

create table if not exists public.comprobantes_productos_config (
  id uuid primary key default gen_random_uuid(),
  legacy_notion_id text unique,
  code text not null unique,
  name text not null,
  active boolean not null default true,
  club_prices jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by_email text,
  constraint comprobantes_productos_club_prices_array
    check (jsonb_typeof(club_prices) = 'array')
);

create table if not exists public.comprobantes_medios_pago_config (
  id uuid primary key default gen_random_uuid(),
  legacy_notion_id text unique,
  code text not null unique,
  name text not null,
  active boolean not null default true,
  payment_type text,
  account_label text,
  iva_rate numeric(10, 8) not null default 0,
  commission_rate numeric(10, 8) not null default 0,
  initial_balance numeric not null default 0,
  position integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by_email text,
  constraint comprobantes_medios_iva_rate_range check (iva_rate between 0 and 1),
  constraint comprobantes_medios_commission_rate_range check (commission_rate between 0 and 1)
);

create table if not exists public.comprobantes_responsables_config (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  email text,
  role text not null default 'Closer',
  active boolean not null default true,
  position integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by_email text,
  constraint comprobantes_responsables_code_not_blank check (btrim(code) <> ''),
  constraint comprobantes_responsables_name_not_blank check (btrim(name) <> ''),
  constraint comprobantes_responsables_role_check check (role in ('Closer', 'Setter', 'Ambos'))
);

create unique index if not exists comprobantes_responsables_name_uidx
  on public.comprobantes_responsables_config (lower(name));
create unique index if not exists comprobantes_responsables_email_uidx
  on public.comprobantes_responsables_config (lower(email))
  where email is not null and btrim(email) <> '';

create table if not exists public.comprobantes_reglas_config (
  id text primary key default 'default',
  rules jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by_email text,
  constraint comprobantes_reglas_singleton check (id = 'default'),
  constraint comprobantes_reglas_object check (jsonb_typeof(rules) = 'object')
);

create table if not exists public.comprobantes_submission_batches (
  id uuid primary key,
  submission_key text not null unique,
  status text not null default 'pending',
  operation_count integer not null,
  actor_email text not null,
  request_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint comprobantes_batch_status check (status in ('pending', 'completed', 'failed')),
  constraint comprobantes_batch_operation_count check (operation_count between 1 and 6)
);

alter table public.comprobantes
  add column if not exists submission_key text,
  add column if not exists batch_id uuid,
  add column if not exists operation_index integer,
  add column if not exists source_system text,
  add column if not exists legacy_notion_id text,
  add column if not exists lead_id text,
  add column if not exists cliente_ghlid text,
  add column if not exists venta_id text,
  add column if not exists producto_id uuid,
  add column if not exists medio_pago_id uuid,
  add column if not exists responsable_venta_id uuid,
  add column if not exists iva_tasa numeric(10, 8),
  add column if not exists comision_tasa numeric(10, 8),
  add column if not exists iva_usd numeric,
  add column if not exists comision_usd numeric,
  add column if not exists cash_collected_neto numeric,
  add column if not exists cash_collected_neto_ars numeric,
  add column if not exists cash_collected_neto_total numeric,
  add column if not exists cash_neto_ars_snapshot numeric,
  add column if not exists cash_neto_usd_snapshot numeric,
  add column if not exists meses_soporte integer,
  add column if not exists sesiones_configuradas numeric,
  add column if not exists bonus_mati boolean not null default false,
  add column if not exists created_by_email text,
  add column if not exists deleted_at timestamptz;

comment on column public.comprobantes.cash_collected_neto is
  'KPI canonico en USD: cash bruto menos IVA. No descuenta comision del medio.';
comment on column public.comprobantes.cash_collected_neto_ars is
  'KPI canonico en ARS: cash bruto menos IVA. No descuenta comision del medio.';
comment on column public.comprobantes.cash_neto_ars_snapshot is
  'Snapshot financiero en ARS despues de IVA y comision del medio; no reemplaza al KPI cash_collected_neto.';
comment on column public.comprobantes.cash_neto_usd_snapshot is
  'Snapshot financiero en USD despues de IVA y comision del medio; no reemplaza al KPI cash_collected_neto.';

update public.comprobantes
set source_system = 'notion',
    legacy_notion_id = coalesce(legacy_notion_id, id),
    cliente_ghlid = coalesce(cliente_ghlid, ghlid)
where source_system is null;

alter table public.comprobantes
  alter column source_system set default 'notion';

-- Contrato canonico: los tableros consumen cash neto solamente de IVA.
-- La comision del medio queda separada en los snapshots cash_neto_*.
create or replace function public.metricas_set_cash_collected_neto()
returns trigger
language plpgsql
as $$
declare
  gross_ars numeric;
  exchange_rate numeric;
  net_factor numeric := 1;
begin
  gross_ars := coalesce(
    nullif(new.cash_collected_ars, 0),
    nullif(new.cash_ar, 0),
    nullif(new.cash_collected_ar, 0)
  );
  if trim(coalesce(new.tc, '')) ~ '^[0-9]+([.,][0-9]+)?$' then
    exchange_rate := replace(trim(new.tc), ',', '.')::numeric;
  end if;
  if gross_ars is null
     and coalesce(new.cash_collected, 0) <> 0
     and coalesce(exchange_rate, 0) > 0 then
    gross_ars := new.cash_collected * exchange_rate;
  end if;
  if coalesce(new.iva, 0) > 0 and coalesce(gross_ars, 0) > 0 then
    net_factor := greatest(gross_ars - new.iva, 0) / gross_ars;
  end if;
  new.cash_collected_neto := round(coalesce(new.cash_collected, 0) * net_factor, 6);
  new.cash_collected_neto_total := round(coalesce(new.cash_collected_total, 0) * net_factor, 6);
  new.cash_collected_neto_ars := round(greatest(coalesce(gross_ars, 0) - coalesce(new.iva, 0), 0), 2);
  return new;
end;
$$;

drop trigger if exists comprobantes_set_cash_collected_neto on public.comprobantes;
create trigger comprobantes_set_cash_collected_neto
before insert or update of
  cash_collected,
  cash_collected_total,
  cash_collected_ars,
  cash_ar,
  cash_collected_ar,
  iva,
  tc
on public.comprobantes
for each row
execute function public.metricas_set_cash_collected_neto();

create or replace function public.metricas_recalculate_sale_cash_v1(p_sale_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.comprobantes sale
  set cash_collected_total = coalesce((
    select round(sum(coalesce(c.cash_collected, 0))::numeric, 2)
    from public.comprobantes c
    where c.deleted_at is null
      and c.tipo in ('Venta', 'Cobranza')
      and (c.id = p_sale_id or c.venta_id = p_sale_id or c.venta_relacionada = p_sale_id)
  ), 0)
  where sale.id = p_sale_id and sale.tipo = 'Venta';

  update public.comprobantes sale
  set cash_collected_neto_total = coalesce((
    select round(sum(coalesce(c.cash_collected_neto, 0))::numeric, 6)
    from public.comprobantes c
    where c.deleted_at is null
      and c.tipo in ('Venta', 'Cobranza')
      and (c.id = p_sale_id or c.venta_id = p_sale_id or c.venta_relacionada = p_sale_id)
  ), 0)
  where sale.id = p_sale_id and sale.tipo = 'Venta';
end;
$$;

alter table public.comprobantes
  add constraint comprobantes_source_system_check
    check (source_system in ('notion', 'supabase_direct', 'migration')) not valid,
  add constraint comprobantes_operation_index_check
    check (operation_index is null or operation_index between 0 and 5) not valid,
  add constraint comprobantes_iva_tasa_check
    check (iva_tasa is null or iva_tasa between 0 and 1) not valid,
  add constraint comprobantes_comision_tasa_check
    check (comision_tasa is null or comision_tasa between 0 and 1) not valid,
  add constraint comprobantes_batch_fk
    foreign key (batch_id) references public.comprobantes_submission_batches(id) not valid,
  add constraint comprobantes_lead_fk
    foreign key (lead_id) references public.leads_raw(id) not valid,
  add constraint comprobantes_venta_fk
    foreign key (venta_id) references public.comprobantes(id) not valid,
  add constraint comprobantes_producto_config_fk
    foreign key (producto_id) references public.comprobantes_productos_config(id) not valid,
  add constraint comprobantes_medio_pago_config_fk
    foreign key (medio_pago_id) references public.comprobantes_medios_pago_config(id) not valid,
  add constraint comprobantes_responsable_config_fk
    foreign key (responsable_venta_id) references public.comprobantes_responsables_config(id) not valid;

create unique index if not exists comprobantes_submission_operation_uidx
  on public.comprobantes (submission_key, operation_index)
  where submission_key is not null and operation_index is not null;

create index if not exists comprobantes_ghlid_idx
  on public.comprobantes (ghlid);
create index if not exists comprobantes_lead_id_idx
  on public.comprobantes (lead_id)
  where lead_id is not null;
create index if not exists comprobantes_f_acreditacion_idx
  on public.comprobantes (f_acreditacion);
create index if not exists comprobantes_f_venta_idx
  on public.comprobantes (f_venta);
create index if not exists comprobantes_responsable_f_venta_idx
  on public.comprobantes (responsable_venta, f_venta);
create index if not exists comprobantes_responsable_id_f_venta_idx
  on public.comprobantes (responsable_venta_id, f_venta)
  where responsable_venta_id is not null;
create index if not exists comprobantes_venta_id_idx
  on public.comprobantes (venta_id)
  where venta_id is not null;
create index if not exists comprobantes_direct_active_idx
  on public.comprobantes (source_system, f_acreditacion)
  where deleted_at is null;

create table if not exists public.comprobantes_archivos (
  id uuid primary key default gen_random_uuid(),
  comprobante_id text not null references public.comprobantes(id) on delete cascade,
  batch_id uuid references public.comprobantes_submission_batches(id) on delete cascade,
  bucket text not null,
  object_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  created_at timestamptz not null default now(),
  constraint comprobantes_archivos_size check (size_bytes > 0 and size_bytes <= 20971520),
  constraint comprobantes_archivos_sha256 check (sha256 ~ '^[a-f0-9]{64}$'),
  unique (bucket, object_path),
  unique (comprobante_id, sha256)
);

create index if not exists comprobantes_archivos_comprobante_idx
  on public.comprobantes_archivos (comprobante_id);
create index if not exists comprobantes_archivos_batch_idx
  on public.comprobantes_archivos (batch_id);

create table if not exists public.comprobantes_storage_cleanup_queue (
  id bigint generated always as identity primary key,
  comprobante_id text,
  bucket text not null,
  object_path text not null,
  reason text not null default 'delete_cleanup_failed',
  last_error text,
  requested_by_email text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (bucket, object_path),
  constraint comprobantes_storage_cleanup_attempts_check check (attempts >= 0)
);

alter table public.comprobantes_storage_cleanup_queue
  add column if not exists last_attempt_at timestamptz not null default now();

create index if not exists comprobantes_storage_cleanup_pending_idx
  on public.comprobantes_storage_cleanup_queue (created_at)
  where completed_at is null;

create table if not exists public.comprobantes_eventos (
  id bigint generated always as identity primary key,
  comprobante_id text references public.comprobantes(id) on delete set null,
  batch_id uuid references public.comprobantes_submission_batches(id) on delete set null,
  event_type text not null,
  actor_email text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists comprobantes_eventos_comprobante_idx
  on public.comprobantes_eventos (comprobante_id, created_at desc);
create index if not exists comprobantes_eventos_batch_idx
  on public.comprobantes_eventos (batch_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Snapshot auditado de Productos en Notion al 21/09/2026.
insert into public.comprobantes_productos_config
  (id, legacy_notion_id, code, name, active, club_prices, position)
values
  ('33d48251-7a95-806e-96d5-cd8cdaa81bc0', '33d48251-7a95-806e-96d5-cd8cdaa81bc0', 'consultoria', 'Consultoria', true, '[]', 10),
  ('33848251-7a95-80c5-92e6-ebb958f11d09', '33848251-7a95-80c5-92e6-ebb958f11d09', 'costos-rentables', 'Costos Rentables', true, '[]', 20),
  ('2d848251-7a95-8022-ab0a-f90cb7f54946', '2d848251-7a95-8022-ab0a-f90cb7f54946', 'solo-sesiones', 'Solo sesiones', true, '[]', 30),
  ('2d848251-7a95-80f3-8e0b-c986abc4fe96', '2d848251-7a95-80f3-8e0b-c986abc4fe96', 'renovacion-programa-sesiones', 'Renovacion programa + Sesiones', true, '[]', 40),
  ('2d848251-7a95-800f-931a-f716f9739bd6', '2d848251-7a95-800f-931a-f716f9739bd6', 'renovacion-programa', 'Renovacion programa', true, '[]', 50),
  ('2aa48251-7a95-803b-aa68-e03fbd79a5a9', '2aa48251-7a95-803b-aa68-e03fbd79a5a9', 'renovacion-meg-personalizado', 'Renovacion - Meg Personalizado', true, '[]', 60),
  ('29f48251-7a95-800d-9168-fefc4ff0ff16', '29f48251-7a95-800d-9168-fefc4ff0ff16', 'club', 'Club', true, '[{"key":"club1","label":"Precio Club 1","amountArs":39500},{"key":"club2","label":"Precio Club 2","amountArs":25000}]', 70),
  ('29548251-7a95-80a7-859e-ec830d76e1b9', '29548251-7a95-80a7-859e-ec830d76e1b9', 'reportes-financieros', 'Reportes Financieros', true, '[]', 80),
  ('29548251-7a95-807d-93bf-d2b153268b6d', '29548251-7a95-807d-93bf-d2b153268b6d', 'meg-personalizado', 'Meg Personalizado', true, '[]', 90),
  ('29548251-7a95-8053-b6a0-c6ed814217b7', '29548251-7a95-8053-b6a0-c6ed814217b7', 'meg-1-0', 'Meg 1.0', false, '[]', 100),
  ('29548251-7a95-80c5-a22c-fcde26e622d4', '29548251-7a95-80c5-a22c-fcde26e622d4', 'meg-2-0', 'Meg 2.0', false, '[]', 110),
  ('29548251-7a95-8007-a319-f3275e93edde', '29548251-7a95-8007-a319-f3275e93edde', 'meg-2-1', 'Meg 2.1', true, '[]', 120),
  ('29548251-7a95-806b-acb7-d56534ebd3fa', '29548251-7a95-806b-acb7-d56534ebd3fa', 'renovacion-meg-2-1', 'Renovacion - Meg 2.1', true, '[]', 130),
  ('29548251-7a95-803f-b8c7-d1a9890b7010', '29548251-7a95-803f-b8c7-d1a9890b7010', 'renovacion-meg-2-0', 'Renovacion - Meg 2.0', false, '[]', 140),
  ('28048251-7a95-8038-9b18-ff1f0543a3b6', '28048251-7a95-8038-9b18-ff1f0543a3b6', 'renovacion-meg-1-0', 'Renovacion - Meg 1.0', false, '[]', 150)
on conflict (code) do update
set legacy_notion_id = excluded.legacy_notion_id,
    name = excluded.name,
    active = excluded.active,
    club_prices = excluded.club_prices,
    position = excluded.position,
    updated_at = now();

-- Catálogo completo auditado en Notion al 21/09/2026: 51 filas (17 activas,
-- 31 históricas con nombre y 3 históricas sin título conservadas por ID).
insert into public.comprobantes_medios_pago_config
  (id, legacy_notion_id, code, name, active, payment_type, iva_rate, commission_rate, initial_balance, account_label, position)
values
  ('29f48251-7a95-809f-a2ff-cc7c29be7cb2', '29f48251-7a95-809f-a2ff-cc7c29be7cb2', 'banco-matias', 'Banco Matias', true, 'Propia', 0.21, 0, 0, 'Cuit a Facturar', 10),
  ('29f48251-7a95-806e-8534-da8356f4eb42', '29f48251-7a95-806e-8534-da8356f4eb42', 'club-transferencias', 'Club - Transferencias', true, 'Propia', 0, 0, 0, '', 20),
  ('2af48251-7a95-801c-b538-e57b98e66fdf', '2af48251-7a95-801c-b538-e57b98e66fdf', 'echeq-banco-frances', 'E-cheq Bco Frances', true, 'Propia', 0.21, 0, 0, 'Cuit a Facturar', 30),
  ('29f48251-7a95-807f-9575-e42261412e58', '29f48251-7a95-807f-9575-e42261412e58', 'efectivo', 'Efectivo', true, 'Propia', 0, 0, 0, '', 40),
  ('36f48251-7a95-8071-83b9-c39c385baf01', '36f48251-7a95-8071-83b9-c39c385baf01', 'elite-tim-tecnologia', 'ELITE - Depósitos -TIM TECNOLOGIA', true, 'Financiera', 0, 0, 0, 'CUIT del titular de la cuenta que efectuó la TR', 50),
  ('3c748251-7a95-8053-8336-d496a73610fe', '3c748251-7a95-8053-8336-d496a73610fe', 'elite-rebit', 'ELITE - REBIT', true, 'Financiera', 0, 0, 0, '', 60),
  ('39948251-7a95-8030-93a4-e2b72ed6bc0f', '39948251-7a95-8030-93a4-e2b72ed6bc0f', 'exentos', 'Exentos', true, 'Propia', 0, 0, 0, '', 70),
  ('29f48251-7a95-802e-a9b1-d0590e394ab2', '29f48251-7a95-802e-a9b1-d0590e394ab2', 'hotmart', 'Hotmart', true, 'Propia', 0, 0, 0, '', 80),
  ('29f48251-7a95-80c7-86d0-db228f26d378', '29f48251-7a95-80c7-86d0-db228f26d378', 'jt-binance', 'JT - Binance', true, 'Financiera', 0, 0, 0, 'CUIT del titular de la cuenta que efectuó la TR', 90),
  ('2b748251-7a95-8010-8e6e-c36eea3e3aa2', '2b748251-7a95-8010-8e6e-c36eea3e3aa2', 'jt-icbc-dolares', 'JT - ICBC Dolares', true, 'Financiera', 0, 0, 0, 'CUIT del titular de la cuenta que efectuó la TR', 100),
  ('3b448251-7a95-8076-a6fd-ffc3db22d26b', '3b448251-7a95-8076-a6fd-ffc3db22d26b', 'jt-transferencia-dolares', 'JT - Transferencia Dólares', true, 'Financiera', 0, 0, 0, 'CUIT del titular de la cuenta que efectuó la TR', 110),
  ('32748251-7a95-806e-a307-c1f94686af15', '32748251-7a95-806e-a307-c1f94686af15', 'link-financiera', 'Link - Financiera', true, 'Financiera', 0, 0.05, 0, 'CUIT del titular de la cuenta que efectuó la TR', 120),
  ('29f48251-7a95-8085-95e4-d2f57e29f340', '29f48251-7a95-8085-95e4-d2f57e29f340', 'mercado-pago', 'Mercado Pago', true, 'Propia', 0.21, 0, 0, 'Cuit a Facturar', 130),
  ('32748251-7a95-80bb-b6b2-cec8c6a412e3', '32748251-7a95-80bb-b6b2-cec8c6a412e3', 'mp-link', 'MP -LINK', true, 'Propia', 0.21, 0.0629, 0, 'Cuit a Facturar', 140),
  ('29f48251-7a95-80b2-b8c8-dae8591055e7', '29f48251-7a95-80b2-b8c8-dae8591055e7', 'paypal', 'Paypal', true, 'Propia', 0, 0, 0, '', 150),
  ('3a048251-7a95-8055-ad58-ecc5f009226c', '3a048251-7a95-8055-ad58-ecc5f009226c', 'wst-sercob', 'WST - SERCOB', true, 'Financiera', 0, 0, 0, 'CUIT del titular de la cuenta que efectuó la TR', 160),
  ('36f48251-7a95-8077-8676-ec4aa21924eb', '36f48251-7a95-8077-8676-ec4aa21924eb', 'wst-payments-group', 'WST -Depósitos - PAYMENTS GROUP', true, 'Financiera', 0, 0, 0, 'CUIT del titular de la cuenta que efectuó la TR', 170),
  ('2b948251-7a95-8083-9cee-ce38e12df215', '2b948251-7a95-8083-9cee-ce38e12df215', 'elite-bbva-cc-pesos', 'Elite - BBVA CC Pesos', false, 'Financiera', 0, 0, 0, '', 180),
  ('2f848251-7a95-807d-a629-e3550fa0911c', '2f848251-7a95-807d-a629-e3550fa0911c', 'elite-deposito-tim-tecnologia-integ', 'ELITE - Depósito TIM TECNOLOGIA INTEG', false, 'Financiera', 0, 0, 0, '', 190),
  ('2d848251-7a95-800b-868a-d0f90d8323cf', '2d848251-7a95-800b-868a-d0f90d8323cf', 'elite-depositos-credicoop', 'ELITE - Depósitos Credicoop', false, 'Financiera', 0, 0, 0, '', 200),
  ('2d348251-7a95-80b6-ba33-e4146ca7d6f9', '2d348251-7a95-80b6-ba33-e4146ca7d6f9', 'elite-goat', 'Elite - GOAT', false, 'Financiera', 0, 0, 0, '', 210),
  ('3a548251-7a95-805c-896e-fdb6bf0bb986', '3a548251-7a95-805c-896e-fdb6bf0bb986', 'elite-jartumm', 'ELITE - JARTUMM', false, 'Financiera', 0, 0, 0, '', 220),
  ('32c48251-7a95-804f-af6e-e2af2f4d0de6', '32c48251-7a95-804f-af6e-e2af2f4d0de6', 'elite-nau-terra', 'ELITE - NAU.TERRA', false, 'Financiera', 0, 0, 0, '', 230),
  ('3ab48251-7a95-8060-8246-ca2e28a4f660', '3ab48251-7a95-8060-8246-ca2e28a4f660', 'elite-pvs-junin', 'ELITE - PVS.JUNIN', false, 'Financiera', 0, 0, 0, 'CUIT del titular de la cuenta que efectuó la TR', 240),
  ('36648251-7a95-808e-a832-c317021bd5c8', '36648251-7a95-808e-a832-c317021bd5c8', 'elite-sillo-56', 'ELITE - SILLO 56', false, 'Financiera', 0, 0, 0, '', 250),
  ('29f48251-7a95-8080-854f-c9476d7baadd', '29f48251-7a95-8080-854f-c9476d7baadd', 'jt-bco-del-sol-dolares', 'JT - Bco Del Sol Dolares', false, 'Financiera', 0, 0, 0, 'Cuit de la persona que pago', 260),
  ('29f48251-7a95-8048-bc86-f91e30cf8b08', '29f48251-7a95-8048-bc86-f91e30cf8b08', 'jt-e-check', 'JT - E-Check', false, 'Financiera', 0, 0, 0, '', 270),
  ('29f48251-7a95-8050-80d0-d20ca9021caf', '29f48251-7a95-8050-80d0-d20ca9021caf', 'jt-icbc-dolares-29f48251', 'JT - ICBC Dólares', false, 'Financiera', 0, 0, 0, 'Cuit de la persona que pago', 280),
  ('29f48251-7a95-8048-a814-ec984134f526', '29f48251-7a95-8048-a814-ec984134f526', 'jt-mercado-pago', 'JT - Mercado Pago', false, 'Financiera', 0, 0, 0, '', 290),
  ('29f48251-7a95-80d7-ab95-e83a385c7b9f', '29f48251-7a95-80d7-ab95-e83a385c7b9f', 'jt-pedro-santiago-javier', 'JT - Pedro Santiago Javier', false, 'Financiera', 0, 0, 0, '', 300),
  ('29f48251-7a95-80a6-92a0-eb0cb018a363', '29f48251-7a95-80a6-92a0-eb0cb018a363', 'jt-reba', 'JT - Reba', false, 'Financiera', 0, 0, 0, '', 310),
  ('29f48251-7a95-80d9-85ef-ef97fa4f1ef3', '29f48251-7a95-80d9-85ef-ef97fa4f1ef3', 'jt-santander-dolares', 'JT - Santander Dolares', false, 'Financiera', 0, 0, 0, 'Cuit de la persona que pago', 320),
  ('29f48251-7a95-80d6-bf2d-f497db24d372', '29f48251-7a95-80d6-bf2d-f497db24d372', 'jt-santander-pesos', 'JT - Santander Pesos', false, 'Financiera', 0, 0, 0, '', 330),
  ('29f48251-7a95-8041-b50e-fd3e19e78a43', '29f48251-7a95-8041-b50e-fd3e19e78a43', 'mg-campo-y-serv', 'MG - Campo y Serv', false, 'Financiera', 0, 0, 0, '', 340),
  ('29f48251-7a95-8055-9d73-e437686eb8dd', '29f48251-7a95-8055-9d73-e437686eb8dd', 'mg-cine', 'MG - Cine', false, 'Financiera', 0, 0, 0, '', 350),
  ('29f48251-7a95-8057-9a25-c63ef88652fe', '29f48251-7a95-8057-9a25-c63ef88652fe', 'mg-corsari', 'MG - CORSARI', false, 'Financiera', 0, 0, 0, '', 360),
  ('29f48251-7a95-802d-af0e-fdefa6f8b996', '29f48251-7a95-802d-af0e-fdefa6f8b996', 'mg-deposito-bco-nacion', 'MG - Deposito Bco Nacion', false, 'Financiera', 0, 0, 0, '', 370),
  ('2a748251-7a95-80be-9e00-dc6168a24a42', '2a748251-7a95-80be-9e00-dc6168a24a42', 'mg-deposito-tinsa', 'MG - Depósito Tinsa', false, 'Financiera', 0, 0, 0, '', 380),
  ('2d848251-7a95-8012-80cb-fd6e045419ba', '2d848251-7a95-8012-80cb-fd6e045419ba', 'mg-depositos-comafi', 'MG - Depósitos COMAFI', false, 'Financiera', 0, 0, 0, '', 390),
  ('29f48251-7a95-8032-8b28-c8229c2e8510', '29f48251-7a95-8032-8b28-c8229c2e8510', 'mg-ferosol', 'MG - FEROSOL', false, 'Financiera', 0, 0, 0, '', 400),
  ('29f48251-7a95-80a8-9321-feac604f4b3b', '29f48251-7a95-80a8-9321-feac604f4b3b', 'mg-futprot', 'MG - Futprot', false, 'Financiera', 0, 0, 0, '', 410),
  ('29f48251-7a95-8016-8658-cb6cfeed9db8', '29f48251-7a95-8016-8658-cb6cfeed9db8', 'mg-le-sorelle', 'MG - Le Sorelle', false, 'Financiera', 0, 0, 0, '', 420),
  ('32548251-7a95-80f7-8fa7-d54bc6b8ef1f', '32548251-7a95-80f7-8fa7-d54bc6b8ef1f', 'mg-mac-log-srl', 'MG - Mac Log SRL', false, 'Financiera', 0, 0, 0, '', 430),
  ('29f48251-7a95-80a1-b0c3-ee576d2c3f16', '29f48251-7a95-80a1-b0c3-ee576d2c3f16', 'mg-punta-indio', 'MG - Punta indio', false, 'Financiera', 0, 0, 0, '', 440),
  ('29f48251-7a95-8059-a48e-dadcf5bbd138', '29f48251-7a95-8059-a48e-dadcf5bbd138', 'mg-recafu', 'MG - RECAFU', false, 'Financiera', 0, 0, 0, '', 450),
  ('29f48251-7a95-80b1-9bd0-db84f03264cd', '29f48251-7a95-80b1-9bd0-db84f03264cd', 'mg-sastreria', 'MG Sastreria', false, 'Financiera', 0, 0, 0, '', 460),
  ('31448251-7a95-8056-968d-ea2b305b1ae9', '31448251-7a95-8056-968d-ea2b305b1ae9', 'sin-nombre-historico-31448251', 'Sin nombre histórico (31448251)', false, '', 0, 0, 0, '', 470),
  ('31948251-7a95-8095-ae6e-c1c6ce6b72ef', '31948251-7a95-8095-ae6e-c1c6ce6b72ef', 'sin-nombre-historico-31948251', 'Sin nombre histórico (31948251)', false, '', 0, 0, 0, '', 480),
  ('32f48251-7a95-807b-ac92-f66b754009d3', '32f48251-7a95-807b-ac92-f66b754009d3', 'sin-nombre-historico-32f48251', 'Sin nombre histórico (32f48251)', false, '', 0, 0, 0, '', 490),
  ('33448251-7a95-802e-9a49-e4aac7b6eb56', '33448251-7a95-802e-9a49-e4aac7b6eb56', 'wsj-alj-consulting-sa', 'WSJ - ALJ CONSULTING SA', false, 'Financiera', 0, 0, 0, '', 500),
  ('35848251-7a95-8097-870a-ff428bf3ad3a', '35848251-7a95-8097-870a-ff428bf3ad3a', 'wsj-altavera-campos', 'WSJ - ALTAVERA CAMPOS', false, 'Financiera', 0, 0, 0, '', 510)
on conflict (code) do update
set legacy_notion_id = excluded.legacy_notion_id,
    name = excluded.name,
    active = excluded.active,
    payment_type = excluded.payment_type,
    iva_rate = excluded.iva_rate,
    commission_rate = excluded.commission_rate,
    initial_balance = excluded.initial_balance,
    account_label = excluded.account_label,
    position = excluded.position,
    updated_at = now();

-- Responsables comerciales que hoy participan en el cálculo de comisiones.
insert into public.comprobantes_responsables_config
  (id, code, name, email, role, active, position)
values
  ('91000000-0000-4000-8000-000000000001', 'mauro-gaitan', 'Mauro Gaitan', 'gaitanmauro23@gmail.com', 'Closer', true, 10),
  ('91000000-0000-4000-8000-000000000002', 'carlos-tu', 'Carlos Tu', 'charliecarlostu@gmail.com', 'Closer', true, 20),
  ('91000000-0000-4000-8000-000000000003', 'walter-alegre', 'Walter Alegre', 'walteralegre56@gmail.com', 'Closer', true, 30),
  ('91000000-0000-4000-8000-000000000004', 'patricia-conti', 'Patricia Conti', 'posadaelmontecito@gmail.com', 'Closer', true, 40),
  ('91000000-0000-4000-8000-000000000005', 'pablo-butera', 'Pablo Butera', 'pmbutera1234@gmail.com', 'Closer', true, 50),
  ('91000000-0000-4000-8000-000000000006', 'claudio-nicolini', 'Claudio Nicolini', 'meg.claudionicolini@gmail.com', 'Closer', true, 60),
  ('91000000-0000-4000-8000-000000000007', 'nahuel-iasci', 'Nahuel Iasci', 'iascinahuel@gmail.com', 'Setter', true, 70),
  ('91000000-0000-4000-8000-000000000008', 'mati-randazzo', 'Mati Randazzo', 'matirandazzo@gmail.com', 'Ambos', true, 80),
  ('91000000-0000-4000-8000-000000000009', 'nadia-cavallini', 'Nadia Cavallini', 'nadia.cavallini@gmail.com', 'Ambos', true, 90)
on conflict (code) do update
set name = excluded.name,
    email = excluded.email,
    role = excluded.role,
    active = excluded.active,
    position = excluded.position,
    updated_at = now();

insert into public.comprobantes_reglas_config (id, rules)
values (
  'default',
  '{"clubVatRate":0.21,"clubProcessorRate":0.0629,"clubIibbRate":0.035,"relatedSaleRequiredFor":["Cobranza","Devolución"],"maxBatchOperations":6,"cutoverChecklist":{"csmRuleStatus":"pending","arcaControlStatus":"pending","historicalFilesVerified":false,"historicalReconciliationVerified":false,"observationWindowCompleted":false}}'::jsonb
)
on conflict (id) do nothing;

create or replace function public.metricas_save_comprobantes_config_v1(
  p_config jsonb,
  p_actor_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  item_id uuid;
  item_position integer := 0;
begin
  if lower(coalesce(p_actor_email, '')) not in ('matirandazzo@gmail.com', 'nadia.cavallini@gmail.com') then
    raise exception 'Usuario no autorizado para configurar comprobantes';
  end if;
  if jsonb_typeof(p_config->'products') <> 'array'
     or jsonb_typeof(p_config->'paymentMethods') <> 'array'
     or jsonb_typeof(p_config->'responsiblePeople') <> 'array'
     or jsonb_typeof(p_config->'rules') <> 'object' then
    raise exception 'Configuracion invalida';
  end if;

  for item in select value from jsonb_array_elements(p_config->'products') loop
    item_position := item_position + 10;
    item_id := coalesce(
      nullif(item->>'id', '')::uuid,
      nullif(item->>'legacyNotionId', '')::uuid,
      gen_random_uuid()
    );
    insert into public.comprobantes_productos_config
      (id, legacy_notion_id, code, name, active, club_prices, position, updated_at, updated_by_email)
    values (
      item_id,
      nullif(item->>'legacyNotionId', ''),
      item->>'code',
      item->>'name',
      coalesce((item->>'active')::boolean, true),
      coalesce(item->'clubPrices', '[]'::jsonb),
      item_position,
      now(),
      lower(p_actor_email)
    )
    on conflict (code) do update
    set legacy_notion_id = excluded.legacy_notion_id,
        name = excluded.name,
        active = excluded.active,
        club_prices = excluded.club_prices,
        position = excluded.position,
        updated_at = now(),
        updated_by_email = lower(p_actor_email);
  end loop;

  item_position := 0;
  for item in select value from jsonb_array_elements(p_config->'paymentMethods') loop
    item_position := item_position + 10;
    item_id := coalesce(
      nullif(item->>'id', '')::uuid,
      nullif(item->>'legacyNotionId', '')::uuid,
      gen_random_uuid()
    );
    insert into public.comprobantes_medios_pago_config
      (id, legacy_notion_id, code, name, active, payment_type, account_label, iva_rate, commission_rate, initial_balance, position, updated_at, updated_by_email)
    values (
      item_id,
      nullif(item->>'legacyNotionId', ''),
      item->>'code',
      item->>'name',
      coalesce((item->>'active')::boolean, true),
      nullif(item->>'type', ''),
      nullif(item->>'account', ''),
      coalesce((item->>'ivaRate')::numeric, 0),
      coalesce((item->>'commissionRate')::numeric, 0),
      coalesce((item->>'initialBalance')::numeric, 0),
      item_position,
      now(),
      lower(p_actor_email)
    )
    on conflict (code) do update
    set legacy_notion_id = excluded.legacy_notion_id,
        name = excluded.name,
        active = excluded.active,
        payment_type = excluded.payment_type,
        account_label = excluded.account_label,
        iva_rate = excluded.iva_rate,
        commission_rate = excluded.commission_rate,
        initial_balance = excluded.initial_balance,
        position = excluded.position,
        updated_at = now(),
        updated_by_email = lower(p_actor_email);
  end loop;

  item_position := 0;
  for item in select value from jsonb_array_elements(p_config->'responsiblePeople') loop
    item_position := item_position + 10;
    item_id := coalesce(
      nullif(item->>'id', '')::uuid,
      gen_random_uuid()
    );
    insert into public.comprobantes_responsables_config
      (id, code, name, email, role, active, position, updated_at, updated_by_email)
    values (
      item_id,
      item->>'code',
      item->>'name',
      lower(nullif(item->>'email', '')),
      coalesce(nullif(item->>'role', ''), 'Closer'),
      coalesce((item->>'active')::boolean, true),
      item_position,
      now(),
      lower(p_actor_email)
    )
    on conflict (code) do update
    set name = excluded.name,
        email = excluded.email,
        role = excluded.role,
        active = excluded.active,
        position = excluded.position,
        updated_at = now(),
        updated_by_email = lower(p_actor_email);
  end loop;

  insert into public.comprobantes_reglas_config (id, rules, updated_at, updated_by_email)
  values ('default', p_config->'rules', now(), lower(p_actor_email))
  on conflict (id) do update
  set rules = excluded.rules,
      updated_at = now(),
      updated_by_email = lower(p_actor_email);

  return jsonb_build_object('ok', true, 'updatedAt', now());
end;
$$;

create or replace function public.metricas_create_comprobante_batch_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission_key text := nullif(p_payload->>'submissionKey', '');
  v_batch_id uuid := nullif(p_payload->>'batchId', '')::uuid;
  v_actor_email text := lower(nullif(p_payload->>'actorEmail', ''));
  v_rows jsonb := p_payload->'rows';
  v_files jsonb := coalesce(p_payload->'files', '[]'::jsonb);
  v_operation_count integer;
  v_item jsonb;
  v_file jsonb;
  v_comprobante_id text;
  v_sale_id text;
  v_replay boolean := false;
begin
  if v_actor_email is null then
    raise exception 'Falta el usuario que crea el comprobante';
  end if;
  if v_submission_key is null or v_submission_key !~ '^[A-Za-z0-9-]{16,100}$' then
    raise exception 'submissionKey invalido';
  end if;
  if v_batch_id is null or jsonb_typeof(v_rows) <> 'array' then
    raise exception 'Lote invalido';
  end if;
  if jsonb_typeof(v_files) <> 'array' then
    raise exception 'Archivos invalidos';
  end if;
  v_operation_count := jsonb_array_length(v_rows);
  if v_operation_count < 1 or v_operation_count > 6 then
    raise exception 'El lote debe contener entre 1 y 6 operaciones';
  end if;

  if exists (
    select 1 from public.comprobantes_submission_batches
    where submission_key = v_submission_key and status = 'completed'
  ) then
    v_replay := true;
    return jsonb_build_object(
      'ok', true,
      'idempotentReplay', true,
      'submissionKey', v_submission_key,
      'created', coalesce((
        select jsonb_agg(jsonb_build_object('id', id, 'type', tipo) order by operation_index)
        from public.comprobantes
        where submission_key = v_submission_key
      ), '[]'::jsonb)
    );
  end if;

  insert into public.comprobantes_submission_batches
    (id, submission_key, status, operation_count, actor_email, request_snapshot)
  values
    (v_batch_id, v_submission_key, 'pending', v_operation_count, v_actor_email, p_payload - 'files')
  on conflict (submission_key) do nothing;

  if not found then
    raise exception 'La carga ya existe pero no esta completa; requiere revision';
  end if;

  for v_item in select value from jsonb_array_elements(v_rows) loop
    if nullif(v_item->>'id', '') is null
       or v_item->>'submission_key' is distinct from v_submission_key
       or nullif(v_item->>'batch_id', '')::uuid is distinct from v_batch_id
       or v_item->>'source_system' is distinct from 'supabase_direct'
       or lower(coalesce(v_item->>'created_by_email', '')) is distinct from v_actor_email then
      raise exception 'Una operacion no pertenece al lote recibido';
    end if;
    if (v_item->>'operation_index')::integer < 0
       or (v_item->>'operation_index')::integer >= v_operation_count then
      raise exception 'Indice de operacion invalido';
    end if;
    if not exists (
      select 1
      from public.leads_raw lead
      where lead.id = v_item->>'lead_id'
        and lead.ghlid is not distinct from v_item->>'ghlid'
    ) then
      raise exception 'El cliente Supabase de la operacion no coincide con su GHL ID';
    end if;
    if nullif(v_item->>'medio_pago_id', '') is null or not exists (
      select 1 from public.comprobantes_medios_pago_config payment
      where payment.id = (v_item->>'medio_pago_id')::uuid and payment.active
    ) then
      raise exception 'El medio de pago no existe o esta inactivo';
    end if;
    if nullif(v_item->>'responsable_venta_id', '') is null or not exists (
      select 1 from public.comprobantes_responsables_config responsible
      where responsible.id = (v_item->>'responsable_venta_id')::uuid
        and responsible.active
        and lower(responsible.name) = lower(v_item->>'responsable_venta')
        and (
          v_actor_email in ('matirandazzo@gmail.com', 'nadia.cavallini@gmail.com')
          or lower(responsible.email) = v_actor_email
        )
    ) then
      raise exception 'El responsable de venta no existe, esta inactivo o no coincide con el usuario';
    end if;
    if v_item->>'tipo' = 'Venta' and (
      nullif(v_item->>'producto_id', '') is null
      or not exists (
        select 1 from public.comprobantes_productos_config product
        where product.id = (v_item->>'producto_id')::uuid and product.active
      )
      or v_item->>'venta_id' is distinct from v_item->>'id'
      or v_item->>'venta_relacionada' is distinct from v_item->>'id'
      or v_item->>'cobranza_relacionada' is distinct from v_item->>'id'
    ) then
      raise exception 'La venta no tiene relaciones o producto validos';
    end if;
    if v_item->>'tipo' in ('Cobranza', 'Devolucion') and not exists (
      select 1
      from public.comprobantes sale
      where sale.id = v_item->>'venta_id'
        and sale.tipo = 'Venta'
        and sale.ghlid is not distinct from v_item->>'ghlid'
    ) then
      raise exception 'La cobranza o devolucion no corresponde a una venta del mismo cliente';
    end if;
    insert into public.comprobantes
    select *
    from jsonb_populate_record(null::public.comprobantes, v_item);

    insert into public.comprobantes_eventos
      (comprobante_id, batch_id, event_type, actor_email, payload)
    values
      (v_item->>'id', v_batch_id, 'created', v_actor_email, v_item);
  end loop;

  for v_sale_id in
    select distinct nullif(value->>'venta_id', '')
    from jsonb_array_elements(v_rows)
    where nullif(value->>'venta_id', '') is not null
  loop
    perform public.metricas_recalculate_sale_cash_v1(v_sale_id);
  end loop;

  for v_file in select value from jsonb_array_elements(v_files) loop
    if nullif(v_file->>'bucket', '') is null
       or nullif(v_file->>'objectPath', '') is null
       or v_file->>'objectPath' not like v_batch_id::text || '/%' then
      raise exception 'Ruta de archivo invalida para el lote';
    end if;
    select id into v_comprobante_id
    from public.comprobantes
    where batch_id = v_batch_id
      and operation_index = (v_file->>'operationIndex')::integer;
    if v_comprobante_id is null then
      raise exception 'No existe la operacion asociada al archivo';
    end if;
    insert into public.comprobantes_archivos
      (comprobante_id, batch_id, bucket, object_path, original_name, mime_type, size_bytes, sha256)
    values (
      v_comprobante_id,
      v_batch_id,
      v_file->>'bucket',
      v_file->>'objectPath',
      v_file->>'name',
      v_file->>'mimeType',
      (v_file->>'sizeBytes')::bigint,
      v_file->>'sha256'
    );
  end loop;

  update public.comprobantes_submission_batches
  set status = 'completed', completed_at = now()
  where id = v_batch_id;

  return jsonb_build_object(
    'ok', true,
    'idempotentReplay', v_replay,
    'submissionKey', v_submission_key,
    'created', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'type', tipo) order by operation_index)
      from public.comprobantes
      where batch_id = v_batch_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.metricas_update_comprobante_direct_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := nullif(p_payload->>'id', '');
  v_actor_email text := lower(nullif(p_payload->>'actorEmail', ''));
  v_patch jsonb := p_payload->'patch';
  v_previous public.comprobantes%rowtype;
  v_updated public.comprobantes%rowtype;
  v_sale_id text;
begin
  if v_id is null or v_actor_email is null or jsonb_typeof(v_patch) <> 'object' then
    raise exception 'Solicitud de edicion invalida';
  end if;
  select * into v_previous
  from public.comprobantes
  where id = v_id
  for update;
  if not found then
    raise exception 'No existe el comprobante';
  end if;
  if not (
    lower(coalesce(v_previous.created_by_email, '')) = v_actor_email
    or exists (
      select 1
      from public.comprobantes_responsables_config responsible
      where lower(responsible.email) = v_actor_email
        and (
          lower(responsible.name) = lower(coalesce(v_previous.responsable_venta, ''))
          or coalesce(v_previous.info_comprobantes, '') ilike '%Cargado por: ' || responsible.name || '%'
        )
    )
  ) then
    raise exception 'El usuario no puede editar este comprobante';
  end if;
  if lower(coalesce(v_previous.estado, '')) like '%concili%'
     and lower(coalesce(v_previous.estado, '')) not like '%sin concili%'
     and lower(coalesce(v_previous.estado, '')) not like '%rebot%' then
    raise exception 'Un comprobante conciliado no se puede editar';
  end if;

  select * into v_updated
  from jsonb_populate_record(v_previous, v_patch);
  if v_updated.id is distinct from v_previous.id
     or v_updated.tipo is distinct from v_previous.tipo
     or v_updated.ghlid is distinct from v_previous.ghlid
     or v_updated.venta_id is distinct from v_previous.venta_id
     or v_updated.created_by_email is distinct from v_previous.created_by_email then
    raise exception 'La edicion intenta modificar campos protegidos';
  end if;

  update public.comprobantes as updated
  set fecha_de_acreditacion = v_updated.fecha_de_acreditacion,
      f_acreditacion = v_updated.f_acreditacion,
      f_acreditacion_format = v_updated.f_acreditacion_format,
      f_transaccion_string = v_updated.f_transaccion_string,
      acreditado_periodo_m = v_updated.acreditado_periodo_m,
      acreditado_periodo_y = v_updated.acreditado_periodo_y,
      cash_collected = v_updated.cash_collected,
      cash_ar = v_updated.cash_ar,
      cash_collected_ar = v_updated.cash_collected_ar,
      cash_collected_ars = v_updated.cash_collected_ars,
      cash_collected_neto = v_updated.cash_collected_neto,
      cash_collected_neto_ars = v_updated.cash_collected_neto_ars,
      monto_pesos = v_updated.monto_pesos,
      tc = v_updated.tc,
      dni_cuit = v_updated.dni_cuit,
      info_comprobantes = v_updated.info_comprobantes,
      medios_de_pago = v_updated.medios_de_pago,
      medios_de_pago_format = v_updated.medios_de_pago_format,
      medio_pago_id = v_updated.medio_pago_id,
      tipo_banco = v_updated.tipo_banco,
      cheque = v_updated.cheque,
      iva = v_updated.iva,
      comisiones = v_updated.comisiones,
      iva_tasa = v_updated.iva_tasa,
      comision_tasa = v_updated.comision_tasa,
      iva_usd = v_updated.iva_usd,
      comision_usd = v_updated.comision_usd,
      cash_neto_ars_snapshot = v_updated.cash_neto_ars_snapshot,
      cash_neto_usd_snapshot = v_updated.cash_neto_usd_snapshot,
      productos = v_updated.productos,
      producto_id = v_updated.producto_id,
      producto_format = v_updated.producto_format,
      facturacion = v_updated.facturacion,
      facturacion_ars = v_updated.facturacion_ars,
      cantidad_de_pagos = v_updated.cantidad_de_pagos,
      fecha_respaldo = v_updated.fecha_respaldo,
      fecha_correspondiente = v_updated.fecha_correspondiente,
      f_venta = v_updated.f_venta,
      correspondiente_format = v_updated.correspondiente_format,
      fecha_de_venta_format = v_updated.fecha_de_venta_format,
      correspondiente_periodo_m = v_updated.correspondiente_periodo_m,
      correspondiente_periodo_a = v_updated.correspondiente_periodo_a,
      venta_periodo_m = v_updated.venta_periodo_m,
      venta_periodo_a = v_updated.venta_periodo_a
  where id = v_id;

  v_sale_id := case
    when v_previous.tipo = 'Venta' then v_previous.id
    else coalesce(v_previous.venta_id, v_previous.venta_relacionada)
  end;
  if v_sale_id is not null then
    perform public.metricas_recalculate_sale_cash_v1(v_sale_id);
  end if;

  insert into public.comprobantes_eventos
    (comprobante_id, batch_id, event_type, actor_email, payload)
  values (
    v_id,
    v_previous.batch_id,
    'updated',
    v_actor_email,
    jsonb_build_object('before', to_jsonb(v_previous), 'patch', v_patch)
  );
  return jsonb_build_object('ok', true, 'id', v_id, 'updatedAt', now());
end;
$$;

create or replace function public.metricas_delete_comprobante_direct_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := nullif(p_payload->>'id', '');
  v_actor_email text := lower(nullif(p_payload->>'actorEmail', ''));
  v_previous public.comprobantes%rowtype;
  v_sale_id text;
begin
  if v_id is null or v_actor_email is null then
    raise exception 'Solicitud de eliminacion invalida';
  end if;
  select * into v_previous
  from public.comprobantes
  where id = v_id
  for update;
  if not found then
    raise exception 'No existe el comprobante';
  end if;
  if not (
    lower(coalesce(v_previous.created_by_email, '')) = v_actor_email
    or exists (
      select 1
      from public.comprobantes_responsables_config responsible
      where lower(responsible.email) = v_actor_email
        and (
          lower(responsible.name) = lower(coalesce(v_previous.responsable_venta, ''))
          or coalesce(v_previous.info_comprobantes, '') ilike '%Cargado por: ' || responsible.name || '%'
        )
    )
  ) then
    raise exception 'El usuario no puede eliminar este comprobante';
  end if;
  if lower(coalesce(v_previous.estado, '')) like '%concili%'
     and lower(coalesce(v_previous.estado, '')) not like '%sin concili%'
     and lower(coalesce(v_previous.estado, '')) not like '%rebot%' then
    raise exception 'Un comprobante conciliado no se puede eliminar';
  end if;
  if v_previous.tipo = 'Venta' and exists (
    select 1 from public.comprobantes related
    where related.id <> v_id
      and related.deleted_at is null
      and (related.venta_id = v_id or related.venta_relacionada = v_id)
  ) then
    raise exception 'La venta tiene cobranzas o devoluciones relacionadas y no se puede eliminar';
  end if;

  v_sale_id := case
    when v_previous.tipo = 'Venta' then null
    else coalesce(v_previous.venta_id, v_previous.venta_relacionada)
  end;
  insert into public.comprobantes_eventos
    (comprobante_id, batch_id, event_type, actor_email, payload)
  values (v_id, v_previous.batch_id, 'deleted', v_actor_email, to_jsonb(v_previous));
  delete from public.comprobantes where id = v_id;

  if v_sale_id is not null then
    perform public.metricas_recalculate_sale_cash_v1(v_sale_id);
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'deletedAt', now());
end;
$$;

create or replace function public.metricas_enqueue_storage_cleanup_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comprobante_id text := nullif(p_payload->>'comprobanteId', '');
  v_actor_email text := lower(nullif(p_payload->>'actorEmail', ''));
  v_reason text := coalesce(nullif(left(p_payload->>'reason', 100), ''), 'delete_cleanup_failed');
  v_error text := nullif(left(coalesce(p_payload->>'error', ''), 2000), '');
  v_file jsonb;
  v_bucket text;
  v_object_path text;
  v_count integer := 0;
begin
  if jsonb_typeof(coalesce(p_payload->'files', 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_payload->'files') = 0 then
    raise exception 'La cola de limpieza necesita al menos un archivo';
  end if;

  for v_file in select value from jsonb_array_elements(p_payload->'files') loop
    v_bucket := nullif(v_file->>'bucket', '');
    v_object_path := nullif(v_file->>'objectPath', '');
    if v_bucket is null or v_object_path is null then
      raise exception 'Cada archivo pendiente necesita bucket y objectPath';
    end if;

    insert into public.comprobantes_storage_cleanup_queue
      (comprobante_id, bucket, object_path, reason, last_error, requested_by_email, attempts, last_attempt_at)
    values
      (
        coalesce(nullif(v_file->>'comprobanteId', ''), v_comprobante_id),
        v_bucket,
        v_object_path,
        v_reason,
        v_error,
        v_actor_email,
        1,
        now()
      )
    on conflict (bucket, object_path) do update
    set comprobante_id = excluded.comprobante_id,
        reason = excluded.reason,
        last_error = excluded.last_error,
        requested_by_email = excluded.requested_by_email,
        attempts = public.comprobantes_storage_cleanup_queue.attempts + 1,
        last_attempt_at = now(),
        completed_at = null;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'queued', v_count);
end;
$$;

create or replace function public.metricas_update_comprobante_reconciliation_v1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := nullif(p_payload->>'id', '');
  v_actor_email text := lower(nullif(p_payload->>'actorEmail', ''));
  v_state text := nullif(p_payload->>'state', '');
  v_status text := nullif(p_payload->>'status', '');
  v_bounced boolean := coalesce((p_payload->>'bounced')::boolean, false);
  v_previous public.comprobantes%rowtype;
  v_row jsonb;
begin
  if v_id is null or v_actor_email is null or v_state not in ('conciliated', 'not_conciliated', 'bounced') then
    raise exception 'Solicitud de conciliacion invalida';
  end if;
  select * into v_previous
  from public.comprobantes
  where id = v_id
  for update;
  if not found then
    raise exception 'No existe el comprobante';
  end if;
  update public.comprobantes as updated
  set estado = v_status,
      rebotar_pago = v_bounced,
      rectificar_pago = false,
      conciliacion_financiera = case when v_state = 'conciliated' then 'true' else 'false' end,
      conciliacion_financiera_2 = case when v_state = 'conciliated' then 'true' else 'false' end,
      conciliar = case when v_state = 'conciliated' then 'true' else 'false' end
  where id = v_id
  returning to_jsonb(updated.*) into v_row;
  insert into public.comprobantes_eventos
    (comprobante_id, batch_id, event_type, actor_email, payload)
  values (
    v_id,
    v_previous.batch_id,
    'reconciliation_updated',
    v_actor_email,
    jsonb_build_object('before', to_jsonb(v_previous), 'state', v_state)
  );
  return jsonb_build_object('ok', true, 'row', v_row);
end;
$$;

create or replace function public.metricas_finish_storage_cleanup_v1(
  p_id bigint,
  p_success boolean,
  p_error text,
  p_actor_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.comprobantes_storage_cleanup_queue%rowtype;
begin
  if lower(coalesce(p_actor_email, '')) not in ('matirandazzo@gmail.com', 'nadia.cavallini@gmail.com') then
    raise exception 'Usuario no autorizado para operar la cola de Storage';
  end if;
  select * into v_row
  from public.comprobantes_storage_cleanup_queue
  where id = p_id
  for update;
  if not found then
    raise exception 'No existe la tarea de limpieza';
  end if;

  update public.comprobantes_storage_cleanup_queue
  set completed_at = case when p_success then now() else null end,
      last_error = case when p_success then null else nullif(left(coalesce(p_error, ''), 2000), '') end,
      attempts = attempts + case when p_success then 0 else 1 end,
      last_attempt_at = now(),
      requested_by_email = lower(p_actor_email)
  where id = p_id;

  return jsonb_build_object('ok', true, 'id', p_id, 'completed', p_success);
end;
$$;

alter table public.comprobantes_productos_config enable row level security;
alter table public.comprobantes_medios_pago_config enable row level security;
alter table public.comprobantes_responsables_config enable row level security;
alter table public.comprobantes_reglas_config enable row level security;
alter table public.comprobantes_submission_batches enable row level security;
alter table public.comprobantes_archivos enable row level security;
alter table public.comprobantes_storage_cleanup_queue enable row level security;
alter table public.comprobantes_eventos enable row level security;

revoke all on public.comprobantes_productos_config from anon, authenticated;
revoke all on public.comprobantes_medios_pago_config from anon, authenticated;
revoke all on public.comprobantes_responsables_config from anon, authenticated;
revoke all on public.comprobantes_reglas_config from anon, authenticated;
revoke all on public.comprobantes_submission_batches from anon, authenticated;
revoke all on public.comprobantes_archivos from anon, authenticated;
revoke all on public.comprobantes_storage_cleanup_queue from anon, authenticated;
revoke all on public.comprobantes_eventos from anon, authenticated;
revoke all on function public.metricas_save_comprobantes_config_v1(jsonb, text) from public, anon, authenticated;
revoke all on function public.metricas_create_comprobante_batch_v1(jsonb) from public, anon, authenticated;
revoke all on function public.metricas_recalculate_sale_cash_v1(text) from public, anon, authenticated;
revoke all on function public.metricas_update_comprobante_direct_v1(jsonb) from public, anon, authenticated;
revoke all on function public.metricas_delete_comprobante_direct_v1(jsonb) from public, anon, authenticated;
revoke all on function public.metricas_enqueue_storage_cleanup_v1(jsonb) from public, anon, authenticated;
revoke all on function public.metricas_update_comprobante_reconciliation_v1(jsonb) from public, anon, authenticated;
revoke all on function public.metricas_finish_storage_cleanup_v1(bigint, boolean, text, text) from public, anon, authenticated;
grant execute on function public.metricas_save_comprobantes_config_v1(jsonb, text) to service_role;
grant execute on function public.metricas_create_comprobante_batch_v1(jsonb) to service_role;
grant execute on function public.metricas_recalculate_sale_cash_v1(text) to service_role;
grant execute on function public.metricas_update_comprobante_direct_v1(jsonb) to service_role;
grant execute on function public.metricas_delete_comprobante_direct_v1(jsonb) to service_role;
grant execute on function public.metricas_enqueue_storage_cleanup_v1(jsonb) to service_role;
grant execute on function public.metricas_update_comprobante_reconciliation_v1(jsonb) to service_role;
grant execute on function public.metricas_finish_storage_cleanup_v1(bigint, boolean, text, text) to service_role;

notify pgrst, 'reload schema';
