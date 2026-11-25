-- Código fijo de modelo y rubro (TA-8962): si una opción se renombra, el cliente sigue en el mismo rubro.
-- Sólo agrega dos columnas a la tabla del panel (TA-8289); no toca ninguna otra tabla, vista ni trigger.
begin;
alter table public.csm_business_segments add column if not exists modelo_codigo text;
alter table public.csm_business_segments add column if not exists rubro_codigo text;
create index if not exists csm_business_segments_rubro_codigo_idx on public.csm_business_segments (rubro_codigo);
notify pgrst, 'reload schema';
commit;
