begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- A contact's first source is not reliable evidence for a new appointment.
-- Keep ambiguous rows visible, without editing CRM history or other dashboards.
create or replace view public.commercial_webinar_leads as
select l.*,coalesce(
 case when l.nombre ~* 'prueba.*no contactar' then null
 else coalesce(
 public.commercial_webinar_id(l.origen_actual),
 public.commercial_webinar_id(l.ultimo_origen),
 public.commercial_webinar_id(l.origen),
 case
 when public.commercial_webinar_id(l.primer_origen)='webinar-1'
 and greatest(l.fecha_agenda::date,l.fecha_llamada::date)>=date '2026-11-26' then null
 when public.commercial_webinar_id(l.primer_origen)='webinar-2'
 and greatest(l.fecha_agenda::date,l.fecha_llamada::date)<date '2026-11-26' then null
 else public.commercial_webinar_id(l.primer_origen) end) end,'unassigned') as webinar_id,
 case
 when l.nombre ~* 'prueba.*no contactar' then 'Registro de prueba: no atribuido a un lanzamiento.'
 when public.commercial_webinar_id(l.origen_actual) is not null
 or public.commercial_webinar_id(l.ultimo_origen) is not null
 or public.commercial_webinar_id(l.origen) is not null then 'Origen explícito del evento en el CRM.'
 when public.commercial_webinar_id(l.primer_origen)='webinar-1'
 and greatest(l.fecha_agenda::date,l.fecha_llamada::date)>=date '2026-11-26'
 then 'Primer origen del Webinar 1, con una cita posterior al segundo evento. Requiere verificar la reserva.'
 when public.commercial_webinar_id(l.primer_origen)='webinar-2'
 and greatest(l.fecha_agenda::date,l.fecha_llamada::date)<date '2026-11-26'
 then 'Primer origen del Webinar 2, con una cita anterior al evento. Requiere verificar la reserva.'
 when public.commercial_webinar_id(l.primer_origen) is not null then 'Atribuido por primer origen explícito; no equivale a una reserva confirmada del vivo.'
 else 'Sin etiqueta explícita de lanzamiento en los orígenes del CRM.' end as attribution_note
from public.closer_webinar_leads l
where l.origen ~* 'webinar|lanzamiento';

-- Exact sale predicate shared by the funnel and its drilldown.
create or replace view public.commercial_objectives_sales as
select c.*,w.webinar_id
from public.closer_webinar_receipts c
left join public.commercial_webinar_receipts w on w.id=c.id
where c.fecha_de_agendamiento is not null and lower(btrim(c.tipo))='venta'
and public.metricas_is_valid_sale_product(c.producto_format);
revoke all on public.commercial_objectives_sales from public,anon,authenticated;
grant select on public.commercial_objectives_sales to service_role;
notify pgrst,'reload schema';
commit;
