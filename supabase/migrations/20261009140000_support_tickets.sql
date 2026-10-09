begin;
create table if not exists public.support_tickets (
  id text primary key,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' = id)
);
alter table public.support_tickets enable row level security;
alter table public.support_tickets force row level security;
revoke all on public.support_tickets from public, anon, authenticated;
grant select, insert, update, delete on public.support_tickets to service_role;
create or replace function public.support_tickets_mutate(p_changes jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare change jsonb; current_payload jsonb;
begin
  if jsonb_typeof(p_changes) <> 'array' then raise exception 'Invalid changes'; end if;
  perform pg_advisory_xact_lock(hashtextextended('support_tickets_mutate', 0));
  for change in select value from jsonb_array_elements(p_changes) loop
    select payload into current_payload from public.support_tickets where id = change->>'id' for update;
    if current_payload is distinct from nullif(change->'before', 'null'::jsonb) then
      raise exception 'Ticket updated concurrently' using errcode = '40001';
    end if;
    if nullif(change->'after', 'null'::jsonb) is null then
      delete from public.support_tickets where id = change->>'id';
    else
      insert into public.support_tickets(id, payload) values(change->>'id', change->'after')
      on conflict(id) do update set payload = excluded.payload;
    end if;
  end loop;
end;
$$;
revoke all on function public.support_tickets_mutate(jsonb) from public, anon, authenticated;
grant execute on function public.support_tickets_mutate(jsonb) to service_role;
commit;
