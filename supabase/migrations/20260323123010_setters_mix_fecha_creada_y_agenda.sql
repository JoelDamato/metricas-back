create or replace view public.setters as
with base_creado as (
  select
    extract(year from fecha_creada)::integer as anio,
    extract(month from fecha_creada)::integer as mes,
    setter,
    count(*) filter (where primer_origen = 'Instagram') as totales_ig,
    count(*) filter (
      where primer_origen = 'Instagram'
        and seguimiento_setting is not null
        and seguimiento_setting <> ''
    ) as contactados,
    count(*) filter (
      where primer_origen = 'Instagram'
        and seguimiento_setting is not null
        and seguimiento_setting <> ''
        and producto_de_interes = 'MEG'
    ) as aplica_meg,
    count(*) filter (
      where primer_origen = 'Instagram'
        and seguimiento_setting is not null
        and seguimiento_setting <> ''
        and producto_de_interes = 'MEG'
        and embudo_meg = 'Link Enviado'
    ) as link_enviado_meg,
    count(*) filter (
      where primer_origen = 'Instagram'
        and seguimiento_setting is not null
        and seguimiento_setting <> ''
        and producto_de_interes = 'CLUB'
    ) as aplica_club,
    count(*) filter (
      where primer_origen = 'Instagram'
        and seguimiento_setting is not null
        and seguimiento_setting <> ''
        and producto_de_interes = 'CLUB'
        and embudo_club is not null
        and embudo_club <> ''
        and embudo_club <> 'Propuesta'
        and embudo_club <> 'Pago'
    ) as consideracion_club,
    count(*) filter (
      where primer_origen = 'Instagram'
        and seguimiento_setting is not null
        and seguimiento_setting <> ''
        and producto_de_interes = 'CLUB'
        and embudo_club = 'Propuesta'
    ) as link_enviado_club,
    count(*) filter (
      where primer_origen = 'Instagram'
        and seguimiento_setting is not null
        and seguimiento_setting <> ''
        and producto_de_interes = 'CLUB'
        and embudo_club = 'Pago'
    ) as venta_club
  from public.leads_raw l
  where primer_origen = 'Instagram'
    and fecha_creada is not null
  group by extract(year from fecha_creada), extract(month from fecha_creada), setter
),
agenda_agenda as (
  select
    extract(year from fecha_agenda)::integer as anio,
    extract(month from fecha_agenda)::integer as mes,
    setter,
    count(*) filter (
      where primer_origen = 'Instagram'
        and seguimiento_setting is not null
        and seguimiento_setting <> ''
        and producto_de_interes = 'MEG'
        and embudo_meg = 'Link Enviado'
        and agendo = 'Agendo'
    ) as agendo,
    count(*) filter (
      where primer_origen = 'Instagram'
        and seguimiento_setting is not null
        and seguimiento_setting <> ''
        and producto_de_interes = 'MEG'
        and agendo = 'Agendo'
        and producto_adq is not null
        and producto_adq <> ''
    ) as venta_meg
  from public.leads_raw l
  where primer_origen = 'Instagram'
    and fecha_agenda is not null
  group by extract(year from fecha_agenda), extract(month from fecha_agenda), setter
)
select
  b.anio,
  b.mes,
  b.setter,
  b.totales_ig,
  b.contactados,
  b.aplica_meg,
  b.link_enviado_meg,
  coalesce(a.agendo, 0) as agendo,
  case
    when b.aplica_meg > 0 then coalesce(a.agendo, 0)::numeric / b.aplica_meg::numeric * 100::numeric
    else 0::numeric
  end as agendo_aplica_pct,
  case
    when b.contactados > 0 then coalesce(a.agendo, 0)::numeric / b.contactados::numeric * 100::numeric
    else 0::numeric
  end as agendo_contactados_pct,
  coalesce(a.venta_meg, 0) as venta_meg,
  b.aplica_club,
  b.consideracion_club,
  b.link_enviado_club,
  b.venta_club
from base_creado b
left join agenda_agenda a
  on a.anio = b.anio
 and a.mes = b.mes
 and a.setter is not distinct from b.setter
order by b.anio desc, b.mes desc, b.setter;
