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
    AND COALESCE(c.facturacion, 0::numeric) > 0::numeric
    AND COALESCE(c.cash_collected_total, 0::numeric) >= COALESCE(c.facturacion, 0::numeric) * 0.3
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
