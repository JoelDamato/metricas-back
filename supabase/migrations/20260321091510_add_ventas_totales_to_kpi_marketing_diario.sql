create or replace view public.kpi_marketing_diario as
with fechas as (
  select distinct date(leads_raw.fecha_agenda) as fecha
  from leads_raw
  where leads_raw.fecha_agenda is not null
), origenes as (
  select distinct
    case
      when comprobantes.origen ~~* 'Postulación MEG - %' then
        case
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%VSL%' then 'VSL'
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%ORG%' then 'ORG'
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%APSET%' then 'APSET'
          else split_part(comprobantes.origen, ' - ', 2)
        end
      else coalesce(comprobantes.origen, 'Sin origen')
    end as origen
  from comprobantes
), esqueleto as (
  select f.fecha, o.origen
  from fechas f
  cross join origenes o
)
select
  e.fecha,
  e.origen,
  count(l.*) as reuniones_agendadas,
  count(l.*) filter (where l.aplica = 'Aplica') as agendas_aplicables,
  coalesce(cc.cash_collected_total, 0::numeric) as cash_collected,
  coalesce(fact.facturacion_total, 0::numeric) as facturacion,
  count(l.*) as aplicaciones_formulario,
  count(l.*) filter (where l.aplica = 'Aplica') as aplicaciones_aplicables_ghl,
  count(l.*) filter (where l.call_confirm is not null and l.call_confirm <> '') as leads_contactados_cc,
  count(l.*) filter (where l.call_confirm = 'Exitoso') as call_confirmer_exitosos,
  count(l.*) filter (
    where l.agendo = 'Agendo'
      and l.aplica = 'Aplica'
      and (l.call_confirm = 'Exitoso' or l.llamada_cc = 'Exitoso')
      and l.llamada_meg = 'Efectuada'
  ) as llamadas_venta_asistidas_cce,
  count(l.*) filter (where l.call_confirm = 'Exitoso' and l.u_product_adquirido ~~ '%Meg%') as ventas_cce,
  count(l.*) filter (where l.call_confirm = 'Exitoso' and l.aplica <> 'Aplica') as aplicaciones_no_calificaban_cc,
  count(l.*) filter (
    where l.agendo = 'Agendo'
      and l.aplica = 'Aplica'
      and (l.call_confirm is null or btrim(l.call_confirm) = '' or lower(btrim(l.call_confirm)) <> 'exitoso')
      and (l.cc_whatsapp is null or btrim(l.cc_whatsapp) = '' or lower(btrim(l.cc_whatsapp)) <> 'exitoso')
      and l.llamada_meg = 'Efectuada'
  ) as llamadas_venta_asistidas_ccne,
  count(l.*) filter (where l.call_confirm <> 'Exitoso' and l.u_product_adquirido ~~ '%Meg%') as ventas_ccne,
  coalesce(vtas.ventas_totales, 0::bigint) as ventas_totales
from esqueleto e
left join leads_raw l
  on date(l.fecha_agenda) = e.fecha
 and (
    case
      when l.origen ~~* 'Postulación MEG - %' then
        case
          when split_part(l.origen, ' - ', 2) ~~* '%VSL%' then 'VSL'
          when split_part(l.origen, ' - ', 2) ~~* '%ORG%' then 'ORG'
          when split_part(l.origen, ' - ', 2) ~~* '%APSET%' then 'APSET'
          else split_part(l.origen, ' - ', 2)
        end
      else coalesce(l.origen, 'Sin origen')
    end
 ) = e.origen
left join (
  select
    date(comprobantes.f_acreditacion) as fecha_acred,
    case
      when comprobantes.origen ~~* 'Postulación MEG - %' then
        case
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%VSL%' then 'VSL'
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%ORG%' then 'ORG'
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%APSET%' then 'APSET'
          else split_part(comprobantes.origen, ' - ', 2)
        end
      else coalesce(comprobantes.origen, 'Sin origen')
    end as origen,
    sum(comprobantes.cash_collected) as cash_collected_total
  from comprobantes
  where upper(coalesce(comprobantes.producto_format, '')) <> 'CLUB'
    and comprobantes.f_acreditacion is not null
  group by 1, 2
) cc
  on e.fecha = cc.fecha_acred and e.origen = cc.origen
left join (
  select
    date(comprobantes.f_acreditacion) as fecha_acred,
    case
      when comprobantes.origen ~~* 'Postulación MEG - %' then
        case
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%VSL%' then 'VSL'
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%ORG%' then 'ORG'
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%APSET%' then 'APSET'
          else split_part(comprobantes.origen, ' - ', 2)
        end
      else coalesce(comprobantes.origen, 'Sin origen')
    end as origen,
    sum(comprobantes.facturacion) as facturacion_total
  from comprobantes
  where upper(coalesce(comprobantes.producto_format, '')) <> 'CLUB'
    and comprobantes.f_acreditacion is not null
  group by 1, 2
) fact
  on e.fecha = fact.fecha_acred and e.origen = fact.origen
left join (
  select
    date(comprobantes.fecha_de_agendamiento) as fecha_agendamiento,
    case
      when comprobantes.origen ~~* 'Postulación MEG - %' then
        case
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%VSL%' then 'VSL'
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%ORG%' then 'ORG'
          when split_part(comprobantes.origen, ' - ', 2) ~~* '%APSET%' then 'APSET'
          else split_part(comprobantes.origen, ' - ', 2)
        end
      else coalesce(comprobantes.origen, 'Sin origen')
    end as origen,
    count(*)::bigint as ventas_totales
  from comprobantes
  where comprobantes.fecha_de_agendamiento is not null
    and lower(coalesce(comprobantes.tipo, '')) = 'venta'
    and nullif(btrim(comprobantes.producto_format), '') is not null
    and lower(btrim(comprobantes.producto_format)) <> 'empty'
    and lower(btrim(comprobantes.producto_format)) not like '%club%'
  group by 1, 2
) vtas
  on e.fecha = vtas.fecha_agendamiento and e.origen = vtas.origen
group by e.fecha, e.origen, cc.cash_collected_total, fact.facturacion_total, vtas.ventas_totales
order by e.fecha desc, e.origen;
