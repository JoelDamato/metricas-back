-- Reglas de cumplimiento para KPI Closers por año/mes
create table if not exists public.kpi_closers_rules (
  id bigserial primary key,
  anio integer not null,
  mes integer not null check (mes between 1 and 12),
  cierre_llamada_pct numeric(10,2) not null default 45,
  asistencia_llamada_pct numeric(10,2) not null default 45,
  tasa_asistencia_pct numeric(10,2) not null default 45,
  tasa_cierre_pct numeric(10,2) not null default 45,
  cash_collected_min numeric(10,2) not null default 100,
  facturacion_min numeric(14,2) not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anio, mes)
);

create or replace function public.set_kpi_closers_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_kpi_closers_rules_updated_at on public.kpi_closers_rules;
create trigger trg_kpi_closers_rules_updated_at
before update on public.kpi_closers_rules
for each row execute function public.set_kpi_closers_rules_updated_at();
