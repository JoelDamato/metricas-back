alter table if exists public.kpi_closers_rules
add column if not exists cierre_llamada_weight numeric(10,2) not null default 20,
add column if not exists asistencia_llamada_weight numeric(10,2) not null default 15,
add column if not exists tasa_asistencia_weight numeric(10,2) not null default 15,
add column if not exists tasa_cierre_weight numeric(10,2) not null default 20,
add column if not exists cash_collected_weight numeric(10,2) not null default 15,
add column if not exists cash_collected_3m_weight numeric(10,2) not null default 15;
