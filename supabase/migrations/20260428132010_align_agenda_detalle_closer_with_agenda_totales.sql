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
    b.total_respondio,
    b.total_confirmo,
    b.total_cancelado,
    b.total_no_asistidas,
    b.total_pendientes,
    b.total_efectuadas,
    b.total_paid_upfront,
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
    COALESCE(NULLIF(BTRIM(b.origen), ''), 'Sin origen') AS origen_key,
    CASE
      WHEN LOWER(BTRIM(COALESCE(b.closer, ''))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(BTRIM(COALESCE(b.closer, ''))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(NULLIF(BTRIM(b.closer), ''), 'Sin closer')
    END AS closer_key
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
    SUM(COALESCE(total_respondio, 0::bigint))::bigint AS total_respondio,
    SUM(COALESCE(total_confirmo, 0::bigint))::bigint AS total_confirmo,
    SUM(COALESCE(total_cancelado, 0::bigint))::bigint AS total_cancelado,
    SUM(COALESCE(total_no_asistidas, 0::bigint))::bigint AS total_no_asistidas,
    SUM(COALESCE(total_pendientes, 0::bigint))::bigint AS total_pendientes,
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
    SUM(COALESCE(renovacion_meg_personalizado, 0::bigint))::bigint AS renovacion_meg_personalizado
  FROM base_norm
  GROUP BY anio, mes, origen_key, closer_key
),
leads_base AS (
  SELECT
    EXTRACT(YEAR FROM l.fecha_agenda)::integer AS anio,
    EXTRACT(MONTH FROM l.fecha_agenda)::integer AS mes,
    CASE
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%CLASES%' OR UPPER(COALESCE(l.origen, '')) LIKE '%CLASE%' THEN 'CLASES'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(l.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(l.origen), ''), 'Sin origen')
    END AS origen_key,
    CASE
      WHEN LOWER(BTRIM(COALESCE(l.closer, ''))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(BTRIM(COALESCE(l.closer, ''))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(NULLIF(BTRIM(l.closer), ''), 'Sin closer')
    END AS closer_key,
    NULLIF(BTRIM(l.ghlid), '') AS ghlid,
    l.agendo,
    l.aplica,
    l.llamada_meg,
    l.call_confirm,
    l.llamada_cc,
    l.cc_whatsapp
  FROM public.leads_raw l
  WHERE l.fecha_agenda IS NOT NULL
),
lead_channel_agg AS (
  SELECT
    anio,
    mes,
    origen_key,
    closer_key,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND (call_confirm = 'Exitoso' OR llamada_cc = 'Exitoso')
    )::bigint AS cce_llamada,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND (call_confirm = 'Exitoso' OR llamada_cc = 'Exitoso')
        AND llamada_meg = 'Efectuada'
    )::bigint AS cce_llamada_efectuadas,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND cc_whatsapp = 'Exitoso'
    )::bigint AS cce_whatsapp,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND cc_whatsapp = 'Exitoso'
        AND llamada_meg = 'Efectuada'
    )::bigint AS cce_whatsapp_efectuadas
  FROM leads_base
  GROUP BY anio, mes, origen_key, closer_key
),
lead_channels_by_ghlid AS (
  SELECT
    ghlid,
    BOOL_OR(
      agendo = 'Agendo'
      AND aplica = 'Aplica'
      AND (call_confirm = 'Exitoso' OR llamada_cc = 'Exitoso')
    ) AS has_cce_llamada,
    BOOL_OR(
      agendo = 'Agendo'
      AND aplica = 'Aplica'
      AND cc_whatsapp = 'Exitoso'
    ) AS has_cce_whatsapp
  FROM leads_base
  WHERE ghlid IS NOT NULL
  GROUP BY ghlid
),
comprobantes_base AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%CLASES%' OR UPPER(COALESCE(c.origen, '')) LIKE '%CLASE%' THEN 'CLASES'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(c.origen), ''), 'Sin origen')
    END AS origen_key,
    CASE
      WHEN LOWER(BTRIM(COALESCE(c.creado_por, ''))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(BTRIM(COALESCE(c.creado_por, ''))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(NULLIF(BTRIM(c.creado_por), ''), 'Sin closer')
    END AS closer_key,
    EXTRACT(YEAR FROM c.f_venta)::integer AS venta_anio,
    EXTRACT(MONTH FROM c.f_venta)::integer AS venta_mes,
    EXTRACT(YEAR FROM c.fecha_de_agendamiento)::integer AS agenda_anio,
    EXTRACT(MONTH FROM c.fecha_de_agendamiento)::integer AS agenda_mes,
    EXTRACT(YEAR FROM c.f_acreditacion)::integer AS acreditacion_anio,
    EXTRACT(MONTH FROM c.f_acreditacion)::integer AS acreditacion_mes,
    (c.f_acreditacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS acreditacion_fecha_ar,
    NULLIF(BTRIM(c.ghlid), '') AS ghlid,
    COALESCE(c.facturacion, 0::numeric) AS facturacion,
    COALESCE(c.cash_collected, 0::numeric) AS cash_monto,
    LOWER(BTRIM(COALESCE(c.tipo, ''))) AS tipo_norm,
    c.producto_format
  FROM public.comprobantes c
),
comprobantes_facturacion AS (
  SELECT *
  FROM comprobantes_base
  WHERE venta_anio IS NOT NULL
    AND tipo_norm = 'venta'
    AND public.metricas_is_valid_sale_product(producto_format)
),
comprobantes_facturacion_agenda AS (
  SELECT *
  FROM comprobantes_base
  WHERE agenda_anio IS NOT NULL
    AND tipo_norm = 'venta'
    AND public.metricas_is_valid_sale_product(producto_format)
),
comprobantes_ventas_agenda AS (
  SELECT *
  FROM comprobantes_base
  WHERE agenda_anio IS NOT NULL
    AND tipo_norm = 'venta'
    AND public.metricas_is_valid_sale_product(producto_format)
),
comprobantes_cash AS (
  SELECT *
  FROM comprobantes_base
  WHERE acreditacion_anio IS NOT NULL
    AND tipo_norm IN ('venta', 'cobranza')
    AND public.metricas_is_non_club_product(producto_format)
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
    closer_key,
    SUM(facturacion) AS facturacion_total_mes
  FROM comprobantes_facturacion
  GROUP BY venta_anio, venta_mes, origen_key, closer_key
),
fact_agenda_agg AS (
  SELECT
    agenda_anio AS anio,
    agenda_mes AS mes,
    origen_key,
    closer_key,
    SUM(facturacion) AS facturacion_f_agenda
  FROM comprobantes_facturacion_agenda
  GROUP BY agenda_anio, agenda_mes, origen_key, closer_key
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
ventas_channel_agg AS (
  SELECT
    c.agenda_anio AS anio,
    c.agenda_mes AS mes,
    c.origen_key,
    c.closer_key,
    COUNT(*) FILTER (WHERE lg.has_cce_llamada)::bigint AS cce_llamada_vendidas,
    COUNT(*) FILTER (WHERE lg.has_cce_whatsapp)::bigint AS cce_whatsapp_vendidas
  FROM comprobantes_ventas_agenda c
  LEFT JOIN lead_channels_by_ghlid lg
    ON lg.ghlid = c.ghlid
  GROUP BY c.agenda_anio, c.agenda_mes, c.origen_key, c.closer_key
),
cash_real_agg AS (
  SELECT
    acreditacion_anio AS anio,
    acreditacion_mes AS mes,
    origen_key,
    closer_key,
    SUM(cash_monto) AS cash_collected_real_mes
  FROM comprobantes_cash_filtrados
  GROUP BY acreditacion_anio, acreditacion_mes, origen_key, closer_key
),
cash_agenda_agg AS (
  SELECT
    acreditacion_anio AS anio,
    acreditacion_mes AS mes,
    origen_key,
    closer_key,
    SUM(cash_monto) AS cash_collected_agendas_mes
  FROM comprobantes_cash_filtrados
  WHERE agenda_anio = acreditacion_anio
    AND agenda_mes = acreditacion_mes
  GROUP BY acreditacion_anio, acreditacion_mes, origen_key, closer_key
),
cash_otros_agg AS (
  SELECT
    acreditacion_anio AS anio,
    acreditacion_mes AS mes,
    origen_key,
    closer_key,
    SUM(cash_monto) AS cash_collected_otros_meses
  FROM comprobantes_cash_filtrados
  WHERE agenda_anio IS NULL
    OR agenda_mes IS NULL
    OR agenda_anio <> acreditacion_anio
    OR agenda_mes <> acreditacion_mes
  GROUP BY acreditacion_anio, acreditacion_mes, origen_key, closer_key
),
combos AS (
  SELECT anio, mes, origen_key, closer_key FROM base_agg
  UNION
  SELECT anio, mes, origen_key, closer_key FROM lead_channel_agg
  UNION
  SELECT anio, mes, origen_key, closer_key FROM fact_agg
  UNION
  SELECT anio, mes, origen_key, closer_key FROM fact_agenda_agg
  UNION
  SELECT anio, mes, origen_key, closer_key FROM ventas_agg
  UNION
  SELECT anio, mes, origen_key, closer_key FROM ventas_channel_agg
  UNION
  SELECT anio, mes, origen_key, closer_key FROM cash_real_agg
  UNION
  SELECT anio, mes, origen_key, closer_key FROM cash_agenda_agg
  UNION
  SELECT anio, mes, origen_key, closer_key FROM cash_otros_agg
)
SELECT
  combos.anio,
  combos.mes,
  combos.origen_key AS origen,
  combos.closer_key AS closer,
  COALESCE(b.total_leads, 0::bigint) AS total_leads,
  COALESCE(b.total_leads, 0::bigint) AS total_agendados,
  COALESCE(b.total_aplica, 0::bigint) AS total_aplica,
  COALESCE(b.total_respondio, 0::bigint) AS total_respondio,
  COALESCE(b.total_confirmo, 0::bigint) AS total_confirmo,
  COALESCE(b.total_cancelado, 0::bigint) AS total_cancelado,
  COALESCE(b.total_no_asistidas, 0::bigint) AS total_no_asistidas,
  COALESCE(b.total_pendientes, 0::bigint) AS total_pendientes,
  COALESCE(b.total_efectuadas, 0::bigint) AS total_efectuadas,
  COALESCE(v.total_ventas_comp, 0::bigint) AS total_ventas,
  COALESCE(b.total_paid_upfront, 0::numeric) AS total_paid_upfront,
  CASE
    WHEN COALESCE(v.total_ventas_comp, 0::bigint) > 0
      THEN COALESCE(f.facturacion_total_mes, 0::numeric) / v.total_ventas_comp::numeric
    ELSE 0::numeric
  END AS aov,
  CASE
    WHEN COALESCE(b.total_leads, 0::bigint) > 0
      THEN COALESCE(v.total_ventas_comp, 0::bigint)::numeric / b.total_leads::numeric * 100::numeric
    ELSE 0::numeric
  END AS tasa_cierre,
  COALESCE(b.ccne, 0::bigint) AS ccne,
  COALESCE(b.ccne_efectuadas, 0::bigint) AS ccne_efectuadas,
  COALESCE(b.ccne_vendidas, 0::bigint) AS ccne_vendidas,
  COALESCE(b.cce, 0::bigint) AS cce,
  COALESCE(lca.cce_llamada, 0::bigint) AS cce_llamada,
  COALESCE(lca.cce_llamada_efectuadas, 0::bigint) AS cce_llamada_efectuadas,
  COALESCE(vca.cce_llamada_vendidas, 0::bigint) AS cce_llamada_vendidas,
  COALESCE(lca.cce_whatsapp, 0::bigint) AS cce_whatsapp,
  COALESCE(lca.cce_whatsapp_efectuadas, 0::bigint) AS cce_whatsapp_efectuadas,
  COALESCE(vca.cce_whatsapp_vendidas, 0::bigint) AS cce_whatsapp_vendidas,
  COALESCE(b.cce_efectuadas, 0::bigint) AS cce_efectuadas,
  COALESCE(b.cce_vendidas, 0::bigint) AS cce_vendidas,
  COALESCE(f.facturacion_total_mes, 0::numeric) AS facturacion_total,
  COALESCE(f.facturacion_total_mes, 0::numeric) AS facturacion_total_mes,
  COALESCE(fa.facturacion_f_agenda, 0::numeric) AS facturacion_f_agenda,
  COALESCE(cr.cash_collected_real_mes, 0::numeric) AS cash_collected_total,
  COALESCE(cr.cash_collected_real_mes, 0::numeric) AS cash_collected_real_mes,
  COALESCE(co.cash_collected_otros_meses, 0::numeric) AS cash_collected_otros_meses,
  COALESCE(ca.cash_collected_agendas_mes, 0::numeric) AS cash_collected_agendas_mes,
  COALESCE(ca.cash_collected_agendas_mes, 0::numeric) AS cash_collected_agenda,
  COALESCE(b.meg_1, 0::bigint) AS meg_1,
  COALESCE(b.meg_2, 0::bigint) AS meg_2,
  COALESCE(b.personalizado, 0::bigint) AS personalizado,
  COALESCE(b.reportes_financieros, 0::bigint) AS reportes_financieros,
  COALESCE(b.renovacion_meg, 0::bigint) AS renovacion_meg,
  COALESCE(b.renovacion_meg_2, 0::bigint) AS renovacion_meg_2,
  COALESCE(b.meg_2_1, 0::bigint) AS meg_2_1,
  COALESCE(b.renovacion_meg_2_1, 0::bigint) AS renovacion_meg_2_1,
  COALESCE(b.renovacion_meg_personalizado, 0::bigint) AS renovacion_meg_personalizado
FROM combos
LEFT JOIN base_agg b
  ON b.anio = combos.anio
 AND b.mes = combos.mes
 AND b.origen_key = combos.origen_key
 AND b.closer_key = combos.closer_key
LEFT JOIN lead_channel_agg lca
  ON lca.anio = combos.anio
 AND lca.mes = combos.mes
 AND lca.origen_key = combos.origen_key
 AND lca.closer_key = combos.closer_key
LEFT JOIN fact_agg f
  ON f.anio = combos.anio
 AND f.mes = combos.mes
 AND f.origen_key = combos.origen_key
 AND f.closer_key = combos.closer_key
LEFT JOIN fact_agenda_agg fa
  ON fa.anio = combos.anio
 AND fa.mes = combos.mes
 AND fa.origen_key = combos.origen_key
 AND fa.closer_key = combos.closer_key
LEFT JOIN ventas_agg v
  ON v.anio = combos.anio
 AND v.mes = combos.mes
 AND v.origen_key = combos.origen_key
 AND v.closer_key = combos.closer_key
LEFT JOIN ventas_channel_agg vca
  ON vca.anio = combos.anio
 AND vca.mes = combos.mes
 AND vca.origen_key = combos.origen_key
 AND vca.closer_key = combos.closer_key
LEFT JOIN cash_real_agg cr
  ON cr.anio = combos.anio
 AND cr.mes = combos.mes
 AND cr.origen_key = combos.origen_key
 AND cr.closer_key = combos.closer_key
LEFT JOIN cash_agenda_agg ca
  ON ca.anio = combos.anio
 AND ca.mes = combos.mes
 AND ca.origen_key = combos.origen_key
 AND ca.closer_key = combos.closer_key
LEFT JOIN cash_otros_agg co
  ON co.anio = combos.anio
 AND co.mes = combos.mes
 AND co.origen_key = combos.origen_key
 AND co.closer_key = combos.closer_key;
