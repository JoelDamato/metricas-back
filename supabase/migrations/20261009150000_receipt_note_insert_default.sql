begin;
-- The receipt RPC populates the complete row: omitted fields become NULL,
-- bypassing column defaults. Initialize note revision before the constraint.
create or replace function public.initialize_receipt_note_revision()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 new.nota_conciliacion_revision := coalesce(new.nota_conciliacion_revision, 0);
 return new;
end;
$$;
revoke all on function public.initialize_receipt_note_revision() from public,anon,authenticated;
drop trigger if exists initialize_receipt_note_revision on public.comprobantes;
create trigger initialize_receipt_note_revision before insert on public.comprobantes
for each row execute function public.initialize_receipt_note_revision();
commit;
