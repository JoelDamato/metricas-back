alter table public.mercado_pago_club_workflow drop constraint if exists mercado_pago_club_workflow_kind_check;
alter table public.mercado_pago_club_workflow
  add constraint mercado_pago_club_workflow_kind_check check (record_kind in ('payment', 'subscription', 'manual'));
