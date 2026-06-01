create table if not exists public.commission_settings (
  scope text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_by text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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

create or replace function public.metricas_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_commission_settings_updated_at on public.commission_settings;
create trigger trg_commission_settings_updated_at
before update on public.commission_settings
for each row
execute function public.metricas_touch_updated_at();

drop trigger if exists trg_commission_month_snapshots_updated_at on public.commission_month_snapshots;
create trigger trg_commission_month_snapshots_updated_at
before update on public.commission_month_snapshots
for each row
execute function public.metricas_touch_updated_at();

insert into public.commission_settings (scope, config, updated_by)
values (
  'default',
  jsonb_build_object(
    'version', 1,
    'global', jsonb_build_object(
      'minimumSetterPct', 0.045,
      'clubTransferPct', 0.40,
      'includeOnlyVerified', true,
      'defaultCloserPct', 0.08,
      'personalizedCloserPct', 0.10
    ),
    'agendaScale', jsonb_build_array(
      jsonb_build_object('min', 0, 'pct', 0.045),
      jsonb_build_object('min', 15, 'pct', 0.050),
      jsonb_build_object('min', 25, 'pct', 0.055),
      jsonb_build_object('min', 35, 'pct', 0.060)
    ),
    'clubScale', jsonb_build_array(
      jsonb_build_object('min', 1, 'pct', 0.50),
      jsonb_build_object('min', 4, 'pct', 0.55),
      jsonb_build_object('min', 9, 'pct', 0.60)
    ),
    'fixedOverrides', jsonb_build_array(
      jsonb_build_object('person', 'Walter Alegre', 'pct', 0.10, 'enabled', true, 'note', 'Regla fija individual')
    ),
    'setterFixedOverrides', '[]'::jsonb,
    'setterClubScale', jsonb_build_array(
      jsonb_build_object('min', 1, 'pct', 0.40),
      jsonb_build_object('min', 3, 'pct', 0.45),
      jsonb_build_object('min', 5, 'pct', 0.50)
    ),
    'closerRules', jsonb_build_array(
      jsonb_build_object(
        'person', 'Carlos Tu',
        'product', 'Meg 2.1',
        'type', 'Venta',
        'originIncludes', '',
        'calendarIncludes', 'A - B',
        'pct', 0.09,
        'enabled', true,
        'note', 'CSV abril 2026: los cierres A-B de Carlos quedaron al 9%.'
      ),
      jsonb_build_object(
        'person', 'Carlos Tu',
        'product', '',
        'type', '',
        'originIncludes', 'ORG',
        'calendarIncludes', '| C',
        'pct', 0.10,
        'enabled', true,
        'note', 'CSV abril 2026: ORG C de Carlos quedó al 10%.'
      ),
      jsonb_build_object(
        'person', 'Mauro Gaitan',
        'product', '',
        'type', '',
        'originIncludes', '',
        'calendarIncludes', 'RT',
        'pct', 0.09,
        'enabled', true,
        'note', 'CSV abril 2026: los casos RT de Mauro quedaron al 9%.'
      ),
      jsonb_build_object(
        'person', 'Pablo Butera',
        'product', 'Meg 2.1',
        'type', '',
        'originIncludes', 'VSL - 3',
        'calendarIncludes', '',
        'pct', 0.09,
        'enabled', true,
        'note', 'CSV abril 2026: la venta VSL - 3 de Pablo quedó al 9%.'
      )
    ),
    'personAreas', '[]'::jsonb,
    'notes', jsonb_build_array(
      'Semilla inicial creada en el panel de métricas.',
      'Las escalas se pueden editar sin tocar código.',
      'El bloque principal del CSV muestra comisión de closer en "Porcentaje / Comision final ARS" y comisión de setter en "% Setter / Comision Setter".',
      'Club en closers escala por venta secuencial del mes: 50%, 55% y 60%.'
    )
  ),
  'migration'
)
on conflict (scope) do nothing;
