create or replace view public.setters as
select
  extract(year from fecha_agenda)::integer as anio,
  extract(month from fecha_agenda)::integer as mes,
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
      and producto_de_interes = 'MEG'
      and embudo_meg = 'Link Enviado'
      and agendo = 'Agendo'
  ) as agendo,
  case
    when count(*) filter (
      where primer_origen = 'Instagram'
        and seguimiento_setting is not null
        and seguimiento_setting <> ''
        and producto_de_interes = 'MEG'
    ) > 0 then
      count(*) filter (
        where primer_origen = 'Instagram'
          and seguimiento_setting is not null
          and seguimiento_setting <> ''
          and producto_de_interes = 'MEG'
          and embudo_meg = 'Link Enviado'
          and agendo = 'Agendo'
      )::numeric
      / count(*) filter (
        where primer_origen = 'Instagram'
          and seguimiento_setting is not null
          and seguimiento_setting <> ''
          and producto_de_interes = 'MEG'
      )::numeric * 100::numeric
    else 0::numeric
  end as agendo_aplica_pct,
  case
    when count(*) filter (
      where primer_origen = 'Instagram'
        and seguimiento_setting is not null
        and seguimiento_setting <> ''
    ) > 0 then
      count(*) filter (
        where primer_origen = 'Instagram'
          and seguimiento_setting is not null
          and seguimiento_setting <> ''
          and producto_de_interes = 'MEG'
          and embudo_meg = 'Link Enviado'
          and agendo = 'Agendo'
      )::numeric
      / count(*) filter (
        where primer_origen = 'Instagram'
          and seguimiento_setting is not null
          and seguimiento_setting <> ''
      )::numeric * 100::numeric
    else 0::numeric
  end as agendo_contactados_pct,
  count(*) filter (
    where primer_origen = 'Instagram'
      and seguimiento_setting is not null
      and seguimiento_setting <> ''
      and producto_de_interes = 'MEG'
      and agendo = 'Agendo'
      and producto_adq is not null
      and producto_adq <> ''
  ) as venta_meg,
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
  and fecha_agenda is not null
group by extract(year from fecha_agenda), extract(month from fecha_agenda), setter
order by extract(year from fecha_agenda)::integer desc,
         extract(month from fecha_agenda)::integer desc,
         setter;
