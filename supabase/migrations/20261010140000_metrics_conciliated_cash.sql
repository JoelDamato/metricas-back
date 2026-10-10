-- Only reconciled receipts contribute cash to metrics. Keep sales and raw receipts intact.
begin;
set local lock_timeout='5s';
do $$
declare cols text;target text;definition text;
begin
 select string_agg(case when attname=any(array['cash_collected','cash_ar','cash_collected_ar','cash_collected_ars','cash_collected_neto','cash_collected_neto_ars'])
  then format('case when lower(btrim(coalesce(c.estado, ''''))) = ''conciliado'' and lower(coalesce(c.rebotar_pago::text, ''false'')) not in (''true'',''1'') then c.%I else 0 end as %I',attname,attname)
  else format('c.%I',attname) end, ', ' order by attnum) into cols
 from pg_attribute where attrelid='public.comprobantes'::regclass and attnum>0 and not attisdropped;
 execute 'create or replace view public.comprobantes_cash_metricas with (security_invoker=true) as select '||cols||' from public.comprobantes c';
 -- Preserve all existing grouping, dates, filters and sales counts. Replace only the cash source.
 foreach target in array array['agenda_detalle_diario_closer','agenda_detalle_por_origen_closer','agenda_detalle_por_origen_closer_base','agenda_totales','agenda_totales_base','agenda_totales_ultimo_origen','cash_collected_diario_closer','dashboard_totales','kpi_closers_mensual','kpi_marketing_diario','ranking_closers_mensual'] loop
  definition:=pg_get_viewdef(format('public.%I',target)::regclass,true);
  if definition ~ '\mcomprobantes\M' then
   definition:=regexp_replace(definition,'\mcomprobantes\M','comprobantes_cash_metricas','g');
   execute format('create or replace view public.%I as %s',target,definition);
  elsif definition !~ '\mcomprobantes_cash_metricas\M' then
   raise exception 'La vista % no tiene la fuente de comprobantes esperada',target;
  end if;
 end loop;
end;$$;
revoke all on public.comprobantes_cash_metricas from public,anon,authenticated;
grant select on public.comprobantes_cash_metricas to service_role;
comment on view public.comprobantes_cash_metricas is 'Fuente interna de métricas: conserva ventas, fechas y atributos; cash individual cero mientras no esté conciliado. No modifica comprobantes ni sus saldos acumulados.';
notify pgrst,'reload schema';
commit;
