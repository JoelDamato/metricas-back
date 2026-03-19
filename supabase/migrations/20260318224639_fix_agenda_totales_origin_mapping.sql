-- Ajuste de mapping de origen para comprobantes -> agenda_totales
-- Convierte variantes de texto de comprobantes a etiquetas canónicas:
-- VSL / ORG / APSET / CLASES.

CREATE OR REPLACE VIEW public.agenda_totales AS
WITH comprobantes_filtrados AS (
  SELECT
    EXTRACT(YEAR FROM c.f_venta)::int AS anio,
    EXTRACT(MONTH FROM c.f_venta)::int AS mes,
    CASE
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%APSET%' THEN 'APSET'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%CLASES%' THEN 'CLASES'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%ORG%' THEN 'ORG'
      WHEN UPPER(COALESCE(c.origen, '')) LIKE '%VSL%' THEN 'VSL'
      ELSE COALESCE(NULLIF(BTRIM(c.origen), ''), 'Sin origen')
    END AS origen,
    COALESCE(NULLIF(BTRIM(c.estrategia_a), ''), 'Sin estrategia') AS estrategia_a,
    COALESCE(c.facturacion, 0)::numeric AS facturacion,
    COALESCE(c.cash_collected_total, 0)::numeric AS cash_collected_total,
    CASE
      WHEN
        COALESCE(
          CASE
            WHEN NULLIF(BTRIM(c.acreditado_periodo_y), '') IS NULL THEN NULL
            WHEN LENGTH(BTRIM(c.acreditado_periodo_y)) = 2 THEN 2000 + BTRIM(c.acreditado_periodo_y)::int
            ELSE BTRIM(c.acreditado_periodo_y)::int
          END,
          EXTRACT(YEAR FROM c.f_acreditacion)::int,
          EXTRACT(YEAR FROM c.f_venta)::int
        ) = EXTRACT(YEAR FROM c.f_venta)::int
        AND
        COALESCE(
          CASE
            WHEN NULLIF(BTRIM(c.acreditado_periodo_m), '') IS NULL THEN NULL
            ELSE BTRIM(c.acreditado_periodo_m)::int
          END,
          EXTRACT(MONTH FROM c.f_acreditacion)::int,
          EXTRACT(MONTH FROM c.f_venta)::int
        ) = EXTRACT(MONTH FROM c.f_venta)::int
      THEN COALESCE(c.cash_collected_total, 0)::numeric
      ELSE 0::numeric
    END AS cash_collected_agendas_mes,
    CASE
      WHEN
        COALESCE(
          CASE
            WHEN NULLIF(BTRIM(c.acreditado_periodo_y), '') IS NULL THEN NULL
            WHEN LENGTH(BTRIM(c.acreditado_periodo_y)) = 2 THEN 2000 + BTRIM(c.acreditado_periodo_y)::int
            ELSE BTRIM(c.acreditado_periodo_y)::int
          END,
          EXTRACT(YEAR FROM c.f_acreditacion)::int,
          EXTRACT(YEAR FROM c.f_venta)::int
        ) = EXTRACT(YEAR FROM c.f_venta)::int
        AND
        COALESCE(
          CASE
            WHEN NULLIF(BTRIM(c.acreditado_periodo_m), '') IS NULL THEN NULL
            ELSE BTRIM(c.acreditado_periodo_m)::int
          END,
          EXTRACT(MONTH FROM c.f_acreditacion)::int,
          EXTRACT(MONTH FROM c.f_venta)::int
        ) = EXTRACT(MONTH FROM c.f_venta)::int
      THEN 0::numeric
      ELSE COALESCE(c.cash_collected_total, 0)::numeric
    END AS cash_collected_otros_meses
  FROM public.comprobantes c
  WHERE
    c.f_venta IS NOT NULL
    AND LOWER(COALESCE(c.tipo, '')) = 'venta'
    AND NULLIF(BTRIM(c.producto_format), '') IS NOT NULL
    AND LOWER(BTRIM(c.producto_format)) NOT LIKE '%club%'
),
comprobantes_agg AS (
  SELECT
    anio,
    mes,
    origen,
    estrategia_a,
    SUM(facturacion)::numeric AS facturacion_total_mes,
    SUM(cash_collected_total)::numeric AS cash_collected_real_mes,
    SUM(cash_collected_otros_meses)::numeric AS cash_collected_otros_meses,
    SUM(cash_collected_agendas_mes)::numeric AS cash_collected_agendas_mes
  FROM comprobantes_filtrados
  GROUP BY anio, mes, origen, estrategia_a
)
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
  COALESCE(ca.facturacion_total_mes, 0::numeric) AS facturacion_total_mes,
  COALESCE(ca.cash_collected_real_mes, 0::numeric) AS cash_collected_real_mes,
  COALESCE(ca.cash_collected_otros_meses, 0::numeric) AS cash_collected_otros_meses,
  COALESCE(ca.cash_collected_agendas_mes, 0::numeric) AS cash_collected_agendas_mes,
  b.meg_1,
  b.meg_2,
  b.personalizado,
  b.renovacion_meg_personalizado,
  b.reportes_financieros,
  b.renovacion_meg,
  b.renovacion_meg_2,
  b.meg_2_1,
  b.renovacion_meg_2_1,
  COALESCE(ca.facturacion_total_mes, 0::numeric) AS facturacion_f_agenda,
  COALESCE(ca.cash_collected_agendas_mes, 0::numeric) AS cash_collected_agenda
FROM public.agenda_totales_base b
LEFT JOIN comprobantes_agg ca
  ON ca.anio = b.anio
 AND ca.mes = b.mes
 AND ca.origen = COALESCE(NULLIF(BTRIM(b.origen), ''), 'Sin origen')
 AND ca.estrategia_a = COALESCE(NULLIF(BTRIM(b.estrategia_a), ''), 'Sin estrategia');
