-- Explicit basis for receipts whose entered cash is already net of VAT.
-- NULL preserves existing gross-input behavior until the receipt is reviewed.
begin;
alter table public.comprobantes add column if not exists cash_amount_basis text
 check (cash_amount_basis in ('gross','net_of_iva'));
alter table public.comprobantes add column if not exists received_gross_ars numeric
 check (received_gross_ars >= 0);
-- Amounts confirmed by the user from Nadia's payment reconciliation.
do $$
declare old_row public.comprobantes%rowtype; new_row public.comprobantes%rowtype;
begin
 select * into old_row from public.comprobantes where id='34848251-7a95-80dc-9436-c7307287bebc' for update;
 if not found then return; end if;
 if old_row.ghlid <> 'z9h9ea9dddYCuqWMgBmV' or old_row.cash_collected <> 3450 or old_row.cash_ar <> 4830000 then
  raise exception 'El comprobante de Martín cambió; revisar antes de aplicar';
 end if;
 if old_row.cash_amount_basis='net_of_iva' and old_row.received_gross_ars=5844300 then return;end if;
 perform set_config('metricas.receipt_write','on',true);
 update public.comprobantes set cash_amount_basis='net_of_iva', received_gross_ars=5844300
 where id=old_row.id returning * into new_row;
 insert into public.comprobantes_eventos_v2(comprobante_id,actor_email,action,before_row,after_row)
 values(old_row.id,'codex:explicit-user-request','edit',to_jsonb(old_row),to_jsonb(new_row));
end $$;
notify pgrst,'reload schema';
commit;
