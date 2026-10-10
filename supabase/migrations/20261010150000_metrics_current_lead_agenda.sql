-- Current lead agenda for metrics; immutable receipt dates remain on the original ledger.
begin;
set local lock_timeout='5s';
do $$
declare cols text;definition text;
begin
 select string_agg(case
  when attname='fecha_de_agendamiento' then format('coalesce((a.fecha::date::timestamp at time zone ''America/Argentina/Buenos_Aires'')::%s,c.%I) as %I',format_type(atttypid,atttypmod),attname,attname)
  when attname='agenda_format' then format('case when a.fecha is not null then to_char(a.fecha,''DD/MM/YYYY'')::%s else c.%I end as %I',format_type(atttypid,atttypmod),attname,attname)
  when attname='agenda_periodo_m' then format('case when a.fecha is not null then extract(month from a.fecha)::%s else c.%I end as %I',format_type(atttypid,atttypmod),attname,attname)
  when attname='agenda_periodo_a' then format('case when a.fecha is not null then extract(year from a.fecha)::%s else c.%I end as %I',format_type(atttypid,atttypmod),attname,attname)
  else format('c.%I',attname) end, ', ' order by attnum) into cols
 from pg_attribute where attrelid='public.comprobantes'::regclass and attnum>0 and not attisdropped;
 execute 'create or replace view public.comprobantes_agenda_metricas with (security_invoker=true) as select '||cols||$view$
 from public.comprobantes c
 left join public.comprobantes s on s.id=c.venta_relacionada and s.tipo='Venta'
  and (nullif(c.ghlid,'') is null or nullif(s.ghlid,'') is null or c.ghlid=s.ghlid)
 left join lateral (
  select coalesce(nullif(c.ghlid,''),nullif(s.ghlid,'')) as ghlid,coalesce(nullif(c.cliente,''),nullif(s.cliente,'')) as cliente
 ) identity on true
 left join lateral (
  select case when count(*)=1 then min(l.fecha_agenda) end as fecha
  from public.leads_raw l where l.ghlid=identity.ghlid
 ) unique_lead on true
 left join public.leads_raw linked_lead on linked_lead.id=identity.cliente
  and (identity.ghlid is null or linked_lead.ghlid=identity.ghlid)
 left join lateral (select coalesce(unique_lead.fecha,linked_lead.fecha_agenda) as fecha) a on true
 $view$;
 -- Existing metric views already consume this cash source. Preserve its cash/state rules.
 definition:=pg_get_viewdef('public.comprobantes_cash_metricas'::regclass,true);
 if definition ~ '\mcomprobantes\M' then
  definition:=regexp_replace(definition,'\mcomprobantes\M','comprobantes_agenda_metricas','g');
  execute 'create or replace view public.comprobantes_cash_metricas with (security_invoker=true) as '||definition;
 elsif definition !~ '\mcomprobantes_agenda_metricas\M' then
  raise exception 'Fuente de cash inesperada';
 end if;
end;$$;
revoke all on public.comprobantes_agenda_metricas from public,anon,authenticated;
grant select on public.comprobantes_agenda_metricas to service_role;
comment on view public.comprobantes_agenda_metricas is 'Agenda actual de leads_raw para métricas; GHL ID único o relación explícita compatible, incluyendo cobranzas por venta. Sin fecha/vínculo fiable conserva la agenda histórica. No modifica fechas de venta ni acreditación.';
notify pgrst,'reload schema';
commit;
