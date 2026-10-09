begin;
alter table public.mercado_pago_club_workflow drop constraint if exists mercado_pago_club_workflow_status_check;
alter table public.mercado_pago_club_workflow add constraint mercado_pago_club_workflow_status_check
 check(status in ('pending','reconciled','invoicing','invoiced','excluded'));
alter table public.mercado_pago_club_workflow add column if not exists billing_selection_by text;
alter table public.mercado_pago_club_workflow add column if not exists billing_selection_at timestamptz;
create or replace function public.set_mp_billing_selection(p_keys jsonb,p_excluded boolean,p_actor text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; current_row public.mercado_pago_club_workflow; affected integer:=0;
begin
 if p_excluded is null or jsonb_typeof(p_keys) is distinct from 'array' then raise exception 'Selección inválida';end if;
 if jsonb_array_length(p_keys)<1 or jsonb_array_length(p_keys)>500 then raise exception 'Seleccioná entre 1 y 500 registros';end if;
 for item in select distinct value from jsonb_array_elements(p_keys) order by value loop
  select * into current_row from public.mercado_pago_club_workflow where record_kind=item->>'kind' and record_id=item->>'id' for update;
  if not found or current_row.status<>(case when p_excluded then 'reconciled' else 'excluded' end)
   or current_row.arca_cae is not null or current_row.arca_invoice_number is not null
   or current_row.arca_response->>'pending'='true' then
   raise exception 'Un registro cambió de estado o tiene una emisión ARCA pendiente. Actualizá la lista.' using errcode='40001';
  end if;
  update public.mercado_pago_club_workflow set status=case when p_excluded then 'excluded' else 'reconciled' end,
   billing_selection_by=p_actor,billing_selection_at=now(),updated_at=now()
   where record_kind=current_row.record_kind and record_id=current_row.record_id;
  affected:=affected+1;
 end loop;
 return affected;
end;$$;
revoke all on function public.set_mp_billing_selection(jsonb,boolean,text) from public,anon,authenticated;
grant execute on function public.set_mp_billing_selection(jsonb,boolean,text) to service_role;
commit;
