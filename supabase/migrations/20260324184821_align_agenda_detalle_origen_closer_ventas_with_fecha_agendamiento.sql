CREATE OR REPLACE VIEW public.agenda_detalle_por_origen_closer AS
WITH fecha_actual AS (
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy_ar
),
base_norm AS (
  SELECT
    b.anio,
    b.mes,
    b.origen,
    b.closer,
    b.total_leads,
    b.total_aplica,
    b.total_efectuadas,
    b.total_ventas,
    b.facturacion_total,
    b.cash_collected_total,
    b.total_paid_upfront,
    b.tasa_cierre,
    b.aov,
    b.ccne,
    b.ccne_efectuadas,
    b.ccne_vendidas,
    b.cce,
    b.cce_efectuadas,
    b.cce_vendidas,
    b.meg_1,
    b.meg_2,
    b.personalizado,
    b.reportes_financieros,
    b.renovacion_meg,
    b.renovacion_meg_2,
    b.meg_2_1,
    b.renovacion_meg_2_1,
    b.renovacion_meg_personalizado,
    b.total_respondio,
    b.total_confirmo,
    b.total_cancelado,
    b.total_no_asistidas,
    b.total_pendientes,
    COALESCE(NULLIF(BTRIM(b.origen), ''), 'Sin origen') AS origen_key,
    COALESCE(NULLIF(BTRIM(b.closer), ''), 'Sin closer') AS closer_key
  FROM public.agenda_detalle_por_origen_closer_base b
),
base_agg AS (
  SELECT
    anio,
    mes,
    origen_key,
    closer_key,
    SUM(COALESCE(total_leads, 0::bigint))::bigint AS total_leads,
    SUM(COALESCE(total_aplica, 0::bigint))::bigint AS total_aplica,
    SUM(COALESCE(total_efectuadas, 0::bigint))::bigint AS total_efectuadas,
    SUM(COALESCE(total_paid_upfront, 0::numeric)) AS total_paid_upfront,
    SUM(COALESCE(ccne, 0::bigint))::bigint AS ccne,
    SUM(COALESCE(ccne_efectuadas, 0::bigint))::bigint AS ccne_efectuadas,
    SUM(COALESCE(ccne_vendidas, 0::bigint))::bigint AS ccne_vendidas,
    SUM(COALESCE(cce, 0::bigint))::bigint AS cce,
    SUM(COALESCE(cce_efectuadas, 0::bigint))::bigint AS cce_efectuadas,
    SUM(COALESCE(cce_vendidas, 0::bigint))::bigint AS cce_vendidas,
    SUM(COALESCE(meg_1, 0::bigint))::bigint AS meg_1,
    SUM(COALESCE(meg_2, 0::bigint))::bigint AS meg_2,
    SUM(COALESCE(personalizado, 0::bigint))::bigint AS personalizado,
    SUM(COALESCE(reportes_financieros, 0::bigint))::bigint AS reportes_financieros,
    SUM(COALESCE(renovacion_meg, 0::bigint))::bigint AS renovacion_meg,
    SUM(COALESCE(renovacion_meg_2, 0::bigint))::bigint AS renovacion_meg_2,
    SUM(COALESCE(meg_2_1, 0::bigint))::bigint AS meg_2_1,
    SUM(COALESCE(renovacion_meg_2_1, 0::bigint))::bigint AS renovacion_meg_2_1,
    SUM(COALESCE(renovacion_meg_personalizado, 0::bigint))::bigint AS renovacion_meg_personalizado,
    SUM(COALESCE(total_respondio, 0::bigint))::bigint AS total_respondio,
    SUM(COALESCE(total_confirmo, 0::bigint))::bigint AS total_confirmo,
    SUM(COALESCE(total_cancelado, 0::bigint))::bigint AS total_cancelado,
    SUM(COALESCE(total_no_asistidas, 0::bigint))::bigint AS total_no_asistidas,
    SUM(COALESCE(total_pendientes, 0::bigint))::bigint AS total_pendientes
  FROM base_norm
  GROUP BY anio, mes, origen_key, closer_key
),
comprobantes_facturacion AS (
  SELECT
    EXTRACT(YEAR FROM c.f_venta)::int AS venta_anio,
    EXTRACT(MONTH FROM c.f_venta)::int AS venta_mes,
    CASE
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(c.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(c.creado_por), ''), 'Sin closer') AS closer_key,
    COALESCE(c.facturacion, 0)::numeric AS facturacion
  FROM public.comprobantes c
  WHERE
    c.f_venta IS NOT NULL
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
    COALESCE(NULLIF(BTRIM(c.creado_por), ''), 'Sin closer') AS closer_key,
    EXTRACT(YEAR FROM c.fecha_de_agendamiento)::int AS agenda_anio,
    EXTRACT(MONTH FROM c.fecha_de_agendamiento)::int AS agenda_mes
  FROM public.comprobantes c
  WHERE
    c.fecha_de_agendamiento IS NOT NULL
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
    COALESCE(NULLIF(BTRIM(c.creado_por), ''), 'Sin closer') AS closer_key,
    EXTRACT(YEAR FROM c.f_acreditacion)::int AS acreditacion_anio,
    EXTRACT(MONTH FROM c.f_acreditacion)::int AS acreditacion_mes,
    (c.f_acreditacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS acreditacion_fecha_ar,
    COALESCE(c.cash_collected, 0)::numeric AS cash_monto
  FROM public.comprobantes c
  WHERE
    c.f_acreditacion IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) IN ('venta', 'cobranza')
    AND (
      NULLIF(BTRIM(c.producto_format), '') IS NULL
      OR LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
    )
),
comprobantes_cash_filtrados AS (
  SELECT cc.*
  FROM comprobantes_cash cc
  CROSS JOIN fecha_actual fa
  WHERE
    cc.acreditacion_anio IS NOT NULL
    AND cc.acreditacion_mes IS NOT NULL
    AND (
      cc.acreditacion_anio <> EXTRACT(YEAR FROM fa.hoy_ar)::int
      OR cc.acreditacion_mes <> EXTRACT(MONTH FROM fa.hoy_ar)::int
      OR cc.acreditacion_fecha_ar <= fa.hoy_ar
    )
),
fact_agg AS (
  SELECT
    venta_anio AS anio,
    venta_mes AS mes,
    origen_key,
    closer_key,
    SUM(facturacion)::numeric AS facturacion_total
  FROM comprobantes_facturacion
  GROUP BY venta_anio, venta_mes, origen_key, closer_key
),
ventas_agg AS (
  SELECT
    agenda_anio AS anio,
    agenda_mes AS mes,
    origen_key,
    closer_key,
    COUNT(*)::bigint AS total_ventas_comp
  FROM comprobantes_ventas_agenda
  GROUP BY agenda_anio, agenda_mes, origen_key, closer_key
),
cash_real_agg AS (
  SELECT
    acreditacion_anio AS anio,
    acreditacion_mes AS mes,
    origen_key,
    closer_key,
    SUM(cash_monto)::numeric AS cash_collected_total
  FROM comprobantes_cash_filtrados
  GROUP BY acreditacion_anio, acreditacion_mes, origen_key, closer_key
),
combos AS (
  SELECT anio, mes, origen_key, closer_key FROM base_agg
  UNION
  SELECT anio, mes, origen_key, closer_key FROM fact_agg
  UNION
  SELECT anio, mes, origen_key, closer_key FROM ventas_agg
  UNION
  SELECT anio, mes, origen_key, closer_key FROM cash_real_agg
)
SELECT
  combos.anio,
  combos.mes,
  combos.origen_key AS origen,
  combos.closer_key AS closer,
  COALESCE(b.total_leads, 0::bigint) AS total_leads,
  COALESCE(b.total_aplica, 0::bigint) AS total_aplica,
  COALESCE(b.total_efectuadas, 0::bigint) AS total_efectuadas,
  COALESCE(v.total_ventas_comp, 0::bigint) AS total_ventas,
  COALESCE(f.facturacion_total, 0::numeric) AS facturacion_total,
  COALESCE(c.cash_collected_total, 0::numeric) AS cash_collected_total,
  COALESCE(b.total_paid_upfront, 0::numeric) AS total_paid_upfront,
  CASE
    WHEN COALESCE(b.total_aplica, 0::bigint) > 0
      THEN COALESCE(v.total_ventas_comp, 0::bigint)::numeric / b.total_aplica::numeric
    ELSE 0::numeric
  END AS tasa_cierre,
  CASE
    WHEN COALESCE(v.total_ventas_comp, 0::bigint) > 0
      THEN COALESCE(f.facturacion_total, 0::numeric) / v.total_ventas_comp::numeric
    ELSE 0::numeric
  END AS aov,
  COALESCE(b.ccne, 0::bigint) AS ccne,
  COALESCE(b.ccne_efectuadas, 0::bigint) AS ccne_efectuadas,
  COALESCE(b.ccne_vendidas, 0::bigint) AS ccne_vendidas,
  COALESCE(b.cce, 0::bigint) AS cce,
  COALESCE(b.cce_efectuadas, 0::bigint) AS cce_efectuadas,
  COALESCE(b.cce_vendidas, 0::bigint) AS cce_vendidas,
  COALESCE(b.meg_1, 0::bigint) AS meg_1,
  COALESCE(b.meg_2, 0::bigint) AS meg_2,
  COALESCE(b.personalizado, 0::bigint) AS personalizado,
  COALESCE(b.reportes_financieros, 0::bigint) AS reportes_financieros,
  COALESCE(b.renovacion_meg, 0::bigint) AS renovacion_meg,
  COALESCE(b.renovacion_meg_2, 0::bigint) AS renovacion_meg_2,
  COALESCE(b.meg_2_1, 0::bigint) AS meg_2_1,
  COALESCE(b.renovacion_meg_2_1, 0::bigint) AS renovacion_meg_2_1,
  COALESCE(b.renovacion_meg_personalizado, 0::bigint) AS renovacion_meg_personalizado,
  COALESCE(b.total_respondio, 0::bigint) AS total_respondio,
  COALESCE(b.total_confirmo, 0::bigint) AS total_confirmo,
  COALESCE(b.total_cancelado, 0::bigint) AS total_cancelado,
  COALESCE(b.total_no_asistidas, 0::bigint) AS total_no_asistidas,
  COALESCE(b.total_pendientes, 0::bigint) AS total_pendientes
FROM combos
LEFT JOIN base_agg b
  ON b.anio = combos.anio
 AND b.mes = combos.mes
 AND b.origen_key = combos.origen_key
 AND b.closer_key = combos.closer_key
LEFT JOIN fact_agg f
  ON f.anio = combos.anio
 AND f.mes = combos.mes
 AND f.origen_key = combos.origen_key
 AND f.closer_key = combos.closer_key
LEFT JOIN ventas_agg v
  ON v.anio = combos.anio
 AND v.mes = combos.mes
 AND v.origen_key = combos.origen_key
 AND v.closer_key = combos.closer_key
LEFT JOIN cash_real_agg c
  ON c.anio = combos.anio
 AND c.mes = combos.mes
 AND c.origen_key = combos.origen_key
 AND c.closer_key = combos.closer_key;
