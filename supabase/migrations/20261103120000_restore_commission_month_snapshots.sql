-- Repair installations where movements exist but their month-lock table is missing.
-- Do not seed settings or snapshots: existing commission configuration stays intact.
begin;
create table if not exists public.commission_month_snapshots (
 month_key text primary key,
 config jsonb not null default '{}'::jsonb,
 locked boolean not null default false,
 locked_at timestamptz,
 locked_by text,
 updated_by text,
 created_at timestamptz not null default timezone('utc', now()),
 updated_at timestamptz not null default timezone('utc', now()),
 constraint commission_month_snapshots_month_key_check check (month_key ~ '^\d{4}-\d{2}$')
);
alter table public.commission_month_snapshots enable row level security;
revoke all on public.commission_month_snapshots from anon, authenticated;
grant select, insert, update, delete on public.commission_month_snapshots to service_role;
create or replace function public.commission_snapshot_touch_updated_at()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 new.updated_at = timezone('utc', now());
 return new;
end;
$$;
drop trigger if exists trg_commission_month_snapshots_updated_at on public.commission_month_snapshots;
create trigger trg_commission_month_snapshots_updated_at
before update on public.commission_month_snapshots
for each row execute function public.commission_snapshot_touch_updated_at();
notify pgrst, 'reload schema';
commit;
