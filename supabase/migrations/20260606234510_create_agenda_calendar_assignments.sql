create table if not exists public.agenda_calendar_assignments (
  id bigserial primary key,
  anio integer not null,
  mes integer not null check (mes between 1 and 12),
  closer_nombre text not null,
  calendar_letter text not null check (calendar_letter in ('A', 'B', 'C', 'D', 'E')),
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anio, mes, closer_nombre)
);

create or replace function public.set_agenda_calendar_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_agenda_calendar_assignments_updated_at on public.agenda_calendar_assignments;
create trigger trg_agenda_calendar_assignments_updated_at
before update on public.agenda_calendar_assignments
for each row execute function public.set_agenda_calendar_assignments_updated_at();
