begin;
set local statement_timeout='120s';
drop view if exists public.csm_followup_profiles;
create table if not exists public.csm_followup_profiles (
 ghlid text primary key, fecha_inicio_estimada text, fecha_inicio_renovacion text, rubro text
);
alter table public.csm_followup_profiles enable row level security;
revoke all on public.csm_followup_profiles from public,anon,authenticated;
grant select on public.csm_followup_profiles to service_role;
create or replace function public.metricas_refresh_csm_followup_profile() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare payload jsonb;
begin
 payload:=case when jsonb_typeof(new.latest_payload->'data')='object' then new.latest_payload->'data' else new.latest_payload end;
 payload:=coalesce(payload->'contact','{}'::jsonb)||payload||coalesce(payload->'customData','{}'::jsonb);
 insert into csm_followup_profiles(ghlid,fecha_inicio_estimada,fecha_inicio_renovacion,rubro)
 values(new.ghlid,nullif(payload->>'Fecha de inicio estimado',''),nullif(payload->>'F. inicio renovacion',''),coalesce(nullif(payload->>'Rubro',''),nullif(payload->>'rubro','')))
 on conflict(ghlid) do update set
 fecha_inicio_estimada=coalesce(excluded.fecha_inicio_estimada,csm_followup_profiles.fecha_inicio_estimada),
 fecha_inicio_renovacion=coalesce(excluded.fecha_inicio_renovacion,csm_followup_profiles.fecha_inicio_renovacion),
 rubro=coalesce(excluded.rubro,csm_followup_profiles.rubro);
 return new;
end;$$;
revoke all on function public.metricas_refresh_csm_followup_profile() from public,anon,authenticated;
drop trigger if exists csm_followup_profile_refresh on public.csm_ghl_contacts;
create trigger csm_followup_profile_refresh after insert or update of latest_payload on public.csm_ghl_contacts for each row execute function public.metricas_refresh_csm_followup_profile();
insert into csm_followup_profiles(ghlid,fecha_inicio_estimada,fecha_inicio_renovacion,rubro)
select ghlid,nullif(latest_payload->>'Fecha de inicio estimado',''),nullif(latest_payload->>'F. inicio renovacion',''),coalesce(nullif(latest_payload->>'Rubro',''),nullif(latest_payload->>'rubro','')) from csm_ghl_contacts
on conflict(ghlid) do nothing;
notify pgrst,'reload schema';
commit;
