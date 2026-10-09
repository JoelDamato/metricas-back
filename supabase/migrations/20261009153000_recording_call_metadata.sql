begin;
alter table public.recording_sources add column if not exists closer text;
alter table public.recording_sources add column if not exists call_date text;
create or replace function public.sync_recording_source() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_OP='DELETE' then delete from recording_sources where ghlid=old.ghlid;return old;end if;
 insert into recording_sources(ghlid,name,recordings,closer,call_date) values(new.ghlid,coalesce(new.fields->>'full_name',new.fields->>'Nombre'),new.fields->>'Grabacion de llamadas',new.fields->>'Closer',new.fields->>'Fecha de llamada')
 on conflict(ghlid) do update set name=excluded.name,recordings=excluded.recordings,closer=excluded.closer,call_date=excluded.call_date;
 return new;
end;$$;
revoke all on function public.sync_recording_source() from public,anon,authenticated;
drop trigger if exists sync_recording_source on public.csm_ghl_contacts;
create trigger sync_recording_source after insert or update or delete on public.csm_ghl_contacts for each row execute function public.sync_recording_source();
insert into recording_sources(ghlid,name,recordings,closer,call_date) select ghlid,coalesce(fields->>'full_name',fields->>'Nombre'),fields->>'Grabacion de llamadas',fields->>'Closer',fields->>'Fecha de llamada' from csm_ghl_contacts on conflict(ghlid) do update set name=excluded.name,recordings=excluded.recordings,closer=excluded.closer,call_date=excluded.call_date;
commit;
