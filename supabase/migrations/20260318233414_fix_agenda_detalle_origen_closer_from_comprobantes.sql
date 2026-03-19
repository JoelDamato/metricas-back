-- Ajuste de agenda_detalle_por_origen_closer
-- Facturacion / cash / ventas se calculan desde comprobantes:
-- - tipo = Venta
-- - producto_format no vacío y no club
-- - facturacion por mes de f_venta
-- - cash_collected_total por mes de f_acreditacion
-- - closer tomado desde creado_por (coincide con ranking)

DO $$
BEGIN
  IF to_regclass('public.agenda_detalle_por_origen_closer_base') IS NULL THEN
    EXECUTE 'ALTER VIEW public.agenda_detalle_por_origen_closer RENAME TO agenda_detalle_por_origen_closer_base';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.agenda_detalle_por_origen_closer AS
WITH base_norm AS (
  SELECT
    b.*,
    COALESCE(NULLIF(BTRIM(b.origen), ''), 'Sin origen') AS origen_key,
    COALESCE(NULLIF(BTRIM(b.closer), ''), 'Sin closer') AS closer_key
  FROM public.agenda_detalle_por_origen_closer_base b
),
comprobantes_base AS (
  SELECT
    EXTRACT(YEAR FROM c.f_venta)::int AS venta_anio,
    EXTRACT(MONTH FROM c.f_venta)::int AS venta_mes,
    CASE
      WHEN c.f_acreditacion IS NULL THEN NULL
      ELSE EXTRACT(YEAR FROM c.f_acreditacion)::int
    END AS acreditacion_anio,
    CASE
      WHEN c.f_acreditacion IS NULL THEN NULL
      ELSE EXTRACT(MONTH FROM c.f_acreditacion)::int
    END AS acreditacion_mes,
    CASE
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(c.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(c.creado_por), ''), 'Sin closer') AS closer_key,
    COALESCE(c.facturacion, 0)::numeric AS facturacion,
    COALESCE(c.cash_collected_total, 0)::numeric AS cash_collected_total
  FROM public.comprobantes c
  WHERE
    c.f_venta IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) = 'venta'
    AND NULLIF(BTRIM(c.producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
),
fact_agg AS (
  SELECT
    venta_anio AS anio,
    venta_mes AS mes,
    origen_key,
    closer_key,
    COUNT(*)::bigint AS total_ventas_comp,
    SUM(facturacion)::numeric AS facturacion_total
  FROM comprobantes_base
  GROUP BY venta_anio, venta_mes, origen_key, closer_key
),
cash_real_agg AS (
  SELECT
    acreditacion_anio AS anio,
    acreditacion_mes AS mes,
    origen_key,
    closer_key,
    SUM(cash_collected_total)::numeric AS cash_collected_total
  FROM comprobantes_base
  WHERE acreditacion_anio IS NOT NULL AND acreditacion_mes IS NOT NULL
  GROUP BY acreditacion_anio, acreditacion_mes, origen_key, closer_key
),
combos AS (
  SELECT anio, mes, origen_key, closer_key FROM base_norm
  UNION
  SELECT anio, mes, origen_key, closer_key FROM fact_agg
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
  COALESCE(f.total_ventas_comp, b.total_ventas, 0::bigint) AS total_ventas,
  COALESCE(f.facturacion_total, 0::numeric) AS facturacion_total,
  COALESCE(c.cash_collected_total, 0::numeric) AS cash_collected_total,
  COALESCE(b.total_paid_upfront, 0::numeric) AS total_paid_upfront,
  COALESCE(b.tasa_cierre, 0::numeric) AS tasa_cierre,
  CASE
    WHEN COALESCE(f.total_ventas_comp, b.total_ventas, 0) > 0
    THEN COALESCE(f.facturacion_total, 0::numeric) / COALESCE(f.total_ventas_comp, b.total_ventas, 1)
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
LEFT JOIN base_norm b
  ON b.anio = combos.anio
 AND b.mes = combos.mes
 AND b.origen_key = combos.origen_key
 AND b.closer_key = combos.closer_key
LEFT JOIN fact_agg f
  ON f.anio = combos.anio
 AND f.mes = combos.mes
 AND f.origen_key = combos.origen_key
 AND f.closer_key = combos.closer_key
LEFT JOIN cash_real_agg c
  ON c.anio = combos.anio
 AND c.mes = combos.mes
 AND c.origen_key = combos.origen_key
 AND c.closer_key = combos.closer_key;
