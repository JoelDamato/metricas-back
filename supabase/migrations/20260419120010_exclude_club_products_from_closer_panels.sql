CREATE OR REPLACE FUNCTION public.metricas_is_non_club_product(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(LOWER(BTRIM(value)) NOT LIKE '%club%', true);
$$;

CREATE OR REPLACE FUNCTION public.metricas_is_valid_sale_product(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    NULLIF(BTRIM(value), '') IS NOT NULL
    AND LOWER(BTRIM(value)) <> 'empty'
    AND LOWER(BTRIM(value)) NOT LIKE '%club%';
$$;

CREATE OR REPLACE VIEW public.ranking_closers_mensual AS
WITH fecha_actual AS (
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy_ar
)
SELECT
  EXTRACT(YEAR FROM c.f_venta)::integer AS anio,
  EXTRACT(MONTH FROM c.f_venta)::integer AS mes,
  COALESCE(c.creado_por, 'Sin closer'::text) AS closer,
  COUNT(*) FILTER (
    WHERE LOWER(BTRIM(COALESCE(c.tipo, ''))) = 'venta'
      AND public.metricas_is_valid_sale_product(c.producto_format)
  ) AS total_ventas,
  COALESCE(
    SUM(c.facturacion) FILTER (
      WHERE LOWER(BTRIM(COALESCE(c.tipo, ''))) = 'venta'
        AND public.metricas_is_valid_sale_product(c.producto_format)
    ),
    0::numeric
  ) AS facturacion_total,
  COALESCE(
    SUM(c.cash_collected) FILTER (
      WHERE public.metricas_is_non_club_product(c.producto_format)
        AND (
          c.f_acreditacion IS NULL
          OR (c.f_acreditacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= fa.hoy_ar
        )
    ),
    0::numeric
  ) AS cash_collected_total,
  COALESCE(
    SUM(c.monto_incobrable) FILTER (
      WHERE public.metricas_is_non_club_product(c.producto_format)
    ),
    0::numeric
  ) AS monto_incobrable_total,
  ROW_NUMBER() OVER (
    PARTITION BY EXTRACT(YEAR FROM c.f_venta), EXTRACT(MONTH FROM c.f_venta)
    ORDER BY COUNT(*) FILTER (
      WHERE LOWER(BTRIM(COALESCE(c.tipo, ''))) = 'venta'
        AND public.metricas_is_valid_sale_product(c.producto_format)
    ) DESC
  ) AS ranking_posicion
FROM public.comprobantes c
CROSS JOIN fecha_actual fa
WHERE c.f_venta IS NOT NULL
  AND c.f_venta >= '2025-11-01 00:00:00+00'::timestamptz
GROUP BY EXTRACT(YEAR FROM c.f_venta), EXTRACT(MONTH FROM c.f_venta), c.creado_por
ORDER BY anio DESC, mes DESC, ranking_posicion;

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
    SUM(COALESCE(cce, 0::bigint))::bigint AS cce,
    SUM(COALESCE(cce_efectuadas, 0::bigint))::bigint AS cce_efectuadas,
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
comprobantes_base AS (
  SELECT
    CASE
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(c.origen), ''), 'Sin origen')
    END AS origen_key,
    COALESCE(NULLIF(BTRIM(c.creado_por), ''), 'Sin closer') AS closer_key,
    EXTRACT(YEAR FROM c.f_venta)::int AS venta_anio,
    EXTRACT(MONTH FROM c.f_venta)::int AS venta_mes,
    EXTRACT(YEAR FROM c.fecha_de_agendamiento)::int AS agenda_anio,
    EXTRACT(MONTH FROM c.fecha_de_agendamiento)::int AS agenda_mes,
    EXTRACT(YEAR FROM c.f_acreditacion)::int AS acreditacion_anio,
    EXTRACT(MONTH FROM c.f_acreditacion)::int AS acreditacion_mes,
    (c.f_acreditacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS acreditacion_fecha_ar,
    COALESCE(c.facturacion, 0)::numeric AS facturacion,
    COALESCE(c.cash_collected, 0)::numeric AS cash_monto,
    COALESCE(c.cash_collected, 0)::numeric AS paid_monto,
    LOWER(BTRIM(COALESCE(c.estado_cc, ''))) AS estado_cc_norm,
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
  WHERE
    cc.acreditacion_anio <> EXTRACT(YEAR FROM fa.hoy_ar)::int
    OR cc.acreditacion_mes <> EXTRACT(MONTH FROM fa.hoy_ar)::int
    OR cc.acreditacion_fecha_ar <= fa.hoy_ar
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
    COUNT(*)::bigint AS total_ventas_comp,
    COUNT(*) FILTER (WHERE estado_cc_norm = 'exitoso') AS cce_vendidas,
    COUNT(*) FILTER (WHERE estado_cc_norm = 'no exitoso') AS ccne_vendidas,
    SUM(paid_monto)::numeric AS total_paid_upfront
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
  COALESCE(v.total_paid_upfront, 0::numeric) AS total_paid_upfront,
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
  COALESCE(v.ccne_vendidas, 0::bigint) AS ccne_vendidas,
  COALESCE(b.cce, 0::bigint) AS cce,
  COALESCE(b.cce_efectuadas, 0::bigint) AS cce_efectuadas,
  COALESCE(v.cce_vendidas, 0::bigint) AS cce_vendidas,
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

CREATE OR REPLACE VIEW public.kpi_closers_mensual AS
WITH fecha_actual AS (
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy_ar
),
meses_base AS (
  SELECT DISTINCT
    EXTRACT(YEAR FROM l.fecha_llamada::date)::integer AS anio,
    EXTRACT(MONTH FROM l.fecha_llamada::date)::integer AS mes,
    CASE
      WHEN LOWER(TRIM(COALESCE(l.closer, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(TRIM(COALESCE(l.closer, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(l.closer, 'Sin closer')
    END AS closer
  FROM public.leads_raw l
  WHERE l.fecha_llamada IS NOT NULL

  UNION

  SELECT DISTINCT
    EXTRACT(YEAR FROM l.fecha_agenda::date)::integer AS anio,
    EXTRACT(MONTH FROM l.fecha_agenda::date)::integer AS mes,
    CASE
      WHEN LOWER(TRIM(COALESCE(l.closer, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(TRIM(COALESCE(l.closer, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(l.closer, 'Sin closer')
    END AS closer
  FROM public.leads_raw l
  WHERE l.fecha_agenda IS NOT NULL

  UNION

  SELECT DISTINCT
    EXTRACT(YEAR FROM c.f_venta)::integer AS anio,
    EXTRACT(MONTH FROM c.f_venta)::integer AS mes,
    CASE
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(c.creado_por, 'Sin closer')
    END AS closer
  FROM public.comprobantes c
  WHERE c.f_venta IS NOT NULL
    AND public.metricas_is_non_club_product(c.producto_format)

  UNION

  SELECT DISTINCT
    EXTRACT(YEAR FROM c.f_acreditacion)::integer AS anio,
    EXTRACT(MONTH FROM c.f_acreditacion)::integer AS mes,
    CASE
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(c.creado_por, 'Sin closer')
    END AS closer
  FROM public.comprobantes c
  WHERE c.f_acreditacion IS NOT NULL
    AND public.metricas_is_non_club_product(c.producto_format)
),
llamada_agg AS (
  SELECT
    EXTRACT(YEAR FROM l.fecha_llamada::date)::integer AS anio,
    EXTRACT(MONTH FROM l.fecha_llamada::date)::integer AS mes,
    CASE
      WHEN LOWER(TRIM(COALESCE(l.closer, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(TRIM(COALESCE(l.closer, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(l.closer, 'Sin closer')
    END AS closer,
    COUNT(*) FILTER (
      WHERE l.agendo = 'Agendo'
        AND l.aplica = 'Aplica'
        AND l.llamada_meg = 'Efectuada'
    ) AS efectuadas,
    COUNT(*) FILTER (
      WHERE l.agendo = 'Agendo'
        AND l.aplica = 'Aplica'
    ) AS aplica
  FROM public.leads_raw l
  WHERE l.fecha_llamada IS NOT NULL
  GROUP BY 1, 2, 3
),
ventas_llamada_agg AS (
  SELECT
    EXTRACT(YEAR FROM c.f_venta)::integer AS anio,
    EXTRACT(MONTH FROM c.f_venta)::integer AS mes,
    CASE
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(c.creado_por, 'Sin closer')
    END AS closer,
    COUNT(*) AS total_ventas
  FROM public.comprobantes c
  WHERE LOWER(BTRIM(COALESCE(c.tipo, ''))) = 'venta'
    AND public.metricas_is_valid_sale_product(c.producto_format)
  GROUP BY 1, 2, 3
),
agenda_agg AS (
  SELECT
    EXTRACT(YEAR FROM l.fecha_agenda::date)::integer AS anio,
    EXTRACT(MONTH FROM l.fecha_agenda::date)::integer AS mes,
    CASE
      WHEN LOWER(TRIM(COALESCE(l.closer, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(TRIM(COALESCE(l.closer, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(l.closer, 'Sin closer')
    END AS closer,
    COUNT(*) FILTER (
      WHERE l.agendo = 'Agendo'
        AND l.aplica = 'Aplica'
        AND l.llamada_meg = 'Efectuada'
    ) AS efectuadas_agenda,
    COUNT(*) FILTER (
      WHERE l.agendo = 'Agendo'
        AND l.aplica = 'Aplica'
    ) AS aplica_agenda
  FROM public.leads_raw l
  WHERE l.fecha_agenda IS NOT NULL
  GROUP BY 1, 2, 3
),
ventas_agenda_agg AS (
  SELECT
    EXTRACT(YEAR FROM c.fecha_de_agendamiento)::integer AS anio,
    EXTRACT(MONTH FROM c.fecha_de_agendamiento)::integer AS mes,
    CASE
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(c.creado_por, 'Sin closer')
    END AS closer,
    COUNT(*) AS total_ventas_agenda
  FROM public.comprobantes c
  WHERE c.fecha_de_agendamiento IS NOT NULL
    AND LOWER(BTRIM(COALESCE(c.tipo, ''))) = 'venta'
    AND public.metricas_is_valid_sale_product(c.producto_format)
  GROUP BY 1, 2, 3
),
cash_agg AS (
  SELECT
    EXTRACT(YEAR FROM c.f_venta)::integer AS anio,
    EXTRACT(MONTH FROM c.f_venta)::integer AS mes,
    CASE
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(c.creado_por, 'Sin closer')
    END AS closer,
    SUM(c.cash_collected) FILTER (
      WHERE public.metricas_is_non_club_product(c.producto_format)
        AND (
          c.f_acreditacion IS NULL
          OR (c.f_acreditacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= fa.hoy_ar
        )
    ) AS cash_collected_mes
  FROM public.comprobantes c
  CROSS JOIN fecha_actual fa
  WHERE c.f_venta IS NOT NULL
  GROUP BY 1, 2, 3
),
cash_3m AS (
  SELECT
    mb.anio,
    mb.mes,
    mb.closer,
    (
      SELECT SUM(sub.cash_collected_mensual)
      FROM (
        SELECT
          date_trunc('month', c.f_venta)::date AS month_start,
          CASE
            WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
            WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
            ELSE COALESCE(c.creado_por, 'Sin closer')
          END AS closer,
          SUM(c.cash_collected) FILTER (
            WHERE c.f_acreditacion IS NULL
              OR (c.f_acreditacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= fa.hoy_ar
          ) AS cash_collected_mensual
        FROM public.comprobantes c
        CROSS JOIN fecha_actual fa
        WHERE c.f_venta IS NOT NULL
          AND public.metricas_is_non_club_product(c.producto_format)
        GROUP BY 1, 2
      ) sub
      WHERE sub.closer = mb.closer
        AND sub.month_start >= (make_date(mb.anio, mb.mes, 1) - INTERVAL '3 months')::date
        AND sub.month_start < make_date(mb.anio, mb.mes, 1)
    ) AS cash_collected_3m
  FROM meses_base mb
),
fact_agg AS (
  SELECT
    EXTRACT(YEAR FROM c.f_venta)::integer AS anio,
    EXTRACT(MONTH FROM c.f_venta)::integer AS mes,
    CASE
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
      WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
      ELSE COALESCE(c.creado_por, 'Sin closer')
    END AS closer,
    SUM(c.facturacion) AS facturacion_mes
  FROM public.comprobantes c
  WHERE LOWER(BTRIM(COALESCE(c.tipo, ''))) = 'venta'
    AND public.metricas_is_valid_sale_product(c.producto_format)
  GROUP BY 1, 2, 3
),
fact_3m AS (
  SELECT
    mb.anio,
    mb.mes,
    mb.closer,
    (
      SELECT SUM(sub.facturacion_mensual)
      FROM (
        SELECT
          date_trunc('month', c.f_venta)::date AS month_start,
          CASE
            WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) IN ('pablo butera', 'pablo butera vie') THEN 'Pablo Butera'
            WHEN LOWER(TRIM(COALESCE(c.creado_por, 'Sin closer'))) = 'nahuel iasci' THEN 'Nahuel Iasci'
            ELSE COALESCE(c.creado_por, 'Sin closer')
          END AS closer,
          SUM(c.facturacion) AS facturacion_mensual
        FROM public.comprobantes c
        WHERE c.f_venta IS NOT NULL
          AND LOWER(BTRIM(COALESCE(c.tipo, ''))) = 'venta'
          AND public.metricas_is_valid_sale_product(c.producto_format)
        GROUP BY 1, 2
      ) sub
      WHERE sub.closer = mb.closer
        AND sub.month_start >= (make_date(mb.anio, mb.mes, 1) - INTERVAL '3 months')::date
        AND sub.month_start < make_date(mb.anio, mb.mes, 1)
    ) AS facturacion_3m
  FROM meses_base mb
)
SELECT
  mb.anio,
  mb.mes,
  mb.closer,
  COALESCE(la.efectuadas, 0::bigint) AS efectuadas,
  COALESCE(la.aplica, 0::bigint) AS aplica,
  COALESCE(vl.total_ventas, 0::bigint) AS ventas_llamada,
  CASE
    WHEN COALESCE(la.efectuadas, 0::bigint) > 0
      THEN COALESCE(vl.total_ventas, 0::bigint)::numeric / la.efectuadas::numeric
    ELSE 0::numeric
  END AS cierre_segun_llamada,
  CASE
    WHEN COALESCE(la.aplica, 0::bigint) > 0
      THEN COALESCE(la.efectuadas, 0::bigint)::numeric / la.aplica::numeric
    ELSE 0::numeric
  END AS asistencia_segun_llamada,
  COALESCE(aa.efectuadas_agenda, 0::bigint) AS efectuadas_agenda,
  COALESCE(aa.aplica_agenda, 0::bigint) AS aplica_agenda,
  CASE
    WHEN COALESCE(aa.aplica_agenda, 0::bigint) > 0
      THEN COALESCE(aa.efectuadas_agenda, 0::bigint)::numeric / aa.aplica_agenda::numeric
    ELSE 0::numeric
  END AS tasa_asistencia,
  CASE
    WHEN COALESCE(aa.efectuadas_agenda, 0::bigint) > 0
      THEN COALESCE(va.total_ventas_agenda, 0::bigint)::numeric / aa.efectuadas_agenda::numeric
    ELSE 0::numeric
  END AS tasa_cierre,
  COALESCE(cc.cash_collected_mes, 0::numeric) AS cash_collected,
  COALESCE(cc3.cash_collected_3m, 0::numeric) AS cash_collected_3m,
  COALESCE(f.facturacion_mes, 0::numeric) AS facturacion,
  COALESCE(f3.facturacion_3m, 0::numeric) AS facturacion_3m
FROM meses_base mb
LEFT JOIN llamada_agg la
  ON la.anio = mb.anio
 AND la.mes = mb.mes
 AND la.closer = mb.closer
LEFT JOIN ventas_llamada_agg vl
  ON vl.anio = mb.anio
 AND vl.mes = mb.mes
 AND vl.closer = mb.closer
LEFT JOIN agenda_agg aa
  ON aa.anio = mb.anio
 AND aa.mes = mb.mes
 AND aa.closer = mb.closer
LEFT JOIN ventas_agenda_agg va
  ON va.anio = mb.anio
 AND va.mes = mb.mes
 AND va.closer = mb.closer
LEFT JOIN cash_agg cc
  ON cc.anio = mb.anio
 AND cc.mes = mb.mes
 AND cc.closer = mb.closer
LEFT JOIN cash_3m cc3
  ON cc3.anio = mb.anio
 AND cc3.mes = mb.mes
 AND cc3.closer = mb.closer
LEFT JOIN fact_agg f
  ON f.anio = mb.anio
 AND f.mes = mb.mes
 AND f.closer = mb.closer
LEFT JOIN fact_3m f3
  ON f3.anio = mb.anio
 AND f3.mes = mb.mes
 AND f3.closer = mb.closer
ORDER BY mb.anio DESC, mb.mes DESC, mb.closer;
