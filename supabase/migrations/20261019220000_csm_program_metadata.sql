begin;
set local statement_timeout='120s';
alter table public.csm_followup_profiles add column if not exists support_active text;
alter table public.csm_followup_profiles add column if not exists support text;
create or replace function public.metricas_refresh_csm_followup_profile() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare payload jsonb;
begin
 payload:=coalesce(new.fields,'{}'::jsonb);
 insert into csm_followup_profiles(ghlid,fecha_inicio_estimada,fecha_inicio_renovacion,rubro,support_active,support)
 values(new.ghlid,nullif(payload->>'Fecha de inicio estimado',''),nullif(payload->>'F. inicio renovacion',''),
 coalesce(nullif(payload->>'Breve descripción de tu modelo de negocio',''),nullif(payload->>'Rubro',''),nullif(payload->>'rubro','')),
 nullif(payload->>'Soporte activo',''),nullif(payload->>'Soporte',''))
 on conflict(ghlid) do update set
 fecha_inicio_estimada=coalesce(excluded.fecha_inicio_estimada,csm_followup_profiles.fecha_inicio_estimada),
 fecha_inicio_renovacion=coalesce(excluded.fecha_inicio_renovacion,csm_followup_profiles.fecha_inicio_renovacion),
 rubro=coalesce(excluded.rubro,csm_followup_profiles.rubro),
 support_active=excluded.support_active,support=excluded.support;
 return new;
end;$$;
drop trigger if exists csm_followup_profile_refresh on public.csm_ghl_contacts;
create trigger csm_followup_profile_refresh after insert or update of fields,latest_payload on public.csm_ghl_contacts
for each row execute function public.metricas_refresh_csm_followup_profile();
insert into csm_followup_profiles(ghlid,rubro,support_active,support)
select ghlid,coalesce(nullif(fields->>'Breve descripción de tu modelo de negocio',''),nullif(fields->>'Rubro',''),nullif(fields->>'rubro','')),
nullif(fields->>'Soporte activo',''),nullif(fields->>'Soporte','') from csm_ghl_contacts
on conflict(ghlid) do update set rubro=coalesce(excluded.rubro,csm_followup_profiles.rubro),support_active=excluded.support_active,support=excluded.support;
notify pgrst,'reload schema';
commit;
