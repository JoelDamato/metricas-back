create table if not exists public.mercado_pago_club_workflow (
  record_kind text not null,
  record_id text not null,
  status text not null default 'pending',
  record_snapshot jsonb not null default '{}'::jsonb,
  reconciled_at timestamptz,
  reconciled_by_email text,
  invoiced_at timestamptz,
  invoiced_by_email text,
  arca_cae text,
  arca_invoice_number text,
  arca_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (record_kind, record_id),
  constraint mercado_pago_club_workflow_kind_check check (record_kind in ('payment', 'subscription')),
  constraint mercado_pago_club_workflow_status_check check (status in ('pending', 'reconciled', 'invoiced')),
  constraint mercado_pago_club_workflow_invoice_requires_reconciliation check (status <> 'invoiced' or reconciled_at is not null),
  constraint mercado_pago_club_workflow_invoice_requires_arca check (status <> 'invoiced' or (arca_cae is not null and arca_invoice_number is not null))
);

create index if not exists mercado_pago_club_workflow_reconciled_queue_idx
  on public.mercado_pago_club_workflow (reconciled_at desc)
  where status = 'reconciled';

create index if not exists mercado_pago_club_workflow_invoiced_idx
  on public.mercado_pago_club_workflow (invoiced_at desc)
  where status = 'invoiced';

revoke all on public.mercado_pago_club_workflow from anon, authenticated;
grant select, insert, update on public.mercado_pago_club_workflow to service_role;

alter table public.mercado_pago_club_workflow enable row level security;
