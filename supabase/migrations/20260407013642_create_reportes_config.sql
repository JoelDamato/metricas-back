create table if not exists public.reportes_config (
  id integer primary key check (id = 1),
  cash_collected_premio_pct numeric(10,4) not null default 1,
  updated_at timestamptz not null default now(),
  updated_by_email text
);

insert into public.reportes_config (id, cash_collected_premio_pct)
values (1, 1)
on conflict (id) do nothing;
