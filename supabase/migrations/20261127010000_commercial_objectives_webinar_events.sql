begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Keep the existing monthly reports and CRM data intact. Only this page uses these projections.
create or replace function public.commercial_webinar_id(source text)
returns text language sql immutable set search_path=pg_catalog as $$
 select case
 when source ~* 'webinar[^0-9]*26[/ -]11' then 'webinar-2'
 when source ~* 'webinar[^0-9]*28[/ -]10' then 'webinar-1'
 end;
$$;
create or replace view public.commercial_webinar_leads as
select l.*, coalesce(
 public.commercial_webinar_id(l.origen_actual),
 public.commercial_webinar_id(l.ultimo_origen),
 public.commercial_webinar_id(l.origen),
 public.commercial_webinar_id(l.primer_origen),
 'unassigned') as webinar_id
from public.closer_webinar_leads l
where l.origen ~* 'webinar|lanzamiento';
create or replace view public.commercial_webinar_receipts as
select c.*,coalesce(public.commercial_webinar_id(c.origen),a.webinar_id,'unassigned') as webinar_id
from public.closer_webinar_receipts c
left join lateral (
 select case when count(distinct l.webinar_id)=1 then min(l.webinar_id) end as webinar_id
 from public.commercial_webinar_leads l
 where l.ghlid=c.ghlid and nullif(btrim(c.ghlid),'') is not null
 and l.fecha_agenda::date=(c.fecha_de_agendamiento at time zone 'America/Argentina/Buenos_Aires')::date
) a on true
where c.origen ~* 'webinar|lanzamiento';
create or replace view public.commercial_webinar_summary as
with records as (
 select extract(year from fecha_agenda)::int anio,extract(month from fecha_agenda)::int mes,
 webinar_id,public.metricas_normalize_closer_name(closer) closer,
 count(*) filter(where aplica='Aplica') total_aplica,
 count(*) filter(where agendo='Agendo' and aplica='Aplica' and llamada_meg='Efectuada') total_efectuadas,
 0::bigint total_ventas,0::numeric facturacion_f_agenda
 from public.commercial_webinar_leads where fecha_agenda is not null
 group by 1,2,3,4
 union all
 select extract(year from fecha_de_agendamiento)::int,extract(month from fecha_de_agendamiento)::int,
 webinar_id,public.metricas_comprobante_closer_name(responsable_venta,creado_por),
 0,0,count(*),coalesce(sum(facturacion),0)
 from public.commercial_webinar_receipts
 where fecha_de_agendamiento is not null and lower(btrim(tipo))='venta'
 and public.metricas_is_valid_sale_product(producto_format)
 group by 1,2,3,4
)
select anio,mes,'Webinar'::text origen,webinar_id,closer,
sum(total_aplica) total_aplica,sum(total_efectuadas) total_efectuadas,
sum(total_ventas) total_ventas,sum(facturacion_f_agenda) facturacion_f_agenda
from records group by 1,2,3,4,5;
revoke all on public.commercial_webinar_leads,public.commercial_webinar_receipts,public.commercial_webinar_summary from public,anon,authenticated;
grant select on public.commercial_webinar_leads,public.commercial_webinar_receipts,public.commercial_webinar_summary to service_role;
revoke all on function public.commercial_webinar_id(text) from public,anon,authenticated;
grant execute on function public.commercial_webinar_id(text) to service_role;
notify pgrst,'reload schema';
commit;
