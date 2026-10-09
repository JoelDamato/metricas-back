begin;
create or replace function public.marketing_origin_options()
returns table(origen_actual text) language sql stable security definer set search_path=public,pg_temp as $$
 select distinct btrim(l.origen_actual) from public.leads_raw l where nullif(btrim(l.origen_actual),'') is not null order by 1;
$$;
revoke all on function public.marketing_origin_options() from public,anon,authenticated;
grant execute on function public.marketing_origin_options() to service_role;
commit;
