begin;
-- Read-time attribution preserves the original CRM fields and follows subsequent webinar changes.
create or replace function public.metricas_webinar_setter(fields jsonb) returns text
language sql immutable parallel safe set search_path=public as $$
 with names as (
   select distinct case when lower(trim(v.name #>> '{}')) in ('nahuel','nahue','nahuel iasci') then 'Nahuel Iasci' else trim(v.name #>> '{}') end as name
   from jsonb_each(coalesce(fields,'{}'::jsonb)) f
   cross join lateral jsonb_array_elements(case when jsonb_typeof(f.value->'value')='array' then f.value->'value' else jsonb_build_array(f.value->'value') end) v(name)
   where lower(coalesce(f.value->>'label',f.key)) like '%webinar%'
     and lower(coalesce(f.value->>'label',f.key)) ~ '(setter|setting)'
     and lower(coalesce(f.value->>'label',f.key)) !~ '(turno|whatsapp|asesor|telefono)'
     and jsonb_typeof(v.name)='string' and trim(v.name #>> '{}')<>''
 ) select case when count(*)=0 then null when count(distinct lower(name))=1 then min(name) else '' end from names;
$$;
revoke all on function public.metricas_webinar_setter(jsonb) from public,anon,authenticated;
grant execute on function public.metricas_webinar_setter(jsonb) to service_role;

create table if not exists public.webinar_setter_attribution (
 ghlid text primary key references public.leads_ghl_contacts(ghlid) on delete cascade,
 setter text not null
);
alter table public.webinar_setter_attribution enable row level security;
revoke all on public.webinar_setter_attribution from public,anon,authenticated;
grant select on public.webinar_setter_attribution to service_role;
create or replace function public.refresh_webinar_setter_attribution() returns trigger
language plpgsql security definer set search_path=public as $$
declare assigned text; begin
 assigned:=public.metricas_webinar_setter(new.fields);
 if assigned is null then delete from public.webinar_setter_attribution where ghlid=new.ghlid;
 else insert into public.webinar_setter_attribution(ghlid,setter) values(new.ghlid,assigned)
 on conflict(ghlid) do update set setter=excluded.setter; end if;
 return new;
end $$;
revoke all on function public.refresh_webinar_setter_attribution() from public,anon,authenticated;
drop trigger if exists webinar_setter_attribution_refresh on public.leads_ghl_contacts;
create trigger webinar_setter_attribution_refresh after insert or update of fields on public.leads_ghl_contacts
 for each row execute function public.refresh_webinar_setter_attribution();
insert into public.webinar_setter_attribution(ghlid,setter)
 select ghlid,assigned from (select ghlid,public.metricas_webinar_setter(fields) assigned from public.leads_ghl_contacts where fields::text ilike '%webinar%') s
 where assigned is not null on conflict(ghlid) do update set setter=excluded.setter;

do $$ declare columns_sql text; definition text; begin
 select string_agg(case when a.attname='setter' then 'coalesce(c.setter,l.setter) as setter' else format('l.%I',a.attname) end,',' order by a.attnum)
 into columns_sql from pg_attribute a where a.attrelid='public.leads_raw'::regclass and a.attnum>0 and not a.attisdropped;
 execute 'create or replace view public.leads_setter_attribution as select '||columns_sql||' from public.leads_raw l left join public.webinar_setter_attribution c on c.ghlid=l.ghlid';
 select pg_get_viewdef('public.setters'::regclass,true) into definition;
 definition:=regexp_replace(definition,'\m(public\.)?leads_raw\M','public.leads_setter_attribution','g');
 execute 'create or replace view public.setters as '||definition;
end $$;
revoke all on public.leads_setter_attribution from public,anon,authenticated;
grant select on public.leads_setter_attribution to service_role;
notify pgrst,'reload schema';
commit;
