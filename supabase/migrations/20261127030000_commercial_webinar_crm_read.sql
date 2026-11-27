begin;
set local lock_timeout = '5s';

-- Return only the CRM fields needed by the commercial funnel. GoHighLevel
-- bookings are compared in the app, without sending them to Supabase.
create or replace function public.commercial_webinar_crm_read()
returns jsonb language sql stable security invoker
set search_path = pg_catalog, public
set jit = off
set statement_timeout = '30s'
as $function$
select jsonb_build_object(
  'agendas', coalesce((
    select jsonb_agg(a) from (
      select id, nombre, ghlid, origen, closer, fecha_agenda, fecha_llamada,
        llamada_meg, aplica, agendo, webinar_id, attribution_note
      from public.commercial_webinar_leads
      where fecha_agenda is not null
      order by fecha_agenda, id
    ) a
  ), '[]'::jsonb),
  'sales', coalesce((
    select jsonb_agg(s) from (
      select id, cliente_format, ghlid, origen, responsable_venta, creado_por,
        fecha_de_agendamiento, f_venta, producto_format, facturacion
      from public.closer_webinar_receipts
      where origen ~* 'webinar|lanzamiento'
        and fecha_de_agendamiento is not null and lower(btrim(tipo)) = 'venta'
        and public.metricas_is_valid_sale_product(producto_format)
      order by fecha_de_agendamiento, id
    ) s
  ), '[]'::jsonb)
);
$function$;
revoke all on function public.commercial_webinar_crm_read() from public, anon, authenticated;
grant execute on function public.commercial_webinar_crm_read() to service_role;
notify pgrst, 'reload schema';
commit;
