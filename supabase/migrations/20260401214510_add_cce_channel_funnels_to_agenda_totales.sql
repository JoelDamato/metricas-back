CREATE OR REPLACE VIEW public.agenda_totales AS
WITH fecha_actual AS (
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy_ar
),
base_norm AS (
  SELECT
    b.origen,
    b.estrategia_a,
    b.anio,
    b.mes,
    b.total_agendados,
    b.total_aplica,
    b.total_respondio,
    b.total_confirmo,
    b.total_cancelado,
    b.total_no_asistidas,
    b.total_pendientes,
    b.total_efectuadas,
    b.total_ventas,
    b.total_paid_upfront,
    b.aov,
    b.tasa_cierre,
    b.ccne,
    b.ccne_efectuadas,
    b.ccne_vendidas,
    b.cce,
    b.cce_efectuadas,
    b.cce_vendidas,
    b.facturacion_total_mes,
    b.cash_collected_real_mes,
    b.cash_collected_otros_meses,
    b.cash_collected_agendas_mes,
    b.meg_1,
    b.meg_2,
    b.personalizado,
    b.renovacion_meg_personalizado,
    b.reportes_financieros,
    b.renovacion_meg,
    b.renovacion_meg_2,
    b.meg_2_1,
    b.renovacion_meg_2_1,
    b.facturacion_f_agenda,
    b.cash_collected_agenda,
    COALESCE(b.cce_llamada, 0::bigint) AS cce_llamada,
    COALESCE(b.cce_whatsapp, 0::bigint) AS cce_whatsapp,
    COALESCE(NULLIF(BTRIM(b.origen), ''), 'Sin origen') AS origen_key,
    COALESCE(NULLIF(BTRIM(b.estrategia_a), ''), 'Sin estrategia') AS estrategia_key
  FROM public.agenda_totales_base b
),
comprobantes_facturacion AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(c.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(c.estrategia_a), ''), 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM c.f_venta)::integer AS venta_anio,
    EXTRACT(MONTH FROM c.f_venta)::integer AS venta_mes,
    COALESCE(c.facturacion, 0::numeric) AS facturacion
  FROM public.comprobantes c
  WHERE c.f_venta IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) = 'venta'
    AND NULLIF(BTRIM(c.producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
),
comprobantes_facturacion_agenda AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(c.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(c.estrategia_a), ''), 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM c.fecha_de_agendamiento)::integer AS agenda_anio,
    EXTRACT(MONTH FROM c.fecha_de_agendamiento)::integer AS agenda_mes,
    COALESCE(c.facturacion, 0::numeric) AS facturacion
  FROM public.comprobantes c
  WHERE c.fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) = 'venta'
    AND NULLIF(BTRIM(c.producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
),
comprobantes_ventas_agenda AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(c.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(c.estrategia_a), ''), 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM c.fecha_de_agendamiento)::integer AS agenda_anio,
    EXTRACT(MONTH FROM c.fecha_de_agendamiento)::integer AS agenda_mes
  FROM public.comprobantes c
  WHERE c.fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) = 'venta'
    AND NULLIF(BTRIM(c.producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
),
comprobantes_cash AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(c.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(c.estrategia_a), ''), 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM c.f_acreditacion)::integer AS acreditacion_anio,
    EXTRACT(MONTH FROM c.f_acreditacion)::integer AS acreditacion_mes,
    (c.f_acreditacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS acreditacion_fecha_ar,
    CASE
      WHEN c.fecha_de_agendamiento IS NULL THEN NULL::integer
      ELSE EXTRACT(YEAR FROM c.fecha_de_agendamiento)::integer
    END AS agenda_anio,
    CASE
      WHEN c.fecha_de_agendamiento IS NULL THEN NULL::integer
      ELSE EXTRACT(MONTH FROM c.fecha_de_agendamiento)::integer
    END AS agenda_mes,
    COALESCE(c.cash_collected, 0::numeric) AS cash_monto
  FROM public.comprobantes c
  WHERE c.f_acreditacion IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) = ANY (ARRAY['venta', 'cobranza'])
    AND (
      NULLIF(BTRIM(c.producto_format), '') IS NULL
      OR LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
    )
),
comprobantes_cash_filtrados AS (
  SELECT cc.*
  FROM comprobantes_cash cc
  CROSS JOIN fecha_actual fa
  WHERE cc.acreditacion_anio IS NOT NULL
    AND cc.acreditacion_mes IS NOT NULL
    AND (
      cc.acreditacion_anio <> EXTRACT(YEAR FROM fa.hoy_ar)::integer
      OR cc.acreditacion_mes <> EXTRACT(MONTH FROM fa.hoy_ar)::integer
      OR cc.acreditacion_fecha_ar <= fa.hoy_ar
    )
),
fact_agg AS (
  SELECT
    venta_anio AS anio,
    venta_mes AS mes,
    origen_key,
    estrategia_key,
    SUM(facturacion) AS facturacion_total_mes
  FROM comprobantes_facturacion
  GROUP BY venta_anio, venta_mes, origen_key, estrategia_key
),
fact_agenda_agg AS (
  SELECT
    agenda_anio AS anio,
    agenda_mes AS mes,
    origen_key,
    estrategia_key,
    SUM(facturacion) AS facturacion_f_agenda
  FROM comprobantes_facturacion_agenda
  GROUP BY agenda_anio, agenda_mes, origen_key, estrategia_key
),
ventas_agg AS (
  SELECT
    agenda_anio AS anio,
    agenda_mes AS mes,
    origen_key,
    estrategia_key,
    COUNT(*)::bigint AS total_ventas_comp
  FROM comprobantes_ventas_agenda
  GROUP BY agenda_anio, agenda_mes, origen_key, estrategia_key
),
cash_real_agg AS (
  SELECT
    acreditacion_anio AS anio,
    acreditacion_mes AS mes,
    origen_key,
    estrategia_key,
    SUM(cash_monto) AS cash_collected_real_mes
  FROM comprobantes_cash_filtrados
  GROUP BY acreditacion_anio, acreditacion_mes, origen_key, estrategia_key
),
cash_agenda_agg AS (
  SELECT
    acreditacion_anio AS anio,
    acreditacion_mes AS mes,
    origen_key,
    estrategia_key,
    SUM(cash_monto) AS cash_collected_agendas_mes
  FROM comprobantes_cash_filtrados
  WHERE agenda_anio = acreditacion_anio
    AND agenda_mes = acreditacion_mes
  GROUP BY acreditacion_anio, acreditacion_mes, origen_key, estrategia_key
),
cash_otros_agg AS (
  SELECT
    acreditacion_anio AS anio,
    acreditacion_mes AS mes,
    origen_key,
    estrategia_key,
    SUM(cash_monto) AS cash_collected_otros_meses
  FROM comprobantes_cash_filtrados
  WHERE agenda_anio IS NULL
    OR agenda_mes IS NULL
    OR agenda_anio <> acreditacion_anio
    OR agenda_mes <> acreditacion_mes
  GROUP BY acreditacion_anio, acreditacion_mes, origen_key, estrategia_key
),
cce_llamada_agg AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(l.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(l.estrategia_a), ''), 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM l.fecha_agenda)::integer AS anio,
    EXTRACT(MONTH FROM l.fecha_agenda)::integer AS mes,
    COUNT(*)::bigint AS cce_llamada
  FROM public.leads_raw l
  WHERE l.fecha_agenda IS NOT NULL
    AND l.agendo = 'Agendo'
    AND l.aplica = 'Aplica'
    AND (
      l.call_confirm = 'Exitoso'
      OR l.llamada_cc = 'Exitoso'
    )
  GROUP BY 1, 2, 3, 4
),
cce_llamada_efectuadas_agg AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(l.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(l.estrategia_a), ''), 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM l.fecha_agenda)::integer AS anio,
    EXTRACT(MONTH FROM l.fecha_agenda)::integer AS mes,
    COUNT(*)::bigint AS cce_llamada_efectuadas
  FROM public.leads_raw l
  WHERE l.fecha_agenda IS NOT NULL
    AND l.agendo = 'Agendo'
    AND l.aplica = 'Aplica'
    AND (
      l.call_confirm = 'Exitoso'
      OR l.llamada_cc = 'Exitoso'
    )
    AND l.llamada_meg = 'Efectuada'
  GROUP BY 1, 2, 3, 4
),
cce_whatsapp_agg AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(l.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(l.estrategia_a), ''), 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM l.fecha_agenda)::integer AS anio,
    EXTRACT(MONTH FROM l.fecha_agenda)::integer AS mes,
    COUNT(*)::bigint AS cce_whatsapp
  FROM public.leads_raw l
  WHERE l.fecha_agenda IS NOT NULL
    AND l.agendo = 'Agendo'
    AND l.aplica = 'Aplica'
    AND l.cc_whatsapp = 'Exitoso'
  GROUP BY 1, 2, 3, 4
),
cce_whatsapp_efectuadas_agg AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(l.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(l.estrategia_a), ''), 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM l.fecha_agenda)::integer AS anio,
    EXTRACT(MONTH FROM l.fecha_agenda)::integer AS mes,
    COUNT(*)::bigint AS cce_whatsapp_efectuadas
  FROM public.leads_raw l
  WHERE l.fecha_agenda IS NOT NULL
    AND l.agendo = 'Agendo'
    AND l.aplica = 'Aplica'
    AND l.cc_whatsapp = 'Exitoso'
    AND l.llamada_meg = 'Efectuada'
  GROUP BY 1, 2, 3, 4
),
lead_channel_flags AS (
  SELECT
    l.ghlid,
    BOOL_OR(
      l.agendo = 'Agendo'
      AND l.aplica = 'Aplica'
      AND (
        l.call_confirm = 'Exitoso'
        OR l.llamada_cc = 'Exitoso'
      )
    ) AS cce_llamada,
    BOOL_OR(
      l.agendo = 'Agendo'
      AND l.aplica = 'Aplica'
      AND l.cc_whatsapp = 'Exitoso'
    ) AS cce_whatsapp
  FROM public.leads_raw l
  WHERE NULLIF(BTRIM(l.ghlid), '') IS NOT NULL
  GROUP BY l.ghlid
),
cce_llamada_vendidas_agg AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(c.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(c.estrategia_a), ''), 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM c.fecha_de_agendamiento)::integer AS anio,
    EXTRACT(MONTH FROM c.fecha_de_agendamiento)::integer AS mes,
    COUNT(*)::bigint AS cce_llamada_vendidas
  FROM public.comprobantes c
  INNER JOIN lead_channel_flags lf
    ON lf.ghlid = c.ghlid
   AND lf.cce_llamada
  WHERE c.fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) = 'venta'
    AND NULLIF(BTRIM(c.producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
  GROUP BY 1, 2, 3, 4
),
cce_whatsapp_vendidas_agg AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(c.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(c.estrategia_a), ''), 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM c.fecha_de_agendamiento)::integer AS anio,
    EXTRACT(MONTH FROM c.fecha_de_agendamiento)::integer AS mes,
    COUNT(*)::bigint AS cce_whatsapp_vendidas
  FROM public.comprobantes c
  INNER JOIN lead_channel_flags lf
    ON lf.ghlid = c.ghlid
   AND lf.cce_whatsapp
  WHERE c.fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) = 'venta'
    AND NULLIF(BTRIM(c.producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
  GROUP BY 1, 2, 3, 4
),
combos AS (
  SELECT anio, mes, origen_key, estrategia_key FROM base_norm
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM fact_agg
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM fact_agenda_agg
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM ventas_agg
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM cash_real_agg
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM cash_agenda_agg
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM cash_otros_agg
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM cce_llamada_agg
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM cce_llamada_efectuadas_agg
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM cce_whatsapp_agg
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM cce_whatsapp_efectuadas_agg
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM cce_llamada_vendidas_agg
  UNION
  SELECT anio, mes, origen_key, estrategia_key FROM cce_whatsapp_vendidas_agg
)
SELECT
  combos.origen_key AS origen,
  combos.estrategia_key AS estrategia_a,
  combos.anio,
  combos.mes,
  COALESCE(b.total_agendados, 0::bigint) AS total_agendados,
  COALESCE(b.total_aplica, 0::bigint) AS total_aplica,
  COALESCE(b.total_respondio, 0::bigint) AS total_respondio,
  COALESCE(b.total_confirmo, 0::bigint) AS total_confirmo,
  COALESCE(b.total_cancelado, 0::bigint) AS total_cancelado,
  COALESCE(b.total_no_asistidas, 0::bigint) AS total_no_asistidas,
  COALESCE(b.total_pendientes, 0::bigint) AS total_pendientes,
  COALESCE(b.total_efectuadas, 0::bigint) AS total_efectuadas,
  COALESCE(v.total_ventas_comp, 0::bigint) AS total_ventas,
  COALESCE(b.total_paid_upfront, 0::numeric) AS total_paid_upfront,
  COALESCE(
    b.aov,
    CASE
      WHEN COALESCE(v.total_ventas_comp, 0::bigint) > 0
        THEN COALESCE(f.facturacion_total_mes, 0::numeric) / v.total_ventas_comp::numeric
      ELSE 0::numeric
    END
  ) AS aov,
  COALESCE(b.tasa_cierre, 0::numeric) AS tasa_cierre,
  COALESCE(b.ccne, 0::bigint) AS ccne,
  COALESCE(b.ccne_efectuadas, 0::bigint) AS ccne_efectuadas,
  COALESCE(b.ccne_vendidas, 0::bigint) AS ccne_vendidas,
  COALESCE(b.cce, 0::bigint) AS cce,
  COALESCE(b.cce_efectuadas, 0::bigint) AS cce_efectuadas,
  COALESCE(b.cce_vendidas, 0::bigint) AS cce_vendidas,
  COALESCE(f.facturacion_total_mes, 0::numeric) AS facturacion_total_mes,
  COALESCE(cr.cash_collected_real_mes, 0::numeric) AS cash_collected_real_mes,
  COALESCE(co.cash_collected_otros_meses, 0::numeric) AS cash_collected_otros_meses,
  COALESCE(ca.cash_collected_agendas_mes, 0::numeric) AS cash_collected_agendas_mes,
  COALESCE(b.meg_1, 0::bigint) AS meg_1,
  COALESCE(b.meg_2, 0::bigint) AS meg_2,
  COALESCE(b.personalizado, 0::bigint) AS personalizado,
  COALESCE(b.renovacion_meg_personalizado, 0::bigint) AS renovacion_meg_personalizado,
  COALESCE(b.reportes_financieros, 0::bigint) AS reportes_financieros,
  COALESCE(b.renovacion_meg, 0::bigint) AS renovacion_meg,
  COALESCE(b.renovacion_meg_2, 0::bigint) AS renovacion_meg_2,
  COALESCE(b.meg_2_1, 0::bigint) AS meg_2_1,
  COALESCE(b.renovacion_meg_2_1, 0::bigint) AS renovacion_meg_2_1,
  COALESCE(fa.facturacion_f_agenda, 0::numeric) AS facturacion_f_agenda,
  COALESCE(ca.cash_collected_agendas_mes, 0::numeric) AS cash_collected_agenda,
  COALESCE(cl.cce_llamada, COALESCE(b.cce_llamada, 0::bigint)) AS cce_llamada,
  COALESCE(cw.cce_whatsapp, COALESCE(b.cce_whatsapp, 0::bigint)) AS cce_whatsapp,
  COALESCE(cle.cce_llamada_efectuadas, 0::bigint) AS cce_llamada_efectuadas,
  COALESCE(cwe.cce_whatsapp_efectuadas, 0::bigint) AS cce_whatsapp_efectuadas,
  COALESCE(clv.cce_llamada_vendidas, 0::bigint) AS cce_llamada_vendidas,
  COALESCE(cwv.cce_whatsapp_vendidas, 0::bigint) AS cce_whatsapp_vendidas
FROM combos
LEFT JOIN base_norm b
  ON b.anio = combos.anio
 AND b.mes = combos.mes
 AND b.origen_key = combos.origen_key
 AND b.estrategia_key = combos.estrategia_key
LEFT JOIN fact_agg f
  ON f.anio = combos.anio
 AND f.mes = combos.mes
 AND f.origen_key = combos.origen_key
 AND f.estrategia_key = combos.estrategia_key
LEFT JOIN fact_agenda_agg fa
  ON fa.anio = combos.anio
 AND fa.mes = combos.mes
 AND fa.origen_key = combos.origen_key
 AND fa.estrategia_key = combos.estrategia_key
LEFT JOIN ventas_agg v
  ON v.anio = combos.anio
 AND v.mes = combos.mes
 AND v.origen_key = combos.origen_key
 AND v.estrategia_key = combos.estrategia_key
LEFT JOIN cash_real_agg cr
  ON cr.anio = combos.anio
 AND cr.mes = combos.mes
 AND cr.origen_key = combos.origen_key
 AND cr.estrategia_key = combos.estrategia_key
LEFT JOIN cash_agenda_agg ca
  ON ca.anio = combos.anio
 AND ca.mes = combos.mes
 AND ca.origen_key = combos.origen_key
 AND ca.estrategia_key = combos.estrategia_key
LEFT JOIN cash_otros_agg co
  ON co.anio = combos.anio
 AND co.mes = combos.mes
 AND co.origen_key = combos.origen_key
 AND co.estrategia_key = combos.estrategia_key
LEFT JOIN cce_llamada_agg cl
  ON cl.anio = combos.anio
 AND cl.mes = combos.mes
 AND cl.origen_key = combos.origen_key
 AND cl.estrategia_key = combos.estrategia_key
LEFT JOIN cce_llamada_efectuadas_agg cle
  ON cle.anio = combos.anio
 AND cle.mes = combos.mes
 AND cle.origen_key = combos.origen_key
 AND cle.estrategia_key = combos.estrategia_key
LEFT JOIN cce_whatsapp_agg cw
  ON cw.anio = combos.anio
 AND cw.mes = combos.mes
 AND cw.origen_key = combos.origen_key
 AND cw.estrategia_key = combos.estrategia_key
LEFT JOIN cce_whatsapp_efectuadas_agg cwe
  ON cwe.anio = combos.anio
 AND cwe.mes = combos.mes
 AND cwe.origen_key = combos.origen_key
 AND cwe.estrategia_key = combos.estrategia_key
LEFT JOIN cce_llamada_vendidas_agg clv
  ON clv.anio = combos.anio
 AND clv.mes = combos.mes
 AND clv.origen_key = combos.origen_key
 AND clv.estrategia_key = combos.estrategia_key
LEFT JOIN cce_whatsapp_vendidas_agg cwv
  ON cwv.anio = combos.anio
 AND cwv.mes = combos.mes
 AND cwv.origen_key = combos.origen_key
 AND cwv.estrategia_key = combos.estrategia_key;
