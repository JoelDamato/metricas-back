create or replace view public.agenda_totales_base as
 WITH comp_origen AS (
         SELECT c.id,
            c.adname,
            c.adset,
            c.agenda_format,
            c.csm_2_0,
            c.calidad,
            c.campaign,
            c.cantidad_de_pagos,
            c.cash_collected,
            c.cash_collected_ars,
            c.cash_collected_total,
            c.cliente,
            c.cobranza_relacionada,
            c.comprobante,
            c.conciliacion_financiera,
            c.conciliacion_financiera_2,
            c.conciliar,
            c.correspondiente_format,
            c.creado_por,
            c.dni_cuit,
            c.estado,
            c.facturacion,
            c.facturacion_ars,
            c.facturacion_arca,
            c.facturar,
            c.fecha_correspondiente,
            c.fecha_creado,
            c.fecha_de_agendamiento,
            c.fecha_facturado,
            c.fecha_respaldo,
            c.finalizar,
            c.info_comprobantes,
            c.mail,
            c.medios_de_pago,
            c.modelo_de_negocio,
            c.monto_pesos,
            c.origen,
            c.producto_format,
            c.productos,
            c.rebotar_pago,
            c.rectificar_pago,
            c.responsable_actual,
            c.score,
            c.tc,
            c.telefono,
            c.tipo,
            c.tipo_banco,
            c.venta_relacionada,
            c.verificacion,
            c.verificacion_comisiones,
            c.crear_registro_csm,
            c.agenda_periodo_a,
            c.agenda_periodo_m,
            c.correspondiente_periodo_m,
            c.correspondiente_periodo_a,
            c.estado_cc,
            c.fecha_de_venta_format,
            c.llamada_meg,
            c.cheque,
            c.fecha_de_acreditacion,
            c.fecha_de_llamada,
            c.calendario_agendado,
            c.venta_periodo_m,
            c.venta_periodo_a,
            c.neto_club,
            c.medios_de_pago_format,
            c.setter,
            c.f_acreditacion,
            c.f_acreditacion_format,
            c.cliente_format,
            c.porcentaje_venta_vieja_format,
            c.acreditado_periodo_m,
            c.acreditado_periodo_y,
            c.porcentaje_venta_vieja,
            c.f_venta,
            c.f_transaccion_string,
            c.f_renovacion,
            c.f_renovacion_string,
            c.created_at,
            c.updated_at,
            c.ghlid,
            c.monto_incobrable,
            c.estrategia_a,
                CASE
                    WHEN c.origen ~~* '%VSL%'::text THEN 'VSL'::text
                    WHEN c.origen ~~* '%APSET%'::text THEN 'APSET'::text
                    WHEN c.origen ~~* '%ORG%'::text THEN 'ORG'::text
                    WHEN c.origen ~~* '%CLASES%'::text OR c.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
                    WHEN c.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
                    WHEN c.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
                    WHEN c.origen ~~* '%Club%'::text THEN 'CLUB'::text
                    WHEN c.origen IS NULL THEN 'Sin origen'::text
                    ELSE c.origen
                END AS origen_norm
           FROM comprobantes c
        )
 SELECT
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END AS origen,
    COALESCE(l.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
    COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) AS anio,
    COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) AS mes,
    count(*) FILTER (WHERE l.agendo = 'Agendo'::text) AS total_agendados,
    count(*) FILTER (WHERE l.aplica = 'Aplica'::text) AS total_aplica,
    count(*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND l.respondio_apertura = 'Respondio'::text) AS total_respondio,
    count(*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND l.respondio_apertura = 'Respondio'::text AND l.confirmo_mensaje = 'Confirmo'::text) AS total_confirmo,
    count(*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND l.llamada_meg = 'Cancelado'::text) AS total_cancelado,
    count(*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND l.llamada_meg = 'No show'::text) AS total_no_asistidas,
    count(*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.llamada_meg = 'Pendiente'::text OR l.llamada_meg IS NULL)) AS total_pendientes,
    count(*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND l.llamada_meg = 'Efectuada'::text) AS total_efectuadas,
    max(COALESCE(v.total_ventas, 0::bigint)) AS total_ventas,
    max(COALESCE(p.total_paid_upfront, 0::numeric)) AS total_paid_upfront,
        CASE
            WHEN max(COALESCE(v.total_ventas, 0::bigint)) > 0 THEN max(COALESCE(p.total_paid_upfront, 0::numeric)) / max(COALESCE(v.total_ventas, 0::bigint))::numeric
            ELSE 0::numeric
        END AS aov,
        CASE
            WHEN count(*) FILTER (WHERE l.aplica = 'Aplica'::text) > 0 THEN max(COALESCE(v.total_ventas, 0::bigint))::numeric / count(*) FILTER (WHERE l.aplica = 'Aplica'::text)::numeric * 100::numeric
            ELSE 0::numeric
        END AS tasa_cierre,
    count(*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm IS NULL OR btrim(l.call_confirm) = ''::text OR lower(btrim(l.call_confirm)) <> 'exitoso'::text) AND (l.cc_whatsapp IS NULL OR btrim(l.cc_whatsapp) = ''::text OR lower(btrim(l.cc_whatsapp)) <> 'exitoso'::text)) AS ccne,
    count(*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm IS NULL OR btrim(l.call_confirm) = ''::text OR lower(btrim(l.call_confirm)) <> 'exitoso'::text) AND (l.cc_whatsapp IS NULL OR btrim(l.cc_whatsapp) = ''::text OR lower(btrim(l.cc_whatsapp)) <> 'exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) AS ccne_efectuadas,
    max(COALESCE(vne.total_ventas_ccne, 0::bigint)) AS ccne_vendidas,
    count(*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text)) AS cce,
    count(*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) AS cce_efectuadas,
    max(COALESCE(ve.total_ventas_cce, 0::bigint)) AS cce_vendidas,
    max(COALESCE(ft.facturacion_total_mes, 0::numeric)) AS facturacion_total_mes,
    max(COALESCE(ccr.cash_collected_real_mes, 0::numeric)) AS cash_collected_real_mes,
    max(COALESCE(cco.cash_collected_otros_meses, 0::numeric)) AS cash_collected_otros_meses,
    max(COALESCE(cca.cash_collected_agendas_mes, 0::numeric)) AS cash_collected_agendas_mes,
    max(COALESCE(prod.meg_1, 0::bigint)) AS meg_1,
    max(COALESCE(prod.meg_2, 0::bigint)) AS meg_2,
    max(COALESCE(prod.personalizado, 0::bigint)) AS personalizado,
    max(COALESCE(prod.renovacion_meg_personalizado, 0::bigint)) AS renovacion_meg_personalizado,
    max(COALESCE(prod.reportes_financieros, 0::bigint)) AS reportes_financieros,
    max(COALESCE(prod.renovacion_meg, 0::bigint)) AS renovacion_meg,
    max(COALESCE(prod.renovacion_meg_2, 0::bigint)) AS renovacion_meg_2,
    max(COALESCE(prod.meg_2_1, 0::bigint)) AS meg_2_1,
    max(COALESCE(prod.renovacion_meg_2_1, 0::bigint)) AS renovacion_meg_2_1,
    max(COALESCE(fa.facturacion_agenda, 0::numeric)) AS facturacion_f_agenda,
    max(COALESCE(cca2.cash_collected_agenda, 0::numeric)) AS cash_collected_agenda
   FROM leads_raw l
     LEFT JOIN ( SELECT EXTRACT(year FROM comp_origen.fecha_de_agendamiento) AS anio_venta,
            EXTRACT(month FROM comp_origen.fecha_de_agendamiento) AS mes_venta,
            COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
            comp_origen.origen_norm,
            count(*) AS total_ventas
           FROM comp_origen
          WHERE comp_origen.tipo = 'Venta'::text AND upper(comp_origen.producto_format) <> 'CLUB'::text AND comp_origen.producto_format <> 'EMPTY'::text AND comp_origen.producto_format <> ''::text AND comp_origen.producto_format IS NOT NULL
          GROUP BY (EXTRACT(year FROM comp_origen.fecha_de_agendamiento)), (EXTRACT(month FROM comp_origen.fecha_de_agendamiento)), (COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text)), comp_origen.origen_norm) v ON COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) = v.anio_venta AND COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) = v.mes_venta AND COALESCE(l.estrategia_a, 'Sin estrategia'::text) = v.estrategia_a AND
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END = v.origen_norm
     LEFT JOIN ( SELECT EXTRACT(year FROM comp_origen.fecha_de_agendamiento) AS anio_paid,
            EXTRACT(month FROM comp_origen.fecha_de_agendamiento) AS mes_paid,
            COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
            comp_origen.origen_norm,
            sum(comp_origen.cash_collected) AS total_paid_upfront
           FROM comp_origen
          WHERE comp_origen.tipo = 'Venta'::text AND upper(comp_origen.producto_format) <> 'CLUB'::text AND comp_origen.producto_format <> 'EMPTY'::text AND comp_origen.producto_format <> ''::text AND comp_origen.producto_format IS NOT NULL
          GROUP BY (EXTRACT(year FROM comp_origen.fecha_de_agendamiento)), (EXTRACT(month FROM comp_origen.fecha_de_agendamiento)), (COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text)), comp_origen.origen_norm) p ON COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) = p.anio_paid AND COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) = p.mes_paid AND COALESCE(l.estrategia_a, 'Sin estrategia'::text) = p.estrategia_a AND
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END = p.origen_norm
     LEFT JOIN ( SELECT EXTRACT(year FROM comp_origen.fecha_de_agendamiento) AS anio_venta_ccne,
            EXTRACT(month FROM comp_origen.fecha_de_agendamiento) AS mes_venta_ccne,
            COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
            comp_origen.origen_norm,
            count(*) AS total_ventas_ccne
           FROM comp_origen
          WHERE comp_origen.tipo = 'Venta'::text AND upper(comp_origen.producto_format) <> 'CLUB'::text AND comp_origen.producto_format <> 'EMPTY'::text AND comp_origen.producto_format <> ''::text AND comp_origen.producto_format IS NOT NULL AND comp_origen.estado_cc = 'No exitoso'::text
          GROUP BY (EXTRACT(year FROM comp_origen.fecha_de_agendamiento)), (EXTRACT(month FROM comp_origen.fecha_de_agendamiento)), (COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text)), comp_origen.origen_norm) vne ON COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) = vne.anio_venta_ccne AND COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) = vne.mes_venta_ccne AND COALESCE(l.estrategia_a, 'Sin estrategia'::text) = vne.estrategia_a AND
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END = vne.origen_norm
     LEFT JOIN ( SELECT EXTRACT(year FROM comp_origen.fecha_de_agendamiento) AS anio_venta_cce,
            EXTRACT(month FROM comp_origen.fecha_de_agendamiento) AS mes_venta_cce,
            COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
            comp_origen.origen_norm,
            count(*) AS total_ventas_cce
           FROM comp_origen
          WHERE comp_origen.tipo = 'Venta'::text AND upper(comp_origen.producto_format) <> 'CLUB'::text AND comp_origen.producto_format <> 'EMPTY'::text AND comp_origen.producto_format <> ''::text AND comp_origen.producto_format IS NOT NULL AND comp_origen.estado_cc = 'Exitoso'::text
          GROUP BY (EXTRACT(year FROM comp_origen.fecha_de_agendamiento)), (EXTRACT(month FROM comp_origen.fecha_de_agendamiento)), (COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text)), comp_origen.origen_norm) ve ON COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) = ve.anio_venta_cce AND COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) = ve.mes_venta_cce AND COALESCE(l.estrategia_a, 'Sin estrategia'::text) = ve.estrategia_a AND
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END = ve.origen_norm
     LEFT JOIN ( SELECT EXTRACT(year FROM comp_origen.f_venta) AS anio_fact,
            EXTRACT(month FROM comp_origen.f_venta) AS mes_fact,
            COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
            comp_origen.origen_norm,
            sum(comp_origen.facturacion) AS facturacion_total_mes
           FROM comp_origen
          WHERE comp_origen.tipo = 'Venta'::text AND upper(comp_origen.producto_format) <> 'CLUB'::text AND comp_origen.producto_format <> 'EMPTY'::text AND comp_origen.producto_format <> ''::text AND comp_origen.producto_format IS NOT NULL
          GROUP BY (EXTRACT(year FROM comp_origen.f_venta)), (EXTRACT(month FROM comp_origen.f_venta)), (COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text)), comp_origen.origen_norm) ft ON COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) = ft.anio_fact AND COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) = ft.mes_fact AND COALESCE(l.estrategia_a, 'Sin estrategia'::text) = ft.estrategia_a AND
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END = ft.origen_norm
     LEFT JOIN ( SELECT EXTRACT(year FROM comp_origen.f_acreditacion) AS anio_ccr,
            EXTRACT(month FROM comp_origen.f_acreditacion) AS mes_ccr,
            COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
            comp_origen.origen_norm,
            sum(comp_origen.cash_collected) AS cash_collected_real_mes
           FROM comp_origen
          WHERE upper(comp_origen.producto_format) <> 'CLUB'::text AND comp_origen.f_acreditacion <= CURRENT_DATE
          GROUP BY (EXTRACT(year FROM comp_origen.f_acreditacion)), (EXTRACT(month FROM comp_origen.f_acreditacion)), (COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text)), comp_origen.origen_norm) ccr ON COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) = ccr.anio_ccr AND COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) = ccr.mes_ccr AND COALESCE(l.estrategia_a, 'Sin estrategia'::text) = ccr.estrategia_a AND
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END = ccr.origen_norm
     LEFT JOIN ( SELECT EXTRACT(month FROM comp_origen.f_acreditacion) AS mes_cco,
            EXTRACT(year FROM comp_origen.f_acreditacion) AS anio_cco,
            COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
            comp_origen.origen_norm,
            sum(comp_origen.cash_collected) AS cash_collected_otros_meses
           FROM comp_origen
          WHERE (comp_origen.fecha_de_agendamiento IS NULL OR EXTRACT(month FROM comp_origen.fecha_de_agendamiento) <> EXTRACT(month FROM comp_origen.f_acreditacion)) AND EXTRACT(year FROM comp_origen.fecha_correspondiente) = 2026::numeric AND upper(comp_origen.producto_format) <> 'CLUB'::text AND comp_origen.f_acreditacion <= CURRENT_DATE
          GROUP BY (EXTRACT(year FROM comp_origen.f_acreditacion)), (EXTRACT(month FROM comp_origen.f_acreditacion)), (COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text)), comp_origen.origen_norm) cco ON COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) = cco.anio_cco AND COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) = cco.mes_cco AND COALESCE(l.estrategia_a, 'Sin estrategia'::text) = cco.estrategia_a AND
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END = cco.origen_norm
     LEFT JOIN ( SELECT EXTRACT(year FROM comp_origen.fecha_de_agendamiento) AS anio_cca,
            EXTRACT(month FROM comp_origen.fecha_de_agendamiento) AS mes_cca,
            COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
            comp_origen.origen_norm,
            sum(comp_origen.cash_collected) AS cash_collected_agendas_mes
           FROM comp_origen
          WHERE EXTRACT(month FROM comp_origen.fecha_de_agendamiento) = EXTRACT(month FROM comp_origen.f_acreditacion) AND EXTRACT(year FROM comp_origen.fecha_correspondiente) = 2026::numeric AND upper(comp_origen.producto_format) <> 'CLUB'::text AND comp_origen.f_acreditacion <= CURRENT_DATE
          GROUP BY (EXTRACT(year FROM comp_origen.fecha_de_agendamiento)), (EXTRACT(month FROM comp_origen.fecha_de_agendamiento)), (COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text)), comp_origen.origen_norm) cca ON COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) = cca.anio_cca AND COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) = cca.mes_cca AND COALESCE(l.estrategia_a, 'Sin estrategia'::text) = cca.estrategia_a AND
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END = cca.origen_norm
     LEFT JOIN ( SELECT EXTRACT(year FROM comp_origen.fecha_de_agendamiento) AS anio_prod,
            EXTRACT(month FROM comp_origen.fecha_de_agendamiento) AS mes_prod,
            COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
            comp_origen.origen_norm,
            count(*) FILTER (WHERE comp_origen.producto_format = 'Meg 1.0'::text) AS meg_1,
            count(*) FILTER (WHERE comp_origen.producto_format = 'Meg 2.0'::text) AS meg_2,
            count(*) FILTER (WHERE comp_origen.producto_format = 'Meg Personalizado'::text) AS personalizado,
            count(*) FILTER (WHERE comp_origen.producto_format = 'Renovacion - Meg Personalizado'::text) AS renovacion_meg_personalizado,
            count(*) FILTER (WHERE comp_origen.producto_format = 'Reportes Financieros'::text) AS reportes_financieros,
            count(*) FILTER (WHERE comp_origen.producto_format = 'Renovacion - Meg 1.0'::text) AS renovacion_meg,
            count(*) FILTER (WHERE comp_origen.producto_format = 'Renovacion - Meg 2.0'::text) AS renovacion_meg_2,
            count(*) FILTER (WHERE comp_origen.producto_format = 'Meg 2.1'::text) AS meg_2_1,
            count(*) FILTER (WHERE comp_origen.producto_format = 'Renovacion - Meg 2.1'::text) AS renovacion_meg_2_1
           FROM comp_origen
          WHERE comp_origen.tipo = 'Venta'::text
          GROUP BY (EXTRACT(year FROM comp_origen.fecha_de_agendamiento)), (EXTRACT(month FROM comp_origen.fecha_de_agendamiento)), (COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text)), comp_origen.origen_norm) prod ON COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) = prod.anio_prod AND COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) = prod.mes_prod AND COALESCE(l.estrategia_a, 'Sin estrategia'::text) = prod.estrategia_a AND
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END = prod.origen_norm
     LEFT JOIN ( SELECT EXTRACT(year FROM comp_origen.fecha_de_agendamiento) AS anio_fa,
            EXTRACT(month FROM comp_origen.fecha_de_agendamiento) AS mes_fa,
            COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
            comp_origen.origen_norm,
            sum(comp_origen.facturacion) AS facturacion_agenda
           FROM comp_origen
          WHERE comp_origen.tipo = 'Venta'::text AND upper(comp_origen.producto_format) <> 'CLUB'::text AND comp_origen.producto_format <> ''::text
          GROUP BY (EXTRACT(year FROM comp_origen.fecha_de_agendamiento)), (EXTRACT(month FROM comp_origen.fecha_de_agendamiento)), (COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text)), comp_origen.origen_norm) fa ON COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) = fa.anio_fa AND COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) = fa.mes_fa AND COALESCE(l.estrategia_a, 'Sin estrategia'::text) = fa.estrategia_a AND
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END = fa.origen_norm
     LEFT JOIN ( SELECT EXTRACT(year FROM comp_origen.fecha_de_agendamiento) AS anio_cca2,
            EXTRACT(month FROM comp_origen.fecha_de_agendamiento) AS mes_cca2,
            COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text) AS estrategia_a,
            comp_origen.origen_norm,
            sum(comp_origen.cash_collected) AS cash_collected_agenda
           FROM comp_origen
          WHERE upper(comp_origen.producto_format) <> 'CLUB'::text AND comp_origen.producto_format <> ''::text AND comp_origen.f_acreditacion <= CURRENT_DATE
          GROUP BY (EXTRACT(year FROM comp_origen.fecha_de_agendamiento)), (EXTRACT(month FROM comp_origen.fecha_de_agendamiento)), (COALESCE(comp_origen.estrategia_a, 'Sin estrategia'::text)), comp_origen.origen_norm) cca2 ON COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric) = cca2.anio_cca2 AND COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric) = cca2.mes_cca2 AND COALESCE(l.estrategia_a, 'Sin estrategia'::text) = cca2.estrategia_a AND
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END = cca2.origen_norm
  GROUP BY (COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric)), (COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric)), (
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END), l.estrategia_a
  ORDER BY (COALESCE(EXTRACT(year FROM l.fecha_agenda), 0::numeric)) DESC, (COALESCE(EXTRACT(month FROM l.fecha_agenda), 0::numeric)) DESC, (
        CASE
            WHEN l.origen ~~* '%VSL%'::text THEN 'VSL'::text
            WHEN l.origen ~~* '%APSET%'::text THEN 'APSET'::text
            WHEN l.origen ~~* '%ORG%'::text THEN 'ORG'::text
            WHEN l.origen ~~* '%CLASES%'::text OR l.origen ~~* '%CLASE%'::text THEN 'CLASES'::text
            WHEN l.origen ~~* '%Lanzamiento%'::text THEN 'LANZ'::text
            WHEN l.origen ~~* '%Evergreen%'::text THEN 'EVERG'::text
            WHEN l.origen ~~* '%Club%'::text THEN 'CLUB'::text
            WHEN l.origen IS NULL THEN 'Sin origen'::text
            ELSE l.origen
        END), l.estrategia_a;;
