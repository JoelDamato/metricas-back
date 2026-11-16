-- Copia materializada de agenda_detalle_por_origen_closer (pantalla Agendas, ~8,5 s por consulta).
-- El backend (listRows) la sirve en lugar de la vista; se suma al refresco de pg_cron cada 10 min.
-- Aplicado en producción el 16-11-2026 con el ok de Joel. Para volver atrás: sacar la entrada
-- del mapeo MATERIALIZED_VIEWS en supabase.service.js (la vista original sigue intacta).
create materialized view public.mv_agenda_detalle_por_origen_closer as select * from public.agenda_detalle_por_origen_closer;
revoke all on public.mv_agenda_detalle_por_origen_closer from anon, authenticated;
grant select on public.mv_agenda_detalle_por_origen_closer to service_role;
create unique index mv_agenda_detalle_por_origen_closer_uk on public.mv_agenda_detalle_por_origen_closer (anio, mes, origen, closer) nulls not distinct;
create index mv_agenda_detalle_anio on public.mv_agenda_detalle_por_origen_closer (anio);
select cron.alter_job(jobid, command => $$refresh materialized view concurrently public.mv_ranking_closers_mensual; refresh materialized view concurrently public.mv_setters; refresh materialized view concurrently public.mv_agenda_detalle_por_origen_closer;$$)
  from cron.job where jobname = 'refresh-mv-metricas';
