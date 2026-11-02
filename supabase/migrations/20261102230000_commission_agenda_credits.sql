begin;
alter table public.commission_sale_overrides add column if not exists setter_eligible boolean not null default false;
alter table public.commission_sale_overrides add column if not exists agenda_month text check (agenda_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$');
comment on column public.commission_sale_overrides.setter_eligible is 'Explicit administrative eligibility exception; requires a setter percentage and never overrides foreign webinar attribution.';
comment on column public.commission_sale_overrides.agenda_month is 'Month credited one APSET agenda for this sale, deduplicated against recorded qualified agendas; does not alter CRM dates or origin.';
-- Explicit corrections requested by the administrator on 2026-11-02.
-- Keep closer percentages and original CRM attribution untouched; record before/after values.
do $$
declare correction record; prior public.commission_sale_overrides%rowtype; saved public.commission_sale_overrides%rowtype;
begin
 for correction in select * from (values
  ('cd556044-82a6-4059-a62c-38d9024ffe38','XZb7mo3Pl7MTx8a2E8Zv',true,'2026-10','Paula Crotti: una agenda APSET para Nahuel en octubre; esta venta cerró por webinar y cobra únicamente 3% de setting.'),
  ('a0d34ff7-ba83-4e3a-b314-61b81235e96d','L7QdAjwquybGltb3sT2E',false,null,'Sebastián Veltri: setting webinar de Nahuel al 3%, también para las cobranzas vinculadas.')
 ) as v(sale_id,ghlid,eligible,agenda_month,reason)
 loop
  perform 1 from public.comprobantes where id=correction.sale_id and ghlid=correction.ghlid and lower(tipo)='venta' for update;
  if not found then raise exception 'No coincide la venta para la corrección: %',correction.sale_id; end if;
  if to_regclass('public.commission_month_snapshots') is not null then
   lock table public.commission_month_snapshots in share mode;
   if exists(select 1 from public.comprobantes c join public.commission_month_snapshots m on m.month_key=left(c.f_acreditacion::text,7) and m.locked where public.commission_receipt_sale_id(c.id)=correction.sale_id) then
    raise exception 'La venta tiene un mes bloqueado: %',correction.sale_id;
   end if;
  end if;
  select * into prior from public.commission_sale_overrides where sale_id=correction.sale_id for update;
  if prior.setter_pct=.03 and prior.setter_eligible=correction.eligible and prior.agenda_month is not distinct from correction.agenda_month and prior.reason=correction.reason then continue; end if;
  insert into public.commission_sale_overrides(sale_id,closer_pct,setter_pct,reason,revision,updated_by,setter_eligible,agenda_month)
   values(correction.sale_id,prior.closer_pct,.03,correction.reason,coalesce(prior.revision,0)+1,'codex:explicit-user-request',correction.eligible,correction.agenda_month)
   on conflict(sale_id) do update set setter_pct=excluded.setter_pct,reason=excluded.reason,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now(),setter_eligible=excluded.setter_eligible,agenda_month=excluded.agenda_month
   returning * into saved;
  insert into public.commission_sale_override_audit(sale_id,receipt_id,actor,before_row,after_row)
   values(correction.sale_id,correction.sale_id,'codex:explicit-user-request',to_jsonb(prior),to_jsonb(saved));
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
