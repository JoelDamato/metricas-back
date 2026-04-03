create or replace view public.kpi_closers_mensual as
with fecha_actual as (
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date as hoy_ar
),
meses_base as (
  select distinct
    extract(year from l.fecha_llamada::date)::integer as anio,
    extract(month from l.fecha_llamada::date)::integer as mes,
    case
      when lower(trim(coalesce(l.closer, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
      when lower(trim(coalesce(l.closer, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
      else coalesce(l.closer, 'Sin closer')
    end as closer
  from leads_raw l
  where l.fecha_llamada is not null

  union

  select distinct
    extract(year from l.fecha_agenda::date)::integer as anio,
    extract(month from l.fecha_agenda::date)::integer as mes,
    case
      when lower(trim(coalesce(l.closer, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
      when lower(trim(coalesce(l.closer, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
      else coalesce(l.closer, 'Sin closer')
    end as closer
  from leads_raw l
  where l.fecha_agenda is not null

  union

  select distinct
    extract(year from c.f_venta)::integer as anio,
    extract(month from c.f_venta)::integer as mes,
    case
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
      else coalesce(c.creado_por, 'Sin closer')
    end as closer
  from comprobantes c
  where c.f_venta is not null

  union

  select distinct
    extract(year from c.f_acreditacion)::integer as anio,
    extract(month from c.f_acreditacion)::integer as mes,
    case
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
      else coalesce(c.creado_por, 'Sin closer')
    end as closer
  from comprobantes c
  where c.f_acreditacion is not null
),
llamada_agg as (
  select
    extract(year from l.fecha_llamada::date)::integer as anio,
    extract(month from l.fecha_llamada::date)::integer as mes,
    case
      when lower(trim(coalesce(l.closer, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
      when lower(trim(coalesce(l.closer, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
      else coalesce(l.closer, 'Sin closer')
    end as closer,
    count(*) filter (
      where l.agendo = 'Agendo'
        and l.aplica = 'Aplica'
        and l.llamada_meg = 'Efectuada'
    ) as efectuadas,
    count(*) filter (
      where l.agendo = 'Agendo'
        and l.aplica = 'Aplica'
    ) as aplica
  from leads_raw l
  where l.fecha_llamada is not null
  group by 1, 2, 3
),
ventas_llamada_agg as (
  select
    extract(year from c.f_venta)::integer as anio,
    extract(month from c.f_venta)::integer as mes,
    case
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
      else coalesce(c.creado_por, 'Sin closer')
    end as closer,
    count(*) as total_ventas
  from comprobantes c
  where upper(c.producto_format) <> 'CLUB'
    and c.tipo = 'Venta'
  group by 1, 2, 3
),
agenda_agg as (
  select
    extract(year from l.fecha_agenda::date)::integer as anio,
    extract(month from l.fecha_agenda::date)::integer as mes,
    case
      when lower(trim(coalesce(l.closer, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
      when lower(trim(coalesce(l.closer, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
      else coalesce(l.closer, 'Sin closer')
    end as closer,
    count(*) filter (
      where l.agendo = 'Agendo'
        and l.aplica = 'Aplica'
        and l.llamada_meg = 'Efectuada'
    ) as efectuadas_agenda,
    count(*) filter (
      where l.agendo = 'Agendo'
        and l.aplica = 'Aplica'
    ) as aplica_agenda
  from leads_raw l
  where l.fecha_agenda is not null
  group by 1, 2, 3
),
ventas_agenda_agg as (
  select
    extract(year from c.fecha_de_agendamiento)::integer as anio,
    extract(month from c.fecha_de_agendamiento)::integer as mes,
    case
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
      else coalesce(c.creado_por, 'Sin closer')
    end as closer,
    count(*) as total_ventas_agenda
  from comprobantes c
  where c.fecha_de_agendamiento is not null
    and upper(c.producto_format) <> 'CLUB'
    and c.tipo = 'Venta'
  group by 1, 2, 3
),
cash_agg as (
  select
    extract(year from c.f_venta)::integer as anio,
    extract(month from c.f_venta)::integer as mes,
    case
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
      else coalesce(c.creado_por, 'Sin closer')
    end as closer,
    sum(c.cash_collected) filter (
      where upper(c.producto_format) <> 'CLUB'
        and (
          c.f_acreditacion is null
          or (c.f_acreditacion at time zone 'America/Argentina/Buenos_Aires')::date <= fa.hoy_ar
        )
    ) as cash_collected_mes
  from comprobantes c
  cross join fecha_actual fa
  where c.f_venta is not null
  group by 1, 2, 3
),
cash_3m as (
  select
    mb.anio,
    mb.mes,
    mb.closer,
    (
      select sum(sub.cash_collected_mensual)
      from (
        select
          date_trunc('month', c.f_venta)::date as month_start,
          case
            when lower(trim(coalesce(c.creado_por, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
            when lower(trim(coalesce(c.creado_por, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
            else coalesce(c.creado_por, 'Sin closer')
          end as closer,
          sum(c.cash_collected) filter (
            where c.f_acreditacion is null
              or (c.f_acreditacion at time zone 'America/Argentina/Buenos_Aires')::date <= fa.hoy_ar
          ) as cash_collected_mensual
        from comprobantes c
        cross join fecha_actual fa
        where upper(c.producto_format) <> 'CLUB'
          and c.f_venta is not null
        group by 1, 2
      ) sub
      where sub.closer = mb.closer
        and sub.month_start >= (make_date(mb.anio, mb.mes, 1) - interval '3 months')::date
        and sub.month_start < make_date(mb.anio, mb.mes, 1)
    ) as cash_collected_3m
  from meses_base mb
),
fact_agg as (
  select
    extract(year from c.f_venta)::integer as anio,
    extract(month from c.f_venta)::integer as mes,
    case
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
      when lower(trim(coalesce(c.creado_por, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
      else coalesce(c.creado_por, 'Sin closer')
    end as closer,
    sum(c.facturacion) as facturacion_mes
  from comprobantes c
  where c.tipo = 'Venta'
    and upper(c.producto_format) <> 'CLUB'
  group by 1, 2, 3
),
fact_3m as (
  select
    mb.anio,
    mb.mes,
    mb.closer,
    (
      select sum(sub.facturacion_mensual)
      from (
        select
          date_trunc('month', c.f_venta)::date as month_start,
          case
            when lower(trim(coalesce(c.creado_por, 'Sin closer'))) in ('pablo butera', 'pablo butera vie') then 'Pablo Butera Vie'
            when lower(trim(coalesce(c.creado_por, 'Sin closer'))) = 'nahuel iasci' then 'Nahuel Iasci'
            else coalesce(c.creado_por, 'Sin closer')
          end as closer,
          sum(c.facturacion) as facturacion_mensual
        from comprobantes c
        where c.tipo = 'Venta'
          and upper(c.producto_format) <> 'CLUB'
          and c.f_venta is not null
        group by 1, 2
      ) sub
      where sub.closer = mb.closer
        and sub.month_start >= (make_date(mb.anio, mb.mes, 1) - interval '3 months')::date
        and sub.month_start < make_date(mb.anio, mb.mes, 1)
    ) as facturacion_3m
  from meses_base mb
)
select
  mb.anio,
  mb.mes,
  mb.closer,
  coalesce(la.efectuadas, 0::bigint) as efectuadas,
  coalesce(la.aplica, 0::bigint) as aplica,
  coalesce(vl.total_ventas, 0::bigint) as ventas_llamada,
  case
    when coalesce(la.efectuadas, 0::bigint) > 0
      then coalesce(vl.total_ventas, 0::bigint)::numeric / la.efectuadas::numeric
    else 0::numeric
  end as cierre_segun_llamada,
  case
    when coalesce(la.aplica, 0::bigint) > 0
      then coalesce(la.efectuadas, 0::bigint)::numeric / la.aplica::numeric
    else 0::numeric
  end as asistencia_segun_llamada,
  coalesce(aa.efectuadas_agenda, 0::bigint) as efectuadas_agenda,
  coalesce(aa.aplica_agenda, 0::bigint) as aplica_agenda,
  case
    when coalesce(aa.aplica_agenda, 0::bigint) > 0
      then coalesce(aa.efectuadas_agenda, 0::bigint)::numeric / aa.aplica_agenda::numeric
    else 0::numeric
  end as tasa_asistencia,
  case
    when coalesce(aa.efectuadas_agenda, 0::bigint) > 0
      then coalesce(va.total_ventas_agenda, 0::bigint)::numeric / aa.efectuadas_agenda::numeric
    else 0::numeric
  end as tasa_cierre,
  coalesce(cc.cash_collected_mes, 0::numeric) as cash_collected,
  coalesce(cc3.cash_collected_3m, 0::numeric) as cash_collected_3m,
  coalesce(f.facturacion_mes, 0::numeric) as facturacion,
  coalesce(f3.facturacion_3m, 0::numeric) as facturacion_3m
from meses_base mb
left join llamada_agg la
  on la.anio = mb.anio
 and la.mes = mb.mes
 and la.closer = mb.closer
left join ventas_llamada_agg vl
  on vl.anio = mb.anio
 and vl.mes = mb.mes
 and vl.closer = mb.closer
left join agenda_agg aa
  on aa.anio = mb.anio
 and aa.mes = mb.mes
 and aa.closer = mb.closer
left join ventas_agenda_agg va
  on va.anio = mb.anio
 and va.mes = mb.mes
 and va.closer = mb.closer
left join cash_agg cc
  on cc.anio = mb.anio
 and cc.mes = mb.mes
 and cc.closer = mb.closer
left join cash_3m cc3
  on cc3.anio = mb.anio
 and cc3.mes = mb.mes
 and cc3.closer = mb.closer
left join fact_agg f
  on f.anio = mb.anio
 and f.mes = mb.mes
 and f.closer = mb.closer
left join fact_3m f3
  on f3.anio = mb.anio
 and f3.mes = mb.mes
 and f3.closer = mb.closer
order by mb.anio desc, mb.mes desc, mb.closer;
