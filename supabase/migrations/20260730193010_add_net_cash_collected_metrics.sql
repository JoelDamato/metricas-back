-- Cash collected neto de IVA.
-- El IVA se guarda en ARS, por eso se descuenta sobre la base ARS y se
-- conserva la misma proporcion para los importes expresados en USD.

alter table public.comprobantes
  add column if not exists cash_collected_neto numeric,
  add column if not exists cash_collected_neto_ars numeric,
  add column if not exists cash_collected_neto_total numeric;

comment on column public.comprobantes.cash_collected_neto is
  'Cash collected del comprobante en USD, neto del IVA informado.';
comment on column public.comprobantes.cash_collected_neto_ars is
  'Cash collected del comprobante en ARS, neto del IVA informado.';
comment on column public.comprobantes.cash_collected_neto_total is
  'Cash collected total acumulado en USD, neto del IVA informado.';

create or replace function public.metricas_set_cash_collected_neto()
returns trigger
language plpgsql
as $$
declare
  gross_ars numeric;
  exchange_rate numeric;
  net_factor numeric := 1;
begin
  gross_ars := coalesce(
    nullif(new.cash_collected_ars, 0),
    nullif(new.cash_ar, 0),
    nullif(new.cash_collected_ar, 0)
  );

  if trim(coalesce(new.tc, '')) ~ '^[0-9]+([.,][0-9]+)?$' then
    exchange_rate := replace(trim(new.tc), ',', '.')::numeric;
  end if;

  if gross_ars is null
     and coalesce(new.cash_collected, 0) <> 0
     and coalesce(exchange_rate, 0) > 0 then
    gross_ars := new.cash_collected * exchange_rate;
  end if;

  if coalesce(new.iva, 0) > 0 and coalesce(gross_ars, 0) > 0 then
    net_factor := greatest(gross_ars - new.iva, 0) / gross_ars;
  elsif coalesce(new.iva, 0) > 0
        and coalesce(exchange_rate, 0) > 0
        and coalesce(new.cash_collected, 0) > 0 then
    net_factor := greatest(new.cash_collected - (new.iva / exchange_rate), 0)
      / new.cash_collected;
  end if;

  new.cash_collected_neto := round(
    coalesce(new.cash_collected, 0) * net_factor,
    6
  );
  new.cash_collected_neto_total := round(
    coalesce(new.cash_collected_total, 0) * net_factor,
    6
  );
  new.cash_collected_neto_ars := round(
    case
      when gross_ars is not null
        then greatest(gross_ars - coalesce(new.iva, 0), 0)
      when coalesce(exchange_rate, 0) > 0
        then greatest(
          coalesce(new.cash_collected, 0) * exchange_rate - coalesce(new.iva, 0),
          0
        )
      else 0
    end,
    2
  );

  return new;
end;
$$;

drop trigger if exists comprobantes_set_cash_collected_neto
  on public.comprobantes;

create trigger comprobantes_set_cash_collected_neto
before insert or update of
  cash_collected,
  cash_collected_total,
  cash_collected_ars,
  cash_ar,
  cash_collected_ar,
  iva,
  tc
on public.comprobantes
for each row
execute function public.metricas_set_cash_collected_neto();

-- Backfill historico y recalculo idempotente.
update public.comprobantes
set cash_collected = cash_collected;

-- Conserva los nombres publicos de las metricas, pero cambia su fuente al
-- cash neto. Las sustituciones parten de las definiciones activas para no
-- revertir ajustes posteriores de cada vista.
create or replace function public.metricas_replace_view_definition(
  target_view text,
  search_text text,
  replacement_text text
)
returns void
language plpgsql
as $$
declare
  current_definition text;
begin
  select pg_get_viewdef(format('public.%I', target_view)::regclass, true)
    into current_definition;

  if position(search_text in current_definition) = 0 then
    raise exception 'No se encontro "%" en la vista public.%', search_text, target_view;
  end if;

  current_definition := replace(
    current_definition,
    search_text,
    replacement_text
  );

  execute format(
    'create or replace view public.%I as %s',
    target_view,
    current_definition
  );
end;
$$;

create or replace function public.metricas_replace_view_definition_first(
  target_view text,
  search_text text,
  replacement_text text
)
returns void
language plpgsql
as $$
declare
  current_definition text;
  match_position integer;
begin
  select pg_get_viewdef(format('public.%I', target_view)::regclass, true)
    into current_definition;

  match_position := position(search_text in current_definition);
  if match_position = 0 then
    raise exception 'No se encontro "%" en la vista public.%', search_text, target_view;
  end if;

  current_definition := overlay(
    current_definition
    placing replacement_text
    from match_position
    for length(search_text)
  );

  execute format(
    'create or replace view public.%I as %s',
    target_view,
    current_definition
  );
end;
$$;

select public.metricas_replace_view_definition(
  'agenda_detalle_diario_closer',
  'comprobantes.cash_collected',
  'comprobantes.cash_collected_neto'
);

select public.metricas_replace_view_definition(
  'agenda_detalle_por_origen_closer',
  'COALESCE(c.cash_collected, 0::numeric) AS cash_monto',
  'COALESCE(c.cash_collected_neto, 0::numeric) AS cash_monto'
);

select public.metricas_replace_view_definition(
  'agenda_detalle_por_origen_closer_base',
  'sum(comprobantes.cash_collected)',
  'sum(comprobantes.cash_collected_neto)'
);

select public.metricas_replace_view_definition(
  'agenda_totales',
  'COALESCE(c.cash_collected, 0::numeric) AS cash_monto',
  'COALESCE(c.cash_collected_neto, 0::numeric) AS cash_monto'
);

select public.metricas_replace_view_definition(
  'agenda_totales_base',
  'c.cash_collected,',
  'c.cash_collected_neto AS cash_collected,'
);

select public.metricas_replace_view_definition_first(
  'agenda_totales_ultimo_origen',
  'c.cash_collected,',
  'c.cash_collected_neto AS cash_collected,'
);

select public.metricas_replace_view_definition(
  'cash_collected_diario_closer',
  'sum(cash_collected)',
  'sum(cash_collected_neto)'
);
select public.metricas_replace_view_definition(
  'cash_collected_diario_closer',
  'sum(cash_collected_ars)',
  'sum(cash_collected_neto_ars)'
);
select public.metricas_replace_view_definition(
  'cash_collected_diario_closer',
  'THEN cash_collected_ars',
  'THEN cash_collected_neto_ars'
);
select public.metricas_replace_view_definition(
  'cash_collected_diario_closer',
  E'THEN cash_collected\n',
  E'THEN cash_collected_neto\n'
);

select public.metricas_replace_view_definition(
  'dashboard_totales',
  'sum(comprobantes.cash_collected)',
  'sum(comprobantes.cash_collected_neto)'
);

select public.metricas_replace_view_definition(
  'kpi_closers_mensual',
  'sum(c.cash_collected)',
  'sum(c.cash_collected_neto)'
);
select public.metricas_replace_view_definition(
  'kpi_closers_mensual',
  'c.cash_collected_total',
  'c.cash_collected_neto_total'
);

select public.metricas_replace_view_definition_first(
  'kpi_marketing_diario',
  'c.cash_collected,',
  'c.cash_collected_neto AS cash_collected,'
);

select public.metricas_replace_view_definition(
  'ranking_closers_mensual',
  'sum(c.cash_collected)',
  'sum(c.cash_collected_neto)'
);

drop function public.metricas_replace_view_definition(text, text, text);
drop function public.metricas_replace_view_definition_first(text, text, text);
