-- Read-only projection. No money, emails, phones, document URLs or payment notes.
begin;
create or replace view public.mati_world_sources as
with lead_keys as (
 select l.id,l.ghlid,l.nombre,l.closer,l.setter,l.fecha_agenda,l.fecha_llamada,l.llamada_meg,l.last_edited_time,l.origen_actual,coalesce(nullif(l.ghlid,''),'lead:'||l.id) as person_key from public.leads_raw l
), leads as (
 select distinct on(person_key) person_key,id,ghlid,nombre,closer,setter,fecha_agenda,fecha_llamada,llamada_meg,last_edited_time,origen_actual
 from lead_keys order by person_key,last_edited_time desc nulls last,id
), clients as (
 select distinct on(coalesce(nullif(c.ghlid,''),l.person_key,'csm:'||c.id))
 coalesce(nullif(c.ghlid,''),l.person_key,'csm:'||c.id) person_key,c.id,c.ghlid,c.nombre,c.acceso,c.contrato,c.onboarding,c.f_onboarding,c.f_acceso,c.fecha_final,c.pausa,c.abandono,c.despedida,c.updated_at,c.closer
 from public.csm c left join lead_keys l on l.id=c.crm_2_0
 order by coalesce(nullif(c.ghlid,''),l.person_key,'csm:'||c.id),c.updated_at desc nulls last,c.id
), receipts as (
 select coalesce(nullif(c.ghlid,''),l.person_key,'receipt:'||c.id) person_key,
 jsonb_agg(jsonb_build_object('id',c.id,'tipo',c.tipo,'product',c.producto_format,'estado',c.estado,'rebotar_pago',c.rebotar_pago,'saleDate',c.f_venta,'createdAt',c.fecha_creado,'closer',c.responsable_venta) order by c.f_venta desc nulls last,c.id) items,
 max(c.cliente_format) nombre
 from public.comprobantes c left join lead_keys l on l.id=c.cliente group by 1
), keys as (
 select person_key from leads where fecha_agenda >= (current_date-30) or fecha_llamada >= (current_date-30)::text
 union select person_key from clients where lower(acceso)='acceso' or lower(contrato)='pendiente' or lower(onboarding)='pendiente'
 union select person_key from receipts where exists (
   select 1 from jsonb_array_elements(items) item
   where lower(coalesce(item->>'estado','')) <> 'conciliado'
      or item->>'rebotar_pago'='true'
      or (lower(item->>'tipo')='venta' and item->>'saleDate' >= (current_date-90)::text)
 )
), ghl as materialized (
 select g.ghlid,g.fields->'calendar'->'value' as calendar,g.fields->'Webinar 28/10 Setter'->>'value' as webinar_setter,g.updated_at
 from public.leads_ghl_contacts g join keys k on k.person_key=g.ghlid
), diagnostics as (
 select distinct on(client_ghlid) client_ghlid,coalesce(nullif(data->'checkpoints'->'inicial'->>'csm',''),csm_name) ccm
 from public.csm_diagnosticos where client_ghlid is not null order by client_ghlid,updated_at desc nulls last,id
)
select k.person_key as id,coalesce(nullif(l.ghlid,''),nullif(c.ghlid,''),case when k.person_key not like '%:%' then k.person_key end) ghlid,
 coalesce(nullif(l.nombre,''),nullif(c.nombre,''),r.nombre,'Sin nombre') name,
 l.closer,l.setter,l.fecha_agenda,l.fecha_llamada,l.llamada_meg,
 c.id as csm_id,c.acceso,c.contrato,c.onboarding,c.f_onboarding,c.f_acceso,c.fecha_final,c.pausa,c.abandono,c.despedida,
 p.support_active,d.ccm,
 coalesce(r.items,'[]'::jsonb) receipts,
 g.calendar->>'calendarName' as calendar_name,
 g.calendar->>'startTime' as appointment_start,
 g.calendar->>'endTime' as appointment_end,
 coalesce(g.calendar->>'appointmentStatus',g.calendar->>'appoinmentStatus') as appointment_status,
 g.calendar->>'selectedTimezone' as appointment_timezone,
 coalesce(g.calendar->>'date_created',g.calendar->>'createdAt') as appointment_created,
 g.webinar_setter,
 greatest(g.updated_at,c.updated_at,l.last_edited_time::timestamptz) as source_updated_at,l.origen_actual
from keys k left join leads l on l.person_key=k.person_key left join clients c on c.person_key=k.person_key
left join receipts r on r.person_key=k.person_key
left join ghl g on g.ghlid=k.person_key
left join public.csm_followup_profiles p on p.ghlid=k.person_key
left join diagnostics d on d.client_ghlid=k.person_key;
revoke all on public.mati_world_sources from public,anon,authenticated;
grant select on public.mati_world_sources to service_role;
notify pgrst,'reload schema';
commit;
