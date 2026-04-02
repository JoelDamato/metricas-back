alter table if exists public.kpi_closers_rules
add column if not exists cash_collected_3m_min numeric(10,2) not null default 100;
