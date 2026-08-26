-- Corrige facturas con CAE que una conciliación posterior degradó a "reconciled".
update public.mercado_pago_club_workflow
set status = 'invoiced',
    updated_at = now()
where arca_cae is not null
  and arca_invoice_number is not null
  and status <> 'invoiced';

-- Impide en la base que un comprobante con datos fiscales vuelva a otro estado.
alter table public.mercado_pago_club_workflow
  drop constraint if exists mercado_pago_club_workflow_arca_state_consistency;

alter table public.mercado_pago_club_workflow
  add constraint mercado_pago_club_workflow_arca_state_consistency check (
    (arca_cae is null and arca_invoice_number is null)
    or
    (status = 'invoiced' and arca_cae is not null and arca_invoice_number is not null)
  );

-- La conciliación se resuelve en una única sentencia. Ante una pantalla vieja,
-- conserva filas que ya están facturadas o que otra solicitud está facturando.
create or replace function public.reconcile_mp_records(p_records jsonb, p_email text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  if jsonb_typeof(p_records) <> 'array'
     or jsonb_array_length(p_records) < 1
     or jsonb_array_length(p_records) > 500 then
    raise exception 'Seleccioná entre 1 y 500 registros para conciliar';
  end if;

  with input_rows as (
    select
      trim(item.record_kind) as record_kind,
      trim(item.record_id) as record_id,
      coalesce(item.record_snapshot, '{}'::jsonb) as record_snapshot
    from jsonb_to_recordset(p_records) as item(
      record_kind text,
      record_id text,
      record_snapshot jsonb
    )
    where item.record_kind in ('payment', 'subscription')
      and nullif(trim(item.record_id), '') is not null
  ), reconciled as (
    insert into public.mercado_pago_club_workflow as workflow (
      record_kind,
      record_id,
      status,
      record_snapshot,
      reconciled_at,
      reconciled_by_email,
      updated_at
    )
    select
      record_kind,
      record_id,
      'reconciled',
      record_snapshot,
      now(),
      nullif(lower(trim(p_email)), ''),
      now()
    from input_rows
    on conflict (record_kind, record_id) do update
    set status = 'reconciled',
        record_snapshot = excluded.record_snapshot,
        reconciled_at = excluded.reconciled_at,
        reconciled_by_email = excluded.reconciled_by_email,
        updated_at = excluded.updated_at
    where workflow.status in ('pending', 'reconciled')
      and workflow.arca_cae is null
      and workflow.arca_invoice_number is null
    returning 1
  )
  select count(*) into affected_rows from reconciled;

  return affected_rows;
end;
$$;

revoke all on function public.reconcile_mp_records(jsonb, text) from public, anon, authenticated;
grant execute on function public.reconcile_mp_records(jsonb, text) to service_role;
