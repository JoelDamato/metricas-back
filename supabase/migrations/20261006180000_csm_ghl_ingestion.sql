begin;
create table if not exists public.csm_ghl_events (
 id uuid primary key, ghlid text, location_id text, received_at timestamptz not null default now(),
 payload jsonb not null, mapped_patch jsonb not null, warnings jsonb not null default '[]',
 status text not null default 'received', csm_id text, error text, before_row jsonb, after_row jsonb
);
create index if not exists csm_ghl_events_contact_time on public.csm_ghl_events(ghlid,received_at desc);
create table if not exists public.csm_ghl_contacts (
 ghlid text primary key, csm_id text not null unique, location_id text,
 latest_payload jsonb not null, fields jsonb not null, last_event_id uuid not null, updated_at timestamptz not null default now()
);
create index if not exists csm_ghlid_ingestion_lookup on public.csm(ghlid);
alter table public.csm_ghl_events enable row level security;
alter table public.csm_ghl_contacts enable row level security;
revoke all on public.csm_ghl_events, public.csm_ghl_contacts from public,anon,authenticated;
grant select on public.csm_ghl_events, public.csm_ghl_contacts to service_role;

create or replace function public.csm_ghl_guard() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if current_setting('metricas.csm_ghl_write',true)='on' then return new;end if;
 if exists(select 1 from csm_ghl_contacts where ghlid=new.ghlid or csm_id=new.id) then return null;end if;
 return new;
end;$$;
drop trigger if exists csm_ghl_guard on public.csm;
create trigger csm_ghl_guard before insert or update on public.csm for each row execute function public.csm_ghl_guard();

create or replace function public.metricas_csm_ghl_ingest(p_event uuid,p_ghlid text,p_location text,p_payload jsonb,p_patch jsonb,p_warnings jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare oldrow public.csm%rowtype;newrow public.csm%rowtype;eventrow public.csm_ghl_events%rowtype;
 cnt integer;target_id text;cols text;safe_patch jsonb;raw_fields jsonb;operation text;crm_id text;
begin
 perform pg_advisory_xact_lock(hashtextextended('csm-ghl:'||coalesce(p_ghlid,''),0));
 select * into eventrow from csm_ghl_events where id=p_event;
 if found and eventrow.status in ('created','updated','unchanged') then
  return jsonb_build_object('status',eventrow.status,'receiptId',p_event,'csmId',eventrow.csm_id,'csmWritten',true,'replayed',true);
 end if;
 insert into csm_ghl_events(id,ghlid,location_id,payload,mapped_patch,warnings)
 values(p_event,p_ghlid,p_location,p_payload,p_patch,coalesce(p_warnings,'[]')) on conflict(id) do nothing;
 begin
  if nullif(btrim(p_ghlid),'') is null then raise exception 'Falta contact_id';end if;
  if p_location is not null and p_location<>'WU2z8kl23Dr3IyBW1hv5' then raise exception 'Ubicación GHL no permitida';end if;
  if jsonb_typeof(p_patch)<>'object' then raise exception 'Mapeo inválido';end if;
  select count(*) into cnt from csm where ghlid=p_ghlid;
  if cnt>1 then raise exception 'Hay más de un CSM con este GHL ID; requiere revisión';end if;
  select * into oldrow from csm where ghlid=p_ghlid for update;
  target_id:=oldrow.id;
  if target_id is null then
   if nullif(btrim(p_patch->>'nombre'),'') is null then raise exception 'Falta nombre para crear CSM';end if;
   target_id:=gen_random_uuid()::text;operation:='created';
  else operation:='updated';end if;
  -- Only existing columns, no identity, audit or relation supplied by the external sender.
  select coalesce(jsonb_object_agg(j.key,j.value),'{}') into safe_patch from jsonb_each(p_patch) j
   where j.key not in ('id','ghlid','created_at','updated_at','crm_2_0') and j.value not in ('null'::jsonb,'""'::jsonb)
   and exists(select 1 from information_schema.columns where table_schema='public' and table_name='csm' and column_name=j.key);
  select case when count(*)=1 then min(id) else null end into crm_id from leads_raw where ghlid=p_ghlid;
  if crm_id is not null then safe_patch:=safe_patch||jsonb_build_object('crm_2_0',crm_id);end if;
  safe_patch:=safe_patch||jsonb_build_object('id',target_id,'ghlid',p_ghlid);
  select * into newrow from jsonb_populate_record(oldrow,safe_patch);
  if operation='updated' and to_jsonb(newrow)=to_jsonb(oldrow) then operation:='unchanged';end if;
  newrow.created_at:=coalesce(oldrow.created_at,now());newrow.updated_at:=case when operation='unchanged' then oldrow.updated_at else now() end;
  perform set_config('metricas.csm_ghl_write','on',true);
  if operation='created' then insert into csm select newrow.*;
  elsif operation='updated' then
   select string_agg(format('%I',attname),',') into cols from pg_attribute where attrelid='public.csm'::regclass and attnum>0 and not attisdropped;
   execute format('update public.csm set (%s)=(select %s from jsonb_populate_record(null::public.csm,$1)) where id=$2',cols,cols) using to_jsonb(newrow),target_id;
  end if;
  raw_fields:=case when jsonb_typeof(p_payload->'data')='object' then p_payload->'data' else p_payload end;
  insert into csm_ghl_contacts(ghlid,csm_id,location_id,latest_payload,fields,last_event_id)
  values(p_ghlid,target_id,p_location,p_payload,raw_fields,p_event)
  on conflict(ghlid) do update set latest_payload=excluded.latest_payload,fields=csm_ghl_contacts.fields||excluded.fields,last_event_id=p_event,updated_at=now();
  update csm_ghl_events set status=operation,csm_id=target_id,before_row=case when oldrow.id is null then null else to_jsonb(oldrow) end,after_row=to_jsonb(newrow),error=null where id=p_event;
  return jsonb_build_object('status',operation,'receiptId',p_event,'csmId',target_id,'csmWritten',true,'warnings',coalesce(p_warnings,'[]'));
 exception when others then
  update csm_ghl_events set status='error',error=SQLERRM where id=p_event;
  return jsonb_build_object('status','needs_review','receiptId',p_event,'csmWritten',false,'message',SQLERRM);
 end;
end;$$;
revoke all on function public.csm_ghl_guard(), public.metricas_csm_ghl_ingest(uuid,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.metricas_csm_ghl_ingest(uuid,text,text,jsonb,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
