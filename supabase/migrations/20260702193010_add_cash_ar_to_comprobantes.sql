alter table if exists public.comprobantes
add column if not exists cash_ar numeric;

comment on column public.comprobantes.cash_ar
is 'Cash en pesos cargado por vendedores desde la propiedad Cash AR de Notion.';

update public.comprobantes
set cash_ar = cash_collected_ar
where cash_ar is null
  and cash_collected_ar is not null;

update public.comprobantes
set cash_ar = cash_collected_ars
where cash_ar is null
  and cash_collected_ars is not null;

update public.comprobantes
set cash_collected_ar = cash_ar
where cash_collected_ar is null
  and cash_ar is not null;

notify pgrst, 'reload schema';
