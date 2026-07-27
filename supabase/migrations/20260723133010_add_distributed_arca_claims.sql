alter table public.mercado_pago_club_workflow
  drop constraint if exists mercado_pago_club_workflow_status_check;
alter table public.mercado_pago_club_workflow
  add constraint mercado_pago_club_workflow_status_check check (status in ('pending', 'reconciled', 'invoicing', 'invoiced'));
alter table public.mercado_pago_club_workflow
  add column if not exists credit_note_processing_at timestamptz;

create or replace function public.claim_mp_invoice(p_kind text, p_id text)
returns setof public.mercado_pago_club_workflow language sql security definer set search_path = public as $$
  update public.mercado_pago_club_workflow set status='invoicing', updated_at=now()
  where record_kind=p_kind and record_id=p_id and status='reconciled' and arca_cae is null returning *;
$$;
create or replace function public.release_mp_invoice(p_kind text, p_id text)
returns void language sql security definer set search_path = public as $$
  update public.mercado_pago_club_workflow set status='reconciled', updated_at=now()
  where record_kind=p_kind and record_id=p_id and status='invoicing' and arca_cae is null;
$$;
create or replace function public.claim_mp_credit_note(p_kind text, p_id text)
returns setof public.mercado_pago_club_workflow language sql security definer set search_path = public as $$
  update public.mercado_pago_club_workflow set credit_note_processing_at=now(), updated_at=now()
  where record_kind=p_kind and record_id=p_id and status='invoiced' and arca_credit_note_cae is null
    and (credit_note_processing_at is null or credit_note_processing_at < now() - interval '10 minutes') returning *;
$$;
revoke all on function public.claim_mp_invoice(text,text), public.release_mp_invoice(text,text), public.claim_mp_credit_note(text,text) from public, anon, authenticated;
grant execute on function public.claim_mp_invoice(text,text), public.release_mp_invoice(text,text), public.claim_mp_credit_note(text,text) to service_role;
