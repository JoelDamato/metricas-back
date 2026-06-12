create table if not exists public.agenda_bonus_rules (
  id bigserial primary key,
  anio integer not null,
  mes integer not null check (mes between 1 and 12),
  monto_base_mensual numeric(14,2) not null default 0,
  objetivo_mensual numeric(14,2) not null default 0,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anio, mes)
);

create or replace function public.set_agenda_bonus_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agenda_bonus_rules_updated_at on public.agenda_bonus_rules;
create trigger trg_agenda_bonus_rules_updated_at
before update on public.agenda_bonus_rules
for each row execute function public.set_agenda_bonus_rules_updated_at();
