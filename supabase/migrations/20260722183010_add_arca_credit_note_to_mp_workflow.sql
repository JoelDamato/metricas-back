alter table public.mercado_pago_club_workflow
  add column if not exists credit_note_issued_at timestamptz,
  add column if not exists credit_note_issued_by_email text,
  add column if not exists arca_credit_note_type text,
  add column if not exists arca_credit_note_number text,
  add column if not exists arca_credit_note_cae text,
  add column if not exists arca_credit_note_response jsonb;

create unique index if not exists mercado_pago_club_workflow_credit_note_number_idx
  on public.mercado_pago_club_workflow (arca_credit_note_number)
  where arca_credit_note_number is not null;
