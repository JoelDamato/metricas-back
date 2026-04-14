create or replace view public.kpi_marketing_diario as
with lead_norm as (
  select
    l.*,
    date(l.fecha_agenda) as fecha_agenda_date,
    case
      when l.origen ilike '%VSL%' then 'VSL'
      when l.origen ilike '%APSET%' then 'APSET'
      when l.origen ilike '%ORG%' then 'ORG'
      when l.origen ilike '%CLASES%' or l.origen ilike '%CLASE%' then 'CLASES'
      when l.origen ilike '%Lanzamiento%' then 'LANZ'
      when l.origen ilike '%Evergreen%' then 'EVERG'
      when l.origen ilike '%Club%' then 'CLUB'
      when nullif(btrim(l.origen), '') is null then 'Sin origen'
      else l.origen
    end as origen_norm
  from public.leads_raw l
  where l.fecha_agenda is not null
),
comp_norm as (
  select
    c.*,
    date(c.f_acreditacion) as fecha_acred_date,
    date(c.fecha_de_agendamiento) as fecha_agendamiento_date,
    case
      when c.origen ilike '%VSL%' then 'VSL'
      when c.origen ilike '%APSET%' then 'APSET'
      when c.origen ilike '%ORG%' then 'ORG'
      when c.origen ilike '%CLASES%' or c.origen ilike '%CLASE%' then 'CLASES'
      when c.origen ilike '%Lanzamiento%' then 'LANZ'
      when c.origen ilike '%Evergreen%' then 'EVERG'
      when c.origen ilike '%Club%' then 'CLUB'
      when nullif(btrim(c.origen), '') is null then 'Sin origen'
      else c.origen
    end as origen_norm
  from public.comprobantes c
),
fechas as (
  select distinct fecha_agenda_date as fecha
  from lead_norm
),
origenes as (
  select distinct origen_norm as origen
  from lead_norm
  union
  select distinct origen_norm as origen
  from comp_norm
),
esqueleto as (
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
      and (
        l.call_confirm = 'Exitoso'
        or l.llamada_cc = 'Exitoso'
        or l.cc_whatsapp = 'Exitoso'
      )
  ) as leads_contactados_cc,
  count(l.*) filter (
    where l.agendo = 'Agendo'
      and l.aplica = 'Aplica'
      and (
        l.call_confirm = 'Exitoso'
        or l.llamada_cc = 'Exitoso'
        or l.cc_whatsapp = 'Exitoso'
      )
  ) as call_confirmer_exitosos,
  count(l.*) filter (
    where l.agendo = 'Agendo'
      and l.aplica = 'Aplica'
      and (
        l.call_confirm = 'Exitoso'
        or l.llamada_cc = 'Exitoso'
        or l.cc_whatsapp = 'Exitoso'
      )
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
        l.llamada_cc is null
        or btrim(l.llamada_cc) = ''
        or lower(btrim(l.llamada_cc)) <> 'exitoso'
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
        l.llamada_cc is null
        or btrim(l.llamada_cc) = ''
        or lower(btrim(l.llamada_cc)) <> 'exitoso'
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
          and l.llamada_meg = 'Efectuada'
      )
    ) = 0 then 0::numeric
    else coalesce(vtas.ventas_totales::numeric, 0::numeric) /
      (
        count(l.*) filter (
          where l.agendo = 'Agendo'
            and l.aplica = 'Aplica'
            and l.llamada_meg = 'Efectuada'
        )
      )::numeric
  end as tasa_de_cierre
from esqueleto e
left join lead_norm l
  on l.fecha_agenda_date = e.fecha
 and l.origen_norm = e.origen
left join (
  select
    fecha_acred_date,
    origen_norm as origen,
    sum(cash_collected) as cash_collected_total
  from comp_norm
  where upper(coalesce(producto_format, '')) <> 'CLUB'
    and fecha_acred_date is not null
  group by fecha_acred_date, origen_norm
) cc on e.fecha = cc.fecha_acred_date and e.origen = cc.origen
left join (
  select
    fecha_acred_date,
    origen_norm as origen,
    sum(facturacion) as facturacion_total
  from comp_norm
  where upper(coalesce(producto_format, '')) <> 'CLUB'
    and fecha_acred_date is not null
  group by fecha_acred_date, origen_norm
) fact on e.fecha = fact.fecha_acred_date and e.origen = fact.origen
left join (
  select
    fecha_agendamiento_date,
    origen_norm as origen,
    count(*) as ventas_totales
  from comp_norm
  where fecha_agendamiento_date is not null
    and lower(coalesce(tipo, '')) = 'venta'
    and nullif(btrim(producto_format), '') is not null
    and lower(btrim(producto_format)) <> 'empty'
    and lower(btrim(producto_format)) not like '%club%'
  group by fecha_agendamiento_date, origen_norm
) vtas on e.fecha = vtas.fecha_agendamiento_date and e.origen = vtas.origen
left join (
  select
    fecha_agendamiento_date,
    origen_norm as origen,
    count(*) as ventas_cce
  from comp_norm
  where fecha_agendamiento_date is not null
    and lower(coalesce(tipo, '')) = 'venta'
    and nullif(btrim(producto_format), '') is not null
    and lower(btrim(producto_format)) <> 'empty'
    and lower(btrim(producto_format)) not like '%club%'
    and estado_cc = 'Exitoso'
  group by fecha_agendamiento_date, origen_norm
) vce on e.fecha = vce.fecha_agendamiento_date and e.origen = vce.origen
left join (
  select
    fecha_agendamiento_date,
    origen_norm as origen,
    count(*) as ventas_ccne
  from comp_norm
  where fecha_agendamiento_date is not null
    and lower(coalesce(tipo, '')) = 'venta'
    and nullif(btrim(producto_format), '') is not null
    and lower(btrim(producto_format)) <> 'empty'
    and lower(btrim(producto_format)) not like '%club%'
    and estado_cc = 'No exitoso'
  group by fecha_agendamiento_date, origen_norm
) vne on e.fecha = vne.fecha_agendamiento_date and e.origen = vne.origen
group by
  e.fecha,
  e.origen,
  cc.cash_collected_total,
  fact.facturacion_total,
  vtas.ventas_totales,
  vce.ventas_cce,
  vne.ventas_ccne
order by e.fecha desc, e.origen;
