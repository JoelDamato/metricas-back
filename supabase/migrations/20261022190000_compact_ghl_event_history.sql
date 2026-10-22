-- Keep the event ledger for replay protection, without retaining full CRM snapshots.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
alter table public.leads_ghl_events add column if not exists payload_sha256 text;
alter table public.csm_ghl_events add column if not exists payload_sha256 text;

create or replace function public.compact_ghl_event_history() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if TG_OP='INSERT' then
  new.payload_sha256:=encode(sha256(convert_to(new.payload::text,'UTF8')),'hex');
 elsif old.payload_sha256 is null then
  new.payload_sha256:=encode(sha256(convert_to(old.payload::text,'UTF8')),'hex');
 else
  new.payload_sha256:=old.payload_sha256;
 end if;
 new.payload:='{}'::jsonb;
 new.mapped_patch:='{}'::jsonb;
 new.before_row:=null;
 new.after_row:=null;
 return new;
end; $$;
revoke all on function public.compact_ghl_event_history() from public,anon,authenticated;

-- An ID reused with different content must still fail after removing the payload.
do $$
declare definition text; original text; replacement text;
begin
 select pg_get_functiondef('public.metricas_leads_ghl_ingest(uuid,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz)'::regprocedure) into definition;
 original:='ev.payload is distinct from p_payload';
 replacement:='coalesce(ev.payload_sha256,encode(sha256(convert_to(ev.payload::text,''UTF8'')),''hex'')) is distinct from encode(sha256(convert_to(p_payload::text,''UTF8'')),''hex'')';
 if position(original in definition)>0 then
  execute replace(definition,original,replacement);
 elsif position(replacement in definition)=0 then
  raise exception 'Unexpected ingestion definition: cannot safely install compact event ledger';
 end if;
end; $$;

drop trigger if exists compact_ghl_event_history on public.leads_ghl_events;
create trigger compact_ghl_event_history before insert or update on public.leads_ghl_events
for each row execute function public.compact_ghl_event_history();
drop trigger if exists compact_ghl_event_history on public.csm_ghl_events;
create trigger compact_ghl_event_history before insert or update on public.csm_ghl_events
for each row execute function public.compact_ghl_event_history();
commit;
-- Existing events are compacted in short batches by scripts/compact-ghl-event-history.js.
