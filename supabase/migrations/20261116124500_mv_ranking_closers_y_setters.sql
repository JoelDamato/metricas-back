-- Copias materializadas de las dos vistas más lentas de la central (~3 s cada una).
-- El backend (listRows) las sirve en lugar de la vista; pg_cron las refresca cada 10 min.
-- Aplicado en producción el 16-11-2026 con el ok de Joel. Para volver atrás: borrar el
-- mapeo MATERIALIZED_VIEWS en supabase.service.js (las vistas originales siguen intactas).
create materialized view public.mv_ranking_closers_mensual as select * from public.ranking_closers_mensual;
create materialized view public.mv_setters as select * from public.setters;
revoke all on public.mv_ranking_closers_mensual, public.mv_setters from anon, authenticated;
grant select on public.mv_ranking_closers_mensual, public.mv_setters to service_role;
create unique index mv_ranking_closers_mensual_uk on public.mv_ranking_closers_mensual (anio, mes, closer) nulls not distinct;
create unique index mv_setters_uk on public.mv_setters (anio, mes, setter) nulls not distinct;
create extension if not exists pg_cron;
select cron.schedule('refresh-mv-metricas', '*/10 * * * *',
  $$refresh materialized view concurrently public.mv_ranking_closers_mensual; refresh materialized view concurrently public.mv_setters;$$);
