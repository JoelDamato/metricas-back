ALTER TABLE IF EXISTS public.leads_raw
  ADD COLUMN IF NOT EXISTS ultimo_origen text;

ALTER TABLE IF EXISTS public.comprobantes
  ADD COLUMN IF NOT EXISTS ultimo_origen text;

CREATE OR REPLACE FUNCTION public.metricas_normalize_origen(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value ILIKE '%APSET%' THEN 'APSET'
    WHEN value ILIKE '%CLASES%' OR value ILIKE '%CLASE%' THEN 'CLASES'
    WHEN value ILIKE '%ORG%' THEN 'ORG'
    WHEN value ILIKE '%VSL%' THEN 'VSL'
    WHEN value ILIKE '%Lanzamiento%' THEN 'LANZ'
    WHEN value ILIKE '%Evergreen%' THEN 'EVERG'
    WHEN value ILIKE '%Club%' THEN 'CLUB'
    WHEN NULLIF(BTRIM(value), '') IS NULL THEN 'Sin origen'
    ELSE BTRIM(value)
  END;
$$;

CREATE OR REPLACE VIEW public.agenda_totales_ultimo_origen AS
WITH fecha_actual AS (
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy_ar
),
lead_latest_ghl AS (
  SELECT DISTINCT ON (NULLIF(BTRIM(ghlid), ''))
    NULLIF(BTRIM(ghlid), '') AS ghlid_key,
    public.metricas_normalize_origen(COALESCE(NULLIF(BTRIM(ultimo_origen), ''), origen)) AS origen_key,
    COALESCE(NULLIF(BTRIM(estrategia_a), ''), 'Sin estrategia') AS estrategia_key
  FROM public.leads_raw
  WHERE NULLIF(BTRIM(ghlid), '') IS NOT NULL
  ORDER BY NULLIF(BTRIM(ghlid), ''), last_edited_time DESC NULLS LAST, created_time DESC NULLS LAST
),
lead_latest_mail AS (
  SELECT DISTINCT ON (LOWER(NULLIF(BTRIM(mail), '')))
    LOWER(NULLIF(BTRIM(mail), '')) AS mail_key,
    public.metricas_normalize_origen(COALESCE(NULLIF(BTRIM(ultimo_origen), ''), origen)) AS origen_key,
    COALESCE(NULLIF(BTRIM(estrategia_a), ''), 'Sin estrategia') AS estrategia_key
  FROM public.leads_raw
  WHERE NULLIF(BTRIM(mail), '') IS NOT NULL
  ORDER BY LOWER(NULLIF(BTRIM(mail), '')), last_edited_time DESC NULLS LAST, created_time DESC NULLS LAST
),
lead_norm AS (
  SELECT
    l.*,
    public.metricas_normalize_origen(COALESCE(NULLIF(BTRIM(l.ultimo_origen), ''), l.origen)) AS origen_key,
    COALESCE(NULLIF(BTRIM(l.estrategia_a), ''), 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM l.fecha_agenda)::integer AS anio,
    EXTRACT(MONTH FROM l.fecha_agenda)::integer AS mes
  FROM public.leads_raw l
  WHERE l.fecha_agenda IS NOT NULL
),
base_agg AS (
  SELECT
    origen_key,
    estrategia_key,
    anio,
    mes,
    COUNT(*) FILTER (WHERE agendo = 'Agendo') AS total_agendados,
    COUNT(*) FILTER (WHERE aplica = 'Aplica') AS total_aplica,
    COUNT(*) FILTER (WHERE agendo = 'Agendo' AND aplica = 'Aplica' AND respondio_apertura = 'Respondio') AS total_respondio,
    COUNT(*) FILTER (WHERE agendo = 'Agendo' AND aplica = 'Aplica' AND respondio_apertura = 'Respondio' AND confirmo_mensaje = 'Confirmo') AS total_confirmo,
    COUNT(*) FILTER (WHERE agendo = 'Agendo' AND aplica = 'Aplica' AND llamada_meg = 'Cancelado') AS total_cancelado,
    COUNT(*) FILTER (WHERE agendo = 'Agendo' AND aplica = 'Aplica' AND llamada_meg = 'No show') AS total_no_asistidas,
    COUNT(*) FILTER (WHERE agendo = 'Agendo' AND aplica = 'Aplica' AND (llamada_meg = 'Pendiente' OR llamada_meg IS NULL)) AS total_pendientes,
    COUNT(*) FILTER (WHERE agendo = 'Agendo' AND aplica = 'Aplica' AND llamada_meg = 'Efectuada') AS total_efectuadas,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND (call_confirm IS NULL OR BTRIM(call_confirm) = '' OR LOWER(BTRIM(call_confirm)) <> 'exitoso')
        AND (llamada_cc IS NULL OR BTRIM(llamada_cc) = '' OR LOWER(BTRIM(llamada_cc)) <> 'exitoso')
        AND (cc_whatsapp IS NULL OR BTRIM(cc_whatsapp) = '' OR LOWER(BTRIM(cc_whatsapp)) <> 'exitoso')
    ) AS ccne,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND (call_confirm IS NULL OR BTRIM(call_confirm) = '' OR LOWER(BTRIM(call_confirm)) <> 'exitoso')
        AND (llamada_cc IS NULL OR BTRIM(llamada_cc) = '' OR LOWER(BTRIM(llamada_cc)) <> 'exitoso')
        AND (cc_whatsapp IS NULL OR BTRIM(cc_whatsapp) = '' OR LOWER(BTRIM(cc_whatsapp)) <> 'exitoso')
        AND llamada_meg = 'Efectuada'
    ) AS ccne_efectuadas,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND (call_confirm = 'Exitoso' OR llamada_cc = 'Exitoso' OR cc_whatsapp = 'Exitoso')
    ) AS cce,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND (call_confirm = 'Exitoso' OR llamada_cc = 'Exitoso' OR cc_whatsapp = 'Exitoso')
        AND llamada_meg = 'Efectuada'
    ) AS cce_efectuadas,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND (call_confirm = 'Exitoso' OR llamada_cc = 'Exitoso')
    ) AS cce_llamada,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND (call_confirm = 'Exitoso' OR llamada_cc = 'Exitoso')
        AND llamada_meg = 'Efectuada'
    ) AS cce_llamada_efectuadas,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND cc_whatsapp = 'Exitoso'
    ) AS cce_whatsapp,
    COUNT(*) FILTER (
      WHERE agendo = 'Agendo'
        AND aplica = 'Aplica'
        AND cc_whatsapp = 'Exitoso'
        AND llamada_meg = 'Efectuada'
    ) AS cce_whatsapp_efectuadas
  FROM lead_norm
  GROUP BY origen_key, estrategia_key, anio, mes
),
lead_channel_flags AS (
  SELECT
    NULLIF(BTRIM(ghlid), '') AS ghlid_key,
    BOOL_OR(agendo = 'Agendo' AND aplica = 'Aplica' AND (call_confirm = 'Exitoso' OR llamada_cc = 'Exitoso')) AS cce_llamada,
    BOOL_OR(agendo = 'Agendo' AND aplica = 'Aplica' AND cc_whatsapp = 'Exitoso') AS cce_whatsapp
  FROM public.leads_raw
  WHERE NULLIF(BTRIM(ghlid), '') IS NOT NULL
  GROUP BY NULLIF(BTRIM(ghlid), '')
),
comp_norm AS (
  SELECT
    c.*,
    public.metricas_normalize_origen(COALESCE(NULLIF(BTRIM(c.ultimo_origen), ''), lg.origen_key, lm.origen_key, c.origen)) AS origen_key,
    COALESCE(NULLIF(BTRIM(c.estrategia_a), ''), lg.estrategia_key, lm.estrategia_key, 'Sin estrategia') AS estrategia_key,
    EXTRACT(YEAR FROM c.f_venta)::integer AS venta_anio,
    EXTRACT(MONTH FROM c.f_venta)::integer AS venta_mes,
    EXTRACT(YEAR FROM c.fecha_de_agendamiento)::integer AS agenda_anio,
    EXTRACT(MONTH FROM c.fecha_de_agendamiento)::integer AS agenda_mes,
    EXTRACT(YEAR FROM c.f_acreditacion)::integer AS acreditacion_anio,
    EXTRACT(MONTH FROM c.f_acreditacion)::integer AS acreditacion_mes,
    (c.f_acreditacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS acreditacion_fecha_ar
  FROM public.comprobantes c
  LEFT JOIN lead_latest_ghl lg
    ON lg.ghlid_key = NULLIF(BTRIM(c.ghlid), '')
  LEFT JOIN lead_latest_mail lm
    ON lm.mail_key = LOWER(NULLIF(BTRIM(c.mail), ''))
),
ventas_agg AS (
  SELECT agenda_anio AS anio, agenda_mes AS mes, origen_key, estrategia_key, COUNT(*)::bigint AS total_ventas
  FROM comp_norm
  WHERE fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(tipo, '')) = 'venta'
    AND NULLIF(BTRIM(producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(producto_format)) <> 'empty'
    AND LOWER(BTRIM(producto_format)) NOT LIKE '%club%'
  GROUP BY agenda_anio, agenda_mes, origen_key, estrategia_key
),
paid_agg AS (
  SELECT agenda_anio AS anio, agenda_mes AS mes, origen_key, estrategia_key, SUM(COALESCE(cash_collected, 0::numeric)) AS total_paid_upfront
  FROM comp_norm
  WHERE fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(tipo, '')) = 'venta'
    AND NULLIF(BTRIM(producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(producto_format)) <> 'empty'
    AND LOWER(BTRIM(producto_format)) NOT LIKE '%club%'
  GROUP BY agenda_anio, agenda_mes, origen_key, estrategia_key
),
fact_agg AS (
  SELECT venta_anio AS anio, venta_mes AS mes, origen_key, estrategia_key, SUM(COALESCE(facturacion, 0::numeric)) AS facturacion_total_mes
  FROM comp_norm
  WHERE f_venta IS NOT NULL
    AND LOWER(COALESCE(tipo, '')) = 'venta'
    AND NULLIF(BTRIM(producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(producto_format)) <> 'empty'
    AND LOWER(BTRIM(producto_format)) NOT LIKE '%club%'
  GROUP BY venta_anio, venta_mes, origen_key, estrategia_key
),
fact_agenda_agg AS (
  SELECT agenda_anio AS anio, agenda_mes AS mes, origen_key, estrategia_key, SUM(COALESCE(facturacion, 0::numeric)) AS facturacion_f_agenda
  FROM comp_norm
  WHERE fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(tipo, '')) = 'venta'
    AND NULLIF(BTRIM(producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(producto_format)) <> 'empty'
    AND LOWER(BTRIM(producto_format)) NOT LIKE '%club%'
  GROUP BY agenda_anio, agenda_mes, origen_key, estrategia_key
),
cash_filtrado AS (
  SELECT c.*
  FROM comp_norm c
  CROSS JOIN fecha_actual fa
  WHERE c.f_acreditacion IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) = ANY (ARRAY['venta', 'cobranza'])
    AND (
      NULLIF(BTRIM(c.producto_format), '') IS NULL
      OR LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
    )
    AND (
      c.acreditacion_anio <> EXTRACT(YEAR FROM fa.hoy_ar)::integer
      OR c.acreditacion_mes <> EXTRACT(MONTH FROM fa.hoy_ar)::integer
      OR c.acreditacion_fecha_ar <= fa.hoy_ar
    )
),
cash_real_agg AS (
  SELECT acreditacion_anio AS anio, acreditacion_mes AS mes, origen_key, estrategia_key, SUM(COALESCE(cash_collected, 0::numeric)) AS cash_collected_real_mes
  FROM cash_filtrado
  GROUP BY acreditacion_anio, acreditacion_mes, origen_key, estrategia_key
),
cash_agenda_agg AS (
  SELECT acreditacion_anio AS anio, acreditacion_mes AS mes, origen_key, estrategia_key, SUM(COALESCE(cash_collected, 0::numeric)) AS cash_collected_agendas_mes
  FROM cash_filtrado
  WHERE agenda_anio = acreditacion_anio
    AND agenda_mes = acreditacion_mes
  GROUP BY acreditacion_anio, acreditacion_mes, origen_key, estrategia_key
),
cash_otros_agg AS (
  SELECT acreditacion_anio AS anio, acreditacion_mes AS mes, origen_key, estrategia_key, SUM(COALESCE(cash_collected, 0::numeric)) AS cash_collected_otros_meses
  FROM cash_filtrado
  WHERE agenda_anio IS NULL
    OR agenda_mes IS NULL
    OR agenda_anio <> acreditacion_anio
    OR agenda_mes <> acreditacion_mes
  GROUP BY acreditacion_anio, acreditacion_mes, origen_key, estrategia_key
),
cce_vendidas_agg AS (
  SELECT agenda_anio AS anio, agenda_mes AS mes, origen_key, estrategia_key, COUNT(*)::bigint AS cce_vendidas
  FROM comp_norm
  WHERE fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(tipo, '')) = 'venta'
    AND NULLIF(BTRIM(producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(producto_format)) <> 'empty'
    AND LOWER(BTRIM(producto_format)) NOT LIKE '%club%'
    AND estado_cc = 'Exitoso'
  GROUP BY agenda_anio, agenda_mes, origen_key, estrategia_key
),
ccne_vendidas_agg AS (
  SELECT agenda_anio AS anio, agenda_mes AS mes, origen_key, estrategia_key, COUNT(*)::bigint AS ccne_vendidas
  FROM comp_norm
  WHERE fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(tipo, '')) = 'venta'
    AND NULLIF(BTRIM(producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(producto_format)) <> 'empty'
    AND LOWER(BTRIM(producto_format)) NOT LIKE '%club%'
    AND estado_cc = 'No exitoso'
  GROUP BY agenda_anio, agenda_mes, origen_key, estrategia_key
),
cce_llamada_vendidas_agg AS (
  SELECT c.agenda_anio AS anio, c.agenda_mes AS mes, c.origen_key, c.estrategia_key, COUNT(*)::bigint AS cce_llamada_vendidas
  FROM comp_norm c
  INNER JOIN lead_channel_flags lf
    ON lf.ghlid_key = NULLIF(BTRIM(c.ghlid), '')
   AND lf.cce_llamada
  WHERE c.fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) = 'venta'
    AND NULLIF(BTRIM(c.producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(c.producto_format)) <> 'empty'
    AND LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
  GROUP BY c.agenda_anio, c.agenda_mes, c.origen_key, c.estrategia_key
),
cce_whatsapp_vendidas_agg AS (
  SELECT c.agenda_anio AS anio, c.agenda_mes AS mes, c.origen_key, c.estrategia_key, COUNT(*)::bigint AS cce_whatsapp_vendidas
  FROM comp_norm c
  INNER JOIN lead_channel_flags lf
    ON lf.ghlid_key = NULLIF(BTRIM(c.ghlid), '')
   AND lf.cce_whatsapp
  WHERE c.fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) = 'venta'
    AND NULLIF(BTRIM(c.producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(c.producto_format)) <> 'empty'
    AND LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
  GROUP BY c.agenda_anio, c.agenda_mes, c.origen_key, c.estrategia_key
),
prod_agg AS (
  SELECT
    agenda_anio AS anio,
    agenda_mes AS mes,
    origen_key,
    estrategia_key,
    COUNT(*) FILTER (WHERE producto_format = 'Meg 1.0') AS meg_1,
    COUNT(*) FILTER (WHERE producto_format = 'Meg 2.0') AS meg_2,
    COUNT(*) FILTER (WHERE producto_format = 'Meg Personalizado') AS personalizado,
    COUNT(*) FILTER (WHERE producto_format = 'Renovacion - Meg Personalizado') AS renovacion_meg_personalizado,
    COUNT(*) FILTER (WHERE producto_format = 'Reportes Financieros') AS reportes_financieros,
    COUNT(*) FILTER (WHERE producto_format = 'Renovacion - Meg 1.0') AS renovacion_meg,
    COUNT(*) FILTER (WHERE producto_format = 'Renovacion - Meg 2.0') AS renovacion_meg_2,
    COUNT(*) FILTER (WHERE producto_format = 'Meg 2.1') AS meg_2_1,
    COUNT(*) FILTER (WHERE producto_format = 'Renovacion - Meg 2.1') AS renovacion_meg_2_1
  FROM comp_norm
  WHERE fecha_de_agendamiento IS NOT NULL
    AND LOWER(COALESCE(tipo, '')) = 'venta'
  GROUP BY agenda_anio, agenda_mes, origen_key, estrategia_key
),
combos AS (
  SELECT anio, mes, origen_key, estrategia_key FROM base_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM ventas_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM paid_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM fact_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM fact_agenda_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM cash_real_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM cash_agenda_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM cash_otros_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM cce_vendidas_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM ccne_vendidas_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM cce_llamada_vendidas_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM cce_whatsapp_vendidas_agg
  UNION SELECT anio, mes, origen_key, estrategia_key FROM prod_agg
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
  COALESCE(v.total_ventas, 0::bigint) AS total_ventas,
  COALESCE(p.total_paid_upfront, 0::numeric) AS total_paid_upfront,
  CASE
    WHEN COALESCE(v.total_ventas, 0::bigint) > 0
      THEN COALESCE(p.total_paid_upfront, 0::numeric) / v.total_ventas::numeric
    ELSE 0::numeric
  END AS aov,
  CASE
    WHEN COALESCE(b.total_aplica, 0::bigint) > 0
      THEN COALESCE(v.total_ventas, 0::bigint)::numeric / b.total_aplica::numeric * 100::numeric
    ELSE 0::numeric
  END AS tasa_cierre,
  COALESCE(b.ccne, 0::bigint) AS ccne,
  COALESCE(b.ccne_efectuadas, 0::bigint) AS ccne_efectuadas,
  COALESCE(vne.ccne_vendidas, 0::bigint) AS ccne_vendidas,
  COALESCE(b.cce, 0::bigint) AS cce,
  COALESCE(b.cce_efectuadas, 0::bigint) AS cce_efectuadas,
  COALESCE(ve.cce_vendidas, 0::bigint) AS cce_vendidas,
  COALESCE(f.facturacion_total_mes, 0::numeric) AS facturacion_total_mes,
  COALESCE(cr.cash_collected_real_mes, 0::numeric) AS cash_collected_real_mes,
  COALESCE(co.cash_collected_otros_meses, 0::numeric) AS cash_collected_otros_meses,
  COALESCE(ca.cash_collected_agendas_mes, 0::numeric) AS cash_collected_agendas_mes,
  COALESCE(pr.meg_1, 0::bigint) AS meg_1,
  COALESCE(pr.meg_2, 0::bigint) AS meg_2,
  COALESCE(pr.personalizado, 0::bigint) AS personalizado,
  COALESCE(pr.renovacion_meg_personalizado, 0::bigint) AS renovacion_meg_personalizado,
  COALESCE(pr.reportes_financieros, 0::bigint) AS reportes_financieros,
  COALESCE(pr.renovacion_meg, 0::bigint) AS renovacion_meg,
  COALESCE(pr.renovacion_meg_2, 0::bigint) AS renovacion_meg_2,
  COALESCE(pr.meg_2_1, 0::bigint) AS meg_2_1,
  COALESCE(pr.renovacion_meg_2_1, 0::bigint) AS renovacion_meg_2_1,
  COALESCE(fa.facturacion_f_agenda, 0::numeric) AS facturacion_f_agenda,
  COALESCE(ca.cash_collected_agendas_mes, 0::numeric) AS cash_collected_agenda,
  COALESCE(b.cce_llamada, 0::bigint) AS cce_llamada,
  COALESCE(b.cce_whatsapp, 0::bigint) AS cce_whatsapp,
  COALESCE(b.cce_llamada_efectuadas, 0::bigint) AS cce_llamada_efectuadas,
  COALESCE(b.cce_whatsapp_efectuadas, 0::bigint) AS cce_whatsapp_efectuadas,
  COALESCE(vll.cce_llamada_vendidas, 0::bigint) AS cce_llamada_vendidas,
  COALESCE(vwp.cce_whatsapp_vendidas, 0::bigint) AS cce_whatsapp_vendidas
FROM combos
LEFT JOIN base_agg b USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN ventas_agg v USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN paid_agg p USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN fact_agg f USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN fact_agenda_agg fa USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN cash_real_agg cr USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN cash_agenda_agg ca USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN cash_otros_agg co USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN cce_vendidas_agg ve USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN ccne_vendidas_agg vne USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN cce_llamada_vendidas_agg vll USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN cce_whatsapp_vendidas_agg vwp USING (anio, mes, origen_key, estrategia_key)
LEFT JOIN prod_agg pr USING (anio, mes, origen_key, estrategia_key);
