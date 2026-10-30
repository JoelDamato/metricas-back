BEGIN;
SET LOCAL lock_timeout = '3s';
-- PostgREST hoists this function's timeout for this read only. Keep the global
-- authenticator limit unchanged. No snapshot: the existing view stays live.
CREATE OR REPLACE FUNCTION public.agenda_totales_read()
RETURNS SETOF public.agenda_totales
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
SET statement_timeout = '30s'
AS $function$
  SELECT * FROM public.agenda_totales;
$function$;
REVOKE ALL ON FUNCTION public.agenda_totales_read() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_totales_read() TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
