alter table if exists public.comprobantes
  add column if not exists iva numeric,
  add column if not exists comisiones numeric;
