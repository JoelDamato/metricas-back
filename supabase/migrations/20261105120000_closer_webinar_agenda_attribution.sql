begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
set local jit=off;
-- Read-only projection: never rewrites CRM origins, appointments or commission data.
create or replace view public.closer_webinar_contacts as
with eligible as materialized (
 select ghlid,origen,origen_actual,primer_origen,fecha_agenda,fecha_llamada
 from public.leads_raw l
 where coalesce(l.fecha_agenda,l.fecha_llamada::timestamp)>=DATE '2026-10-01'
 and nullif(btrim(l.ghlid),'') is not null
 and public.metricas_normalize_closer_name(l.closer) in ('Carlos Tu','Claudio Nicolini','Mauro Gaitan','Patricia Conti','Walter Alegre','Pablo Butera')
 and coalesce(l.calendario_agendado,'') !~* 'csm|onboarding|cashflow|seguimiento'
), assigned as materialized (
 select distinct e.ghlid from eligible e join public.leads_ghl_contacts g on g.ghlid=e.ghlid
 where exists(select 1 from jsonb_each(coalesce(g.fields,'{}')) f
 where coalesce(f.value->>'label',f.key) ~* 'webinar.*(setter|setting)|(setter|setting).*webinar'
 and coalesce(f.value->>'label',f.key) !~* 'turno|whatsapp|asesor|telefono'
 and coalesce(f.value->>'value','') not in ('','null','[]'))
), evidence as (
 select l.ghlid,
 bool_or(concat_ws(' ',l.origen,l.origen_actual,l.primer_origen) ilike '%webinar%' or a.ghlid is not null) as webinar,
 case when count(distinct coalesce(l.fecha_agenda,l.fecha_llamada::timestamp))=1
 then min(coalesce(l.fecha_agenda,l.fecha_llamada::timestamp)) end as agenda_date
 from eligible l left join assigned a on a.ghlid=l.ghlid group by l.ghlid
)
select * from evidence where webinar;

do $migration$
declare columns_sql text; definition text; base_definition text;
begin
 if to_regclass('public.closer_detail_legacy_202609') is not null then raise exception 'Migration already applied'; end if;
 execute 'create view public.closer_detail_legacy_202609 as '||pg_get_viewdef('public.agenda_detalle_por_origen_closer'::regclass,true);
 select string_agg(case
 when attname='origen' then 'case when w.agenda_date >= DATE ''2026-10-01'' then ''Webinar'' else l.origen end as origen'
 when attname='fecha_agenda' then 'case when w.agenda_date >= DATE ''2026-10-01'' then coalesce(l.fecha_agenda,l.fecha_llamada::timestamp) else l.fecha_agenda end as fecha_agenda'
 when attname='agendo' then 'case when w.agenda_date >= DATE ''2026-10-01'' and l.fecha_llamada is not null and nullif(btrim(l.agendo),'''') is null then ''Agendo'' else l.agendo end as agendo'
 else format('l.%I',attname) end,', ' order by attnum) into columns_sql
 from pg_attribute where attrelid='public.leads_raw'::regclass and attnum>0 and not attisdropped;
 -- Fallback is restricted to a commercial closer and excludes explicit CSM calendars.
 execute 'create view public.closer_webinar_leads as select '||columns_sql||' from public.leads_raw l left join public.closer_webinar_contacts w on w.ghlid=l.ghlid
 and public.metricas_normalize_closer_name(l.closer) in (''Carlos Tu'',''Claudio Nicolini'',''Mauro Gaitan'',''Patricia Conti'',''Walter Alegre'',''Pablo Butera'')
 and coalesce(l.calendario_agendado,'''') !~* ''csm|onboarding|cashflow|seguimiento''';
 select string_agg(case
 when attname='origen' then 'case when w.agenda_date >= DATE ''2026-10-01'' then ''Webinar'' else c.origen end as origen'
 when attname='fecha_de_agendamiento' then 'case when w.agenda_date >= DATE ''2026-10-01'' then coalesce(c.fecha_de_agendamiento,w.agenda_date AT TIME ZONE ''UTC'') else c.fecha_de_agendamiento end as fecha_de_agendamiento'
 else format('c.%I',attname) end,', ' order by attnum) into columns_sql
 from pg_attribute where attrelid='public.comprobantes_cash_metricas'::regclass and attnum>0 and not attisdropped;
 execute 'create view public.closer_webinar_receipts as select '||columns_sql||' from public.comprobantes_cash_metricas c left join public.closer_webinar_contacts w on w.ghlid=c.ghlid';
 definition:=pg_get_viewdef('public.agenda_detalle_por_origen_closer_base'::regclass,true);
 definition:=replace(replace(definition,'leads_raw','closer_webinar_leads'),'comprobantes_cash_metricas','closer_webinar_receipts');
 base_definition:=rtrim(definition,'; ');
 execute 'create view public.closer_webinar_base as WITH closer_webinar_leads AS MATERIALIZED (select agendo,aplica,call_confirm,cc_whatsapp,confirmo_mensaje,fecha_agenda,ghlid,llamada_cc,llamada_meg,origen,closer,respondio_apertura from public.closer_webinar_leads), closer_webinar_receipts AS MATERIALIZED (select estado_cc,tipo,producto_format,fecha_de_agendamiento,f_venta,f_acreditacion,origen,creado_por,responsable_venta,ghlid,facturacion,cash_collected_neto,cash_collected from public.closer_webinar_receipts) '||definition;
 definition:=pg_get_viewdef('public.agenda_detalle_por_origen_closer'::regclass,true);
 definition:=replace(replace(replace(definition,'agenda_detalle_por_origen_closer_base','closer_webinar_base'),'leads_raw','closer_webinar_leads'),'comprobantes_cash_metricas','closer_webinar_receipts');
 definition:=regexp_replace(definition,'^\s*WITH\s+','');
 execute 'create view public.closer_webinar_detail as WITH closer_webinar_leads AS MATERIALIZED (select agendo,aplica,call_confirm,cc_whatsapp,confirmo_mensaje,fecha_agenda,ghlid,llamada_cc,llamada_meg,origen,closer,respondio_apertura from public.closer_webinar_leads), closer_webinar_receipts AS MATERIALIZED (select estado_cc,tipo,producto_format,fecha_de_agendamiento,f_venta,f_acreditacion,origen,creado_por,responsable_venta,ghlid,facturacion,cash_collected_neto,cash_collected from public.closer_webinar_receipts), closer_webinar_base AS MATERIALIZED ('||base_definition||'), '||definition;
 execute 'create or replace view public.agenda_detalle_por_origen_closer as
 select * from public.closer_detail_legacy_202609 where anio<2026 or (anio=2026 and mes<10)
 union all
 select * from public.closer_webinar_detail where anio>2026 or (anio=2026 and mes>=10)';
end $migration$;
revoke all on public.closer_webinar_contacts,public.closer_webinar_leads,public.closer_webinar_receipts,public.closer_webinar_base,public.closer_webinar_detail,public.closer_detail_legacy_202609 from public,anon,authenticated;
grant select on public.closer_webinar_contacts,public.closer_webinar_leads,public.closer_webinar_receipts,public.closer_webinar_base,public.closer_webinar_detail,public.closer_detail_legacy_202609 to service_role;
notify pgrst,'reload schema';
commit;
