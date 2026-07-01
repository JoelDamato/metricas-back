alter table if exists public.comprobantes
add column if not exists cash_collected_ar numeric;

update public.comprobantes
set cash_collected_ar = cash_collected_ars
where cash_collected_ar is null
  and cash_collected_ars is not null;

notify pgrst, 'reload schema';
