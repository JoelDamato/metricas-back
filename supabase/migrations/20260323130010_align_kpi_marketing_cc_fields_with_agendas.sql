create or replace view public.kpi_marketing_diario as
with fechas as (
  select distinct date(leads_raw.fecha_agenda) as fecha
  from public.leads_raw
  where leads_raw.fecha_agenda is not null
), origenes as (
  select distinct
    case
      when comprobantes.origen ilike 'Postulación MEG - %' then
        case
          when split_part(comprobantes.origen, ' - ', 2) ilike '%VSL%' then 'VSL'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%ORG%' then 'ORG'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%APSET%' then 'APSET'
          else split_part(comprobantes.origen, ' - ', 2)
        end
      else coalesce(comprobantes.origen, 'Sin origen')
    end as origen
  from public.comprobantes
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
  count(l.*) filter (
    where l.agendo = 'Agendo'
      and l.aplica = 'Aplica'
      and (l.call_confirm = 'Exitoso' or l.llamada_cc = 'Exitoso')
  ) as leads_contactados_cc,
  count(l.*) filter (
    where l.agendo = 'Agendo'
      and l.aplica = 'Aplica'
      and (l.call_confirm = 'Exitoso' or l.llamada_cc = 'Exitoso')
  ) as call_confirmer_exitosos,
  count(l.*) filter (
    where l.agendo = 'Agendo'
      and l.aplica = 'Aplica'
      and (l.call_confirm = 'Exitoso' or l.llamada_cc = 'Exitoso')
      and l.llamada_meg = 'Efectuada'
  ) as llamadas_venta_asistidas_cce,
  coalesce(vce.ventas_cce, 0::bigint) as ventas_cce,
  count(l.*) filter (
    where l.agendo = 'Agendo'
      and l.aplica = 'Aplica'
      and (
        l.call_confirm is null
        or btrim(l.call_confirm) = ''
        or lower(btrim(l.call_confirm)) <> 'exitoso'
      )
      and (
        l.cc_whatsapp is null
        or btrim(l.cc_whatsapp) = ''
        or lower(btrim(l.cc_whatsapp)) <> 'exitoso'
      )
  ) as aplicaciones_no_calificaban_cc,
  count(l.*) filter (
    where l.agendo = 'Agendo'
      and l.aplica = 'Aplica'
      and (
        l.call_confirm is null
        or btrim(l.call_confirm) = ''
        or lower(btrim(l.call_confirm)) <> 'exitoso'
      )
      and (
        l.cc_whatsapp is null
        or btrim(l.cc_whatsapp) = ''
        or lower(btrim(l.cc_whatsapp)) <> 'exitoso'
      )
      and l.llamada_meg = 'Efectuada'
  ) as llamadas_venta_asistidas_ccne,
  coalesce(vne.ventas_ccne, 0::bigint) as ventas_ccne,
  coalesce(vtas.ventas_totales, 0::bigint) as ventas_totales,
  case
    when (
      count(l.*) filter (
        where l.agendo = 'Agendo'
          and l.aplica = 'Aplica'
          and (l.call_confirm = 'Exitoso' or l.llamada_cc = 'Exitoso')
          and l.llamada_meg = 'Efectuada'
      )
      +
      count(l.*) filter (
        where l.agendo = 'Agendo'
          and l.aplica = 'Aplica'
          and (
            l.call_confirm is null
            or btrim(l.call_confirm) = ''
            or lower(btrim(l.call_confirm)) <> 'exitoso'
          )
          and (
            l.cc_whatsapp is null
            or btrim(l.cc_whatsapp) = ''
            or lower(btrim(l.cc_whatsapp)) <> 'exitoso'
          )
          and l.llamada_meg = 'Efectuada'
      )
    ) = 0 then 0::numeric
    else coalesce(vtas.ventas_totales::numeric, 0::numeric) /
      (
        count(l.*) filter (
          where l.agendo = 'Agendo'
            and l.aplica = 'Aplica'
            and (l.call_confirm = 'Exitoso' or l.llamada_cc = 'Exitoso')
            and l.llamada_meg = 'Efectuada'
        )
        +
        count(l.*) filter (
          where l.agendo = 'Agendo'
            and l.aplica = 'Aplica'
            and (
              l.call_confirm is null
              or btrim(l.call_confirm) = ''
              or lower(btrim(l.call_confirm)) <> 'exitoso'
            )
            and (
              l.cc_whatsapp is null
              or btrim(l.cc_whatsapp) = ''
              or lower(btrim(l.cc_whatsapp)) <> 'exitoso'
            )
            and l.llamada_meg = 'Efectuada'
        )
      )::numeric
  end as tasa_de_cierre
from esqueleto e
left join public.leads_raw l
  on date(l.fecha_agenda) = e.fecha
 and (
    case
      when l.origen ilike 'Postulación MEG - %' then
        case
          when split_part(l.origen, ' - ', 2) ilike '%VSL%' then 'VSL'
          when split_part(l.origen, ' - ', 2) ilike '%ORG%' then 'ORG'
          when split_part(l.origen, ' - ', 2) ilike '%APSET%' then 'APSET'
          else split_part(l.origen, ' - ', 2)
        end
      else coalesce(l.origen, 'Sin origen')
    end
 ) = e.origen
left join (
  select
    date(comprobantes.f_acreditacion) as fecha_acred,
    case
      when comprobantes.origen ilike 'Postulación MEG - %' then
        case
          when split_part(comprobantes.origen, ' - ', 2) ilike '%VSL%' then 'VSL'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%ORG%' then 'ORG'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%APSET%' then 'APSET'
          else split_part(comprobantes.origen, ' - ', 2)
        end
      else coalesce(comprobantes.origen, 'Sin origen')
    end as origen,
    sum(comprobantes.cash_collected) as cash_collected_total
  from public.comprobantes
  where upper(coalesce(comprobantes.producto_format, '')) <> 'CLUB'
    and comprobantes.f_acreditacion is not null
  group by date(comprobantes.f_acreditacion), 2
) cc on e.fecha = cc.fecha_acred and e.origen = cc.origen
left join (
  select
    date(comprobantes.f_acreditacion) as fecha_acred,
    case
      when comprobantes.origen ilike 'Postulación MEG - %' then
        case
          when split_part(comprobantes.origen, ' - ', 2) ilike '%VSL%' then 'VSL'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%ORG%' then 'ORG'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%APSET%' then 'APSET'
          else split_part(comprobantes.origen, ' - ', 2)
        end
      else coalesce(comprobantes.origen, 'Sin origen')
    end as origen,
    sum(comprobantes.facturacion) as facturacion_total
  from public.comprobantes
  where upper(coalesce(comprobantes.producto_format, '')) <> 'CLUB'
    and comprobantes.f_acreditacion is not null
  group by date(comprobantes.f_acreditacion), 2
) fact on e.fecha = fact.fecha_acred and e.origen = fact.origen
left join (
  select
    date(comprobantes.fecha_de_agendamiento) as fecha_agendamiento,
    case
      when comprobantes.origen ilike 'Postulación MEG - %' then
        case
          when split_part(comprobantes.origen, ' - ', 2) ilike '%VSL%' then 'VSL'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%ORG%' then 'ORG'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%APSET%' then 'APSET'
          else split_part(comprobantes.origen, ' - ', 2)
        end
      else coalesce(comprobantes.origen, 'Sin origen')
    end as origen,
    count(*) as ventas_totales
  from public.comprobantes
  where comprobantes.fecha_de_agendamiento is not null
    and lower(coalesce(comprobantes.tipo, '')) = 'venta'
    and nullif(btrim(comprobantes.producto_format), '') is not null
    and lower(btrim(comprobantes.producto_format)) <> 'empty'
    and lower(btrim(comprobantes.producto_format)) not like '%club%'
  group by date(comprobantes.fecha_de_agendamiento), 2
) vtas on e.fecha = vtas.fecha_agendamiento and e.origen = vtas.origen
left join (
  select
    date(comprobantes.fecha_de_agendamiento) as fecha_agendamiento,
    case
      when comprobantes.origen ilike 'Postulación MEG - %' then
        case
          when split_part(comprobantes.origen, ' - ', 2) ilike '%VSL%' then 'VSL'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%ORG%' then 'ORG'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%APSET%' then 'APSET'
          else split_part(comprobantes.origen, ' - ', 2)
        end
      else coalesce(comprobantes.origen, 'Sin origen')
    end as origen,
    count(*) as ventas_cce
  from public.comprobantes
  where comprobantes.fecha_de_agendamiento is not null
    and lower(coalesce(comprobantes.tipo, '')) = 'venta'
    and nullif(btrim(comprobantes.producto_format), '') is not null
    and lower(btrim(comprobantes.producto_format)) <> 'empty'
    and lower(btrim(comprobantes.producto_format)) not like '%club%'
    and comprobantes.estado_cc = 'Exitoso'
  group by date(comprobantes.fecha_de_agendamiento), 2
) vce on e.fecha = vce.fecha_agendamiento and e.origen = vce.origen
left join (
  select
    date(comprobantes.fecha_de_agendamiento) as fecha_agendamiento,
    case
      when comprobantes.origen ilike 'Postulación MEG - %' then
        case
          when split_part(comprobantes.origen, ' - ', 2) ilike '%VSL%' then 'VSL'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%ORG%' then 'ORG'
          when split_part(comprobantes.origen, ' - ', 2) ilike '%APSET%' then 'APSET'
          else split_part(comprobantes.origen, ' - ', 2)
        end
      else coalesce(comprobantes.origen, 'Sin origen')
    end as origen,
    count(*) as ventas_ccne
  from public.comprobantes
  where comprobantes.fecha_de_agendamiento is not null
    and lower(coalesce(comprobantes.tipo, '')) = 'venta'
    and nullif(btrim(comprobantes.producto_format), '') is not null
    and lower(btrim(comprobantes.producto_format)) <> 'empty'
    and lower(btrim(comprobantes.producto_format)) not like '%club%'
    and comprobantes.estado_cc = 'No exitoso'
  group by date(comprobantes.fecha_de_agendamiento), 2
) vne on e.fecha = vne.fecha_agendamiento and e.origen = vne.origen
group by
  e.fecha,
  e.origen,
  cc.cash_collected_total,
  fact.facturacion_total,
  vtas.ventas_totales,
  vce.ventas_cce,
  vne.ventas_ccne
order by e.fecha desc, e.origen;
