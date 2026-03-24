CREATE OR REPLACE VIEW public.ranking_closers_mensual AS
WITH fecha_actual AS (
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy_ar
)
SELECT
  EXTRACT(YEAR FROM c.f_venta)::integer AS anio,
  EXTRACT(MONTH FROM c.f_venta)::integer AS mes,
  COALESCE(c.creado_por, 'Sin closer'::text) AS closer,
  COUNT(*) FILTER (
    WHERE c.tipo = 'Venta'::text
      AND UPPER(c.producto_format) <> 'CLUB'::text
      AND c.producto_format <> ''::text
  ) AS total_ventas,
  COALESCE(
    SUM(c.facturacion) FILTER (
      WHERE c.tipo = 'Venta'::text
        AND UPPER(c.producto_format) <> 'CLUB'::text
        AND c.producto_format <> ''::text
    ),
    0::numeric
  ) AS facturacion_total,
  COALESCE(
    SUM(c.cash_collected) FILTER (
      WHERE UPPER(c.producto_format) <> 'CLUB'::text
        AND (
          c.f_acreditacion IS NULL
          OR (c.f_acreditacion AT TIME ZONE 'America/Argentina/Buenos_Aires')::date <= fa.hoy_ar
        )
    ),
    0::numeric
  ) AS cash_collected_total,
  COALESCE(
    SUM(c.monto_incobrable) FILTER (
      WHERE UPPER(c.producto_format) <> 'CLUB'::text
    ),
    0::numeric
  ) AS monto_incobrable_total,
  ROW_NUMBER() OVER (
    PARTITION BY EXTRACT(YEAR FROM c.f_venta), EXTRACT(MONTH FROM c.f_venta)
    ORDER BY COUNT(*) FILTER (
      WHERE c.tipo = 'Venta'::text
        AND UPPER(c.producto_format) <> 'CLUB'::text
        AND c.producto_format <> ''::text
    ) DESC
  ) AS ranking_posicion
FROM public.comprobantes c
CROSS JOIN fecha_actual fa
WHERE c.f_venta IS NOT NULL
  AND c.f_venta >= '2025-11-01 00:00:00+00'::timestamptz
GROUP BY EXTRACT(YEAR FROM c.f_venta), EXTRACT(MONTH FROM c.f_venta), c.creado_por
ORDER BY anio DESC, mes DESC, ranking_posicion;
