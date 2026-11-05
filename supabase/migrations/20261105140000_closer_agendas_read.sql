BEGIN;
SET LOCAL lock_timeout = '3s';
-- Avoid JIT compilation overhead on the live attribution view. This setting
-- applies only to this read, without changing global database settings.
CREATE OR REPLACE FUNCTION public.closer_agendas_read()
RETURNS SETOF public.agenda_detalle_por_origen_closer
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
SET statement_timeout = '30s'
SET jit = off
AS $function$
  SELECT * FROM public.agenda_detalle_por_origen_closer;
$function$;
REVOKE ALL ON FUNCTION public.closer_agendas_read() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.closer_agendas_read() TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
