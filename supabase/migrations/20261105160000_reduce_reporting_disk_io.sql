BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='40s';
-- Reduce intermediate row width and reuse existing indexes; preserve every result.
CREATE VIEW public.disk_io_candidate AS  WITH lead_source AS (
 SELECT l_1.id,l_1.ghlid,l_1.last_edited_time,l_1.created_time,l_1.fecha_agenda,
 l_1.aplica,l_1.agendo,l_1.call_confirm,l_1.llamada_cc,l_1.llamada_meg,l_1.cc_whatsapp,
 NULLIF(btrim(l_1.origen_actual), ''::text) AS marketing_origin FROM leads_raw l_1 WHERE NULLIF(btrim(l_1.origen_actual), ''::text) IS NOT NULL
        ), lead_origin_by_ghl AS (
         SELECT DISTINCT ON ((lower(btrim(l_1.ghlid)))) lower(btrim(l_1.ghlid)) AS ghlid_key,
            l_1.marketing_origin
           FROM lead_source l_1
          WHERE NULLIF(btrim(l_1.ghlid), ''::text) IS NOT NULL AND l_1.marketing_origin IS NOT NULL
          ORDER BY (lower(btrim(l_1.ghlid))), l_1.last_edited_time DESC NULLS LAST, l_1.created_time DESC NULLS LAST
        ), lead_norm AS (
 SELECT l_1.id,l_1.aplica,l_1.agendo,l_1.call_confirm,l_1.llamada_cc,l_1.llamada_meg,l_1.cc_whatsapp,
 date(l_1.fecha_agenda) AS fecha_agenda_date,
                CASE
                    WHEN l_1.marketing_origin ~~* 'Postulación MEG - %'::text THEN
                    CASE
                        WHEN split_part(l_1.marketing_origin, ' - '::text, 2) ~~* '%VSL%'::text THEN 'VSL'::text
                        WHEN split_part(l_1.marketing_origin, ' - '::text, 2) ~~* '%ORG%'::text THEN 'ORG'::text
                        WHEN split_part(l_1.marketing_origin, ' - '::text, 2) ~~* '%APSET%'::text THEN 'APSET'::text
                        ELSE split_part(l_1.marketing_origin, ' - '::text, 2)
                    END
                    ELSE l_1.marketing_origin
                END AS origen_norm
           FROM lead_source l_1
          WHERE l_1.fecha_agenda IS NOT NULL AND l_1.marketing_origin IS NOT NULL
        ), comp_source AS (
 SELECT c.f_acreditacion,c.fecha_de_agendamiento,c.producto_format,c.cash_collected,c.facturacion,c.tipo,c.estado_cc,
 NULLIF(btrim(lo.marketing_origin), ''::text) AS marketing_origin
           FROM comprobantes_cash_metricas c
             LEFT JOIN lead_origin_by_ghl lo ON lo.ghlid_key = lower(btrim(c.ghlid))
        ), comp_norm AS (
 SELECT c.producto_format,c.cash_collected,c.facturacion,c.tipo,c.estado_cc,
 date(c.f_acreditacion) AS fecha_acred_date,
            date(c.fecha_de_agendamiento) AS fecha_agendamiento_date,
                CASE
                    WHEN c.marketing_origin ~~* 'Postulación MEG - %'::text THEN
                    CASE
                        WHEN split_part(c.marketing_origin, ' - '::text, 2) ~~* '%VSL%'::text THEN 'VSL'::text
                        WHEN split_part(c.marketing_origin, ' - '::text, 2) ~~* '%ORG%'::text THEN 'ORG'::text
                        WHEN split_part(c.marketing_origin, ' - '::text, 2) ~~* '%APSET%'::text THEN 'APSET'::text
                        ELSE split_part(c.marketing_origin, ' - '::text, 2)
                    END
                    ELSE c.marketing_origin
                END AS origen_norm
           FROM comp_source c
          WHERE c.marketing_origin IS NOT NULL
        ), fechas AS (
         SELECT DISTINCT lead_norm.fecha_agenda_date AS fecha
           FROM lead_norm
        ), origenes AS (
         SELECT lead_norm.origen_norm AS origen
           FROM lead_norm
        UNION
         SELECT comp_norm.origen_norm AS origen
           FROM comp_norm
        ), esqueleto AS (
         SELECT f.fecha,
            o.origen
           FROM fechas f
             CROSS JOIN origenes o
        )
 SELECT e.fecha,
    e.origen,
    count(l.*) AS reuniones_agendadas,
    count(l.*) FILTER (WHERE l.aplica = 'Aplica'::text) AS agendas_aplicables,
    COALESCE(cc.cash_collected_total, 0::numeric) AS cash_collected,
    COALESCE(fact.facturacion_total, 0::numeric) AS facturacion,
    count(l.*) AS aplicaciones_formulario,
    count(l.*) FILTER (WHERE l.aplica = 'Aplica'::text) AS aplicaciones_aplicables_ghl,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text)) AS leads_contactados_cc,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text)) AS call_confirmer_exitosos,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) AS llamadas_venta_asistidas_cce,
    COALESCE(vce.ventas_cce, 0::bigint) AS ventas_cce,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm IS NULL OR btrim(l.call_confirm) = ''::text OR lower(btrim(l.call_confirm)) <> 'exitoso'::text) AND (l.cc_whatsapp IS NULL OR btrim(l.cc_whatsapp) = ''::text OR lower(btrim(l.cc_whatsapp)) <> 'exitoso'::text)) AS aplicaciones_no_calificaban_cc,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm IS NULL OR btrim(l.call_confirm) = ''::text OR lower(btrim(l.call_confirm)) <> 'exitoso'::text) AND (l.cc_whatsapp IS NULL OR btrim(l.cc_whatsapp) = ''::text OR lower(btrim(l.cc_whatsapp)) <> 'exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) AS llamadas_venta_asistidas_ccne,
    COALESCE(vne.ventas_ccne, 0::bigint) AS ventas_ccne,
    COALESCE(vtas.ventas_totales, 0::bigint) AS ventas_totales,
        CASE
            WHEN (count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) + count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm IS NULL OR btrim(l.call_confirm) = ''::text OR lower(btrim(l.call_confirm)) <> 'exitoso'::text) AND (l.cc_whatsapp IS NULL OR btrim(l.cc_whatsapp) = ''::text OR lower(btrim(l.cc_whatsapp)) <> 'exitoso'::text) AND l.llamada_meg = 'Efectuada'::text)) = 0 THEN 0::numeric
            ELSE COALESCE(vtas.ventas_totales::numeric, 0::numeric) / (count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) + count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm IS NULL OR btrim(l.call_confirm) = ''::text OR lower(btrim(l.call_confirm)) <> 'exitoso'::text) AND (l.cc_whatsapp IS NULL OR btrim(l.cc_whatsapp) = ''::text OR lower(btrim(l.cc_whatsapp)) <> 'exitoso'::text) AND l.llamada_meg = 'Efectuada'::text))::numeric
        END AS tasa_de_cierre
   FROM esqueleto e
     LEFT JOIN lead_norm l ON l.fecha_agenda_date = e.fecha AND l.origen_norm = e.origen
     LEFT JOIN ( SELECT comp_norm.fecha_acred_date,
            comp_norm.origen_norm AS origen,
            sum(comp_norm.cash_collected) AS cash_collected_total
           FROM comp_norm
          WHERE upper(COALESCE(comp_norm.producto_format, ''::text)) <> 'CLUB'::text AND comp_norm.fecha_acred_date IS NOT NULL
          GROUP BY comp_norm.fecha_acred_date, comp_norm.origen_norm) cc ON e.fecha = cc.fecha_acred_date AND e.origen = cc.origen
     LEFT JOIN ( SELECT comp_norm.fecha_acred_date,
            comp_norm.origen_norm AS origen,
            sum(comp_norm.facturacion) AS facturacion_total
           FROM comp_norm
          WHERE upper(COALESCE(comp_norm.producto_format, ''::text)) <> 'CLUB'::text AND comp_norm.fecha_acred_date IS NOT NULL
          GROUP BY comp_norm.fecha_acred_date, comp_norm.origen_norm) fact ON e.fecha = fact.fecha_acred_date AND e.origen = fact.origen
     LEFT JOIN ( SELECT comp_norm.fecha_agendamiento_date,
            comp_norm.origen_norm AS origen,
            count(*) AS ventas_totales
           FROM comp_norm
          WHERE comp_norm.fecha_agendamiento_date IS NOT NULL AND lower(COALESCE(comp_norm.tipo, ''::text)) = 'venta'::text AND NULLIF(btrim(comp_norm.producto_format), ''::text) IS NOT NULL AND lower(btrim(comp_norm.producto_format)) <> 'empty'::text AND lower(btrim(comp_norm.producto_format)) !~~ '%club%'::text
          GROUP BY comp_norm.fecha_agendamiento_date, comp_norm.origen_norm) vtas ON e.fecha = vtas.fecha_agendamiento_date AND e.origen = vtas.origen
     LEFT JOIN ( SELECT comp_norm.fecha_agendamiento_date,
            comp_norm.origen_norm AS origen,
            count(*) AS ventas_cce
           FROM comp_norm
          WHERE comp_norm.fecha_agendamiento_date IS NOT NULL AND lower(COALESCE(comp_norm.tipo, ''::text)) = 'venta'::text AND NULLIF(btrim(comp_norm.producto_format), ''::text) IS NOT NULL AND lower(btrim(comp_norm.producto_format)) <> 'empty'::text AND lower(btrim(comp_norm.producto_format)) !~~ '%club%'::text AND comp_norm.estado_cc = 'Exitoso'::text
          GROUP BY comp_norm.fecha_agendamiento_date, comp_norm.origen_norm) vce ON e.fecha = vce.fecha_agendamiento_date AND e.origen = vce.origen
     LEFT JOIN ( SELECT comp_norm.fecha_agendamiento_date,
            comp_norm.origen_norm AS origen,
            count(*) AS ventas_ccne
           FROM comp_norm
          WHERE comp_norm.fecha_agendamiento_date IS NOT NULL AND lower(COALESCE(comp_norm.tipo, ''::text)) = 'venta'::text AND NULLIF(btrim(comp_norm.producto_format), ''::text) IS NOT NULL AND lower(btrim(comp_norm.producto_format)) <> 'empty'::text AND lower(btrim(comp_norm.producto_format)) !~~ '%club%'::text AND comp_norm.estado_cc = 'No exitoso'::text
          GROUP BY comp_norm.fecha_agendamiento_date, comp_norm.origen_norm) vne ON e.fecha = vne.fecha_agendamiento_date AND e.origen = vne.origen
  GROUP BY e.fecha, e.origen, cc.cash_collected_total, fact.facturacion_total, vtas.ventas_totales, vce.ventas_cce, vne.ventas_ccne
  ORDER BY e.fecha DESC, e.origen;
DO $check$ BEGIN
 IF EXISTS ((SELECT * FROM public.kpi_marketing_diario EXCEPT ALL SELECT * FROM public.disk_io_candidate)
 UNION ALL (SELECT * FROM public.disk_io_candidate EXCEPT ALL SELECT * FROM public.kpi_marketing_diario))
 THEN RAISE EXCEPTION 'Result mismatch for kpi_marketing_diario'; END IF;
 END $check$;
CREATE OR REPLACE VIEW public.kpi_marketing_diario AS  WITH lead_source AS (
 SELECT l_1.id,l_1.ghlid,l_1.last_edited_time,l_1.created_time,l_1.fecha_agenda,
 l_1.aplica,l_1.agendo,l_1.call_confirm,l_1.llamada_cc,l_1.llamada_meg,l_1.cc_whatsapp,
 NULLIF(btrim(l_1.origen_actual), ''::text) AS marketing_origin FROM leads_raw l_1 WHERE NULLIF(btrim(l_1.origen_actual), ''::text) IS NOT NULL
        ), lead_origin_by_ghl AS (
         SELECT DISTINCT ON ((lower(btrim(l_1.ghlid)))) lower(btrim(l_1.ghlid)) AS ghlid_key,
            l_1.marketing_origin
           FROM lead_source l_1
          WHERE NULLIF(btrim(l_1.ghlid), ''::text) IS NOT NULL AND l_1.marketing_origin IS NOT NULL
          ORDER BY (lower(btrim(l_1.ghlid))), l_1.last_edited_time DESC NULLS LAST, l_1.created_time DESC NULLS LAST
        ), lead_norm AS (
 SELECT l_1.id,l_1.aplica,l_1.agendo,l_1.call_confirm,l_1.llamada_cc,l_1.llamada_meg,l_1.cc_whatsapp,
 date(l_1.fecha_agenda) AS fecha_agenda_date,
                CASE
                    WHEN l_1.marketing_origin ~~* 'Postulación MEG - %'::text THEN
                    CASE
                        WHEN split_part(l_1.marketing_origin, ' - '::text, 2) ~~* '%VSL%'::text THEN 'VSL'::text
                        WHEN split_part(l_1.marketing_origin, ' - '::text, 2) ~~* '%ORG%'::text THEN 'ORG'::text
                        WHEN split_part(l_1.marketing_origin, ' - '::text, 2) ~~* '%APSET%'::text THEN 'APSET'::text
                        ELSE split_part(l_1.marketing_origin, ' - '::text, 2)
                    END
                    ELSE l_1.marketing_origin
                END AS origen_norm
           FROM lead_source l_1
          WHERE l_1.fecha_agenda IS NOT NULL AND l_1.marketing_origin IS NOT NULL
        ), comp_source AS (
 SELECT c.f_acreditacion,c.fecha_de_agendamiento,c.producto_format,c.cash_collected,c.facturacion,c.tipo,c.estado_cc,
 NULLIF(btrim(lo.marketing_origin), ''::text) AS marketing_origin
           FROM comprobantes_cash_metricas c
             LEFT JOIN lead_origin_by_ghl lo ON lo.ghlid_key = lower(btrim(c.ghlid))
        ), comp_norm AS (
 SELECT c.producto_format,c.cash_collected,c.facturacion,c.tipo,c.estado_cc,
 date(c.f_acreditacion) AS fecha_acred_date,
            date(c.fecha_de_agendamiento) AS fecha_agendamiento_date,
                CASE
                    WHEN c.marketing_origin ~~* 'Postulación MEG - %'::text THEN
                    CASE
                        WHEN split_part(c.marketing_origin, ' - '::text, 2) ~~* '%VSL%'::text THEN 'VSL'::text
                        WHEN split_part(c.marketing_origin, ' - '::text, 2) ~~* '%ORG%'::text THEN 'ORG'::text
                        WHEN split_part(c.marketing_origin, ' - '::text, 2) ~~* '%APSET%'::text THEN 'APSET'::text
                        ELSE split_part(c.marketing_origin, ' - '::text, 2)
                    END
                    ELSE c.marketing_origin
                END AS origen_norm
           FROM comp_source c
          WHERE c.marketing_origin IS NOT NULL
        ), fechas AS (
         SELECT DISTINCT lead_norm.fecha_agenda_date AS fecha
           FROM lead_norm
        ), origenes AS (
         SELECT lead_norm.origen_norm AS origen
           FROM lead_norm
        UNION
         SELECT comp_norm.origen_norm AS origen
           FROM comp_norm
        ), esqueleto AS (
         SELECT f.fecha,
            o.origen
           FROM fechas f
             CROSS JOIN origenes o
        )
 SELECT e.fecha,
    e.origen,
    count(l.*) AS reuniones_agendadas,
    count(l.*) FILTER (WHERE l.aplica = 'Aplica'::text) AS agendas_aplicables,
    COALESCE(cc.cash_collected_total, 0::numeric) AS cash_collected,
    COALESCE(fact.facturacion_total, 0::numeric) AS facturacion,
    count(l.*) AS aplicaciones_formulario,
    count(l.*) FILTER (WHERE l.aplica = 'Aplica'::text) AS aplicaciones_aplicables_ghl,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text)) AS leads_contactados_cc,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text)) AS call_confirmer_exitosos,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) AS llamadas_venta_asistidas_cce,
    COALESCE(vce.ventas_cce, 0::bigint) AS ventas_cce,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm IS NULL OR btrim(l.call_confirm) = ''::text OR lower(btrim(l.call_confirm)) <> 'exitoso'::text) AND (l.cc_whatsapp IS NULL OR btrim(l.cc_whatsapp) = ''::text OR lower(btrim(l.cc_whatsapp)) <> 'exitoso'::text)) AS aplicaciones_no_calificaban_cc,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm IS NULL OR btrim(l.call_confirm) = ''::text OR lower(btrim(l.call_confirm)) <> 'exitoso'::text) AND (l.cc_whatsapp IS NULL OR btrim(l.cc_whatsapp) = ''::text OR lower(btrim(l.cc_whatsapp)) <> 'exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) AS llamadas_venta_asistidas_ccne,
    COALESCE(vne.ventas_ccne, 0::bigint) AS ventas_ccne,
    COALESCE(vtas.ventas_totales, 0::bigint) AS ventas_totales,
        CASE
            WHEN (count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) + count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm IS NULL OR btrim(l.call_confirm) = ''::text OR lower(btrim(l.call_confirm)) <> 'exitoso'::text) AND (l.cc_whatsapp IS NULL OR btrim(l.cc_whatsapp) = ''::text OR lower(btrim(l.cc_whatsapp)) <> 'exitoso'::text) AND l.llamada_meg = 'Efectuada'::text)) = 0 THEN 0::numeric
            ELSE COALESCE(vtas.ventas_totales::numeric, 0::numeric) / (count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) + count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm IS NULL OR btrim(l.call_confirm) = ''::text OR lower(btrim(l.call_confirm)) <> 'exitoso'::text) AND (l.cc_whatsapp IS NULL OR btrim(l.cc_whatsapp) = ''::text OR lower(btrim(l.cc_whatsapp)) <> 'exitoso'::text) AND l.llamada_meg = 'Efectuada'::text))::numeric
        END AS tasa_de_cierre
   FROM esqueleto e
     LEFT JOIN lead_norm l ON l.fecha_agenda_date = e.fecha AND l.origen_norm = e.origen
     LEFT JOIN ( SELECT comp_norm.fecha_acred_date,
            comp_norm.origen_norm AS origen,
            sum(comp_norm.cash_collected) AS cash_collected_total
           FROM comp_norm
          WHERE upper(COALESCE(comp_norm.producto_format, ''::text)) <> 'CLUB'::text AND comp_norm.fecha_acred_date IS NOT NULL
          GROUP BY comp_norm.fecha_acred_date, comp_norm.origen_norm) cc ON e.fecha = cc.fecha_acred_date AND e.origen = cc.origen
     LEFT JOIN ( SELECT comp_norm.fecha_acred_date,
            comp_norm.origen_norm AS origen,
            sum(comp_norm.facturacion) AS facturacion_total
           FROM comp_norm
          WHERE upper(COALESCE(comp_norm.producto_format, ''::text)) <> 'CLUB'::text AND comp_norm.fecha_acred_date IS NOT NULL
          GROUP BY comp_norm.fecha_acred_date, comp_norm.origen_norm) fact ON e.fecha = fact.fecha_acred_date AND e.origen = fact.origen
     LEFT JOIN ( SELECT comp_norm.fecha_agendamiento_date,
            comp_norm.origen_norm AS origen,
            count(*) AS ventas_totales
           FROM comp_norm
          WHERE comp_norm.fecha_agendamiento_date IS NOT NULL AND lower(COALESCE(comp_norm.tipo, ''::text)) = 'venta'::text AND NULLIF(btrim(comp_norm.producto_format), ''::text) IS NOT NULL AND lower(btrim(comp_norm.producto_format)) <> 'empty'::text AND lower(btrim(comp_norm.producto_format)) !~~ '%club%'::text
          GROUP BY comp_norm.fecha_agendamiento_date, comp_norm.origen_norm) vtas ON e.fecha = vtas.fecha_agendamiento_date AND e.origen = vtas.origen
     LEFT JOIN ( SELECT comp_norm.fecha_agendamiento_date,
            comp_norm.origen_norm AS origen,
            count(*) AS ventas_cce
           FROM comp_norm
          WHERE comp_norm.fecha_agendamiento_date IS NOT NULL AND lower(COALESCE(comp_norm.tipo, ''::text)) = 'venta'::text AND NULLIF(btrim(comp_norm.producto_format), ''::text) IS NOT NULL AND lower(btrim(comp_norm.producto_format)) <> 'empty'::text AND lower(btrim(comp_norm.producto_format)) !~~ '%club%'::text AND comp_norm.estado_cc = 'Exitoso'::text
          GROUP BY comp_norm.fecha_agendamiento_date, comp_norm.origen_norm) vce ON e.fecha = vce.fecha_agendamiento_date AND e.origen = vce.origen
     LEFT JOIN ( SELECT comp_norm.fecha_agendamiento_date,
            comp_norm.origen_norm AS origen,
            count(*) AS ventas_ccne
           FROM comp_norm
          WHERE comp_norm.fecha_agendamiento_date IS NOT NULL AND lower(COALESCE(comp_norm.tipo, ''::text)) = 'venta'::text AND NULLIF(btrim(comp_norm.producto_format), ''::text) IS NOT NULL AND lower(btrim(comp_norm.producto_format)) <> 'empty'::text AND lower(btrim(comp_norm.producto_format)) !~~ '%club%'::text AND comp_norm.estado_cc = 'No exitoso'::text
          GROUP BY comp_norm.fecha_agendamiento_date, comp_norm.origen_norm) vne ON e.fecha = vne.fecha_agendamiento_date AND e.origen = vne.origen
  GROUP BY e.fecha, e.origen, cc.cash_collected_total, fact.facturacion_total, vtas.ventas_totales, vce.ventas_cce, vne.ventas_ccne
  ORDER BY e.fecha DESC, e.origen;
DROP VIEW public.disk_io_candidate;
CREATE VIEW public.disk_io_candidate AS  WITH lead_keys AS NOT MATERIALIZED (
         SELECT l_1.id,
            l_1.ghlid,
            l_1.nombre,
            l_1.closer,
            l_1.setter,
            l_1.fecha_agenda,
            l_1.fecha_llamada,
            l_1.llamada_meg,
            l_1.last_edited_time,
            l_1.origen_actual,
            COALESCE(NULLIF(l_1.ghlid, ''::text), 'lead:'::text || l_1.id) AS person_key
           FROM leads_raw l_1
        ), leads AS (
         SELECT DISTINCT ON (lead_keys.person_key) lead_keys.person_key,
            lead_keys.id,
            lead_keys.ghlid,
            lead_keys.nombre,
            lead_keys.closer,
            lead_keys.setter,
            lead_keys.fecha_agenda,
            lead_keys.fecha_llamada,
            lead_keys.llamada_meg,
            lead_keys.last_edited_time,
            lead_keys.origen_actual
           FROM lead_keys
          ORDER BY lead_keys.person_key, lead_keys.last_edited_time DESC NULLS LAST, lead_keys.id
        ), clients AS (
         SELECT DISTINCT ON ((COALESCE(NULLIF(c_1.ghlid, ''::text), l_1.person_key, 'csm:'::text || c_1.id))) COALESCE(NULLIF(c_1.ghlid, ''::text), l_1.person_key, 'csm:'::text || c_1.id) AS person_key,
            c_1.id,
            c_1.ghlid,
            c_1.nombre,
            c_1.acceso,
            c_1.contrato,
            c_1.onboarding,
            c_1.f_onboarding,
            c_1.f_acceso,
            c_1.fecha_final,
            c_1.pausa,
            c_1.abandono,
            c_1.despedida,
            c_1.updated_at,
            c_1.closer
           FROM csm c_1
             LEFT JOIN lead_keys l_1 ON l_1.id = c_1.crm_2_0
          ORDER BY (COALESCE(NULLIF(c_1.ghlid, ''::text), l_1.person_key, 'csm:'::text || c_1.id)), c_1.updated_at DESC NULLS LAST, c_1.id
        ), receipts AS (
         SELECT COALESCE(NULLIF(c_1.ghlid, ''::text), l_1.person_key, 'receipt:'::text || c_1.id) AS person_key,
            jsonb_agg(jsonb_build_object('id', c_1.id, 'tipo', c_1.tipo, 'product', c_1.producto_format, 'estado', c_1.estado, 'rebotar_pago', c_1.rebotar_pago, 'saleDate', c_1.f_venta, 'createdAt', c_1.fecha_creado, 'closer', c_1.responsable_venta) ORDER BY c_1.f_venta DESC NULLS LAST, c_1.id) AS items,
            max(c_1.cliente_format) AS nombre
           FROM comprobantes c_1
             LEFT JOIN lead_keys l_1 ON l_1.id = c_1.cliente
          GROUP BY (COALESCE(NULLIF(c_1.ghlid, ''::text), l_1.person_key, 'receipt:'::text || c_1.id))
        ), keys AS (
         SELECT leads.person_key
           FROM leads
          WHERE leads.fecha_agenda >= (CURRENT_DATE - 30) OR leads.fecha_llamada >= ((CURRENT_DATE - 30)::text)
        UNION
         SELECT clients.person_key
           FROM clients
          WHERE lower(clients.acceso) = 'acceso'::text OR lower(clients.contrato) = 'pendiente'::text OR lower(clients.onboarding) = 'pendiente'::text
        UNION
         SELECT receipts.person_key
           FROM receipts
          WHERE (EXISTS ( SELECT 1
                   FROM jsonb_array_elements(receipts.items) item(value)
                  WHERE lower(COALESCE(item.value ->> 'estado'::text, ''::text)) <> 'conciliado'::text OR (item.value ->> 'rebotar_pago'::text) = 'true'::text OR lower(item.value ->> 'tipo'::text) = 'venta'::text AND (item.value ->> 'saleDate'::text) >= ((CURRENT_DATE - 90)::text)))
        ), ghl AS MATERIALIZED (
         SELECT g_1.ghlid,
            (g_1.fields -> 'calendar'::text) -> 'value'::text AS calendar,
            (g_1.fields -> 'Webinar 28/10 Setter'::text) ->> 'value'::text AS webinar_setter,
            g_1.updated_at
           FROM keys k_1 JOIN LATERAL (SELECT ghlid,fields,updated_at FROM leads_ghl_contacts WHERE ghlid=k_1.person_key OFFSET 0) g_1 ON true
        ), diagnostics AS (
         SELECT DISTINCT ON (csm_diagnosticos.client_ghlid) csm_diagnosticos.client_ghlid,
            COALESCE(NULLIF(((csm_diagnosticos.data -> 'checkpoints'::text) -> 'inicial'::text) ->> 'csm'::text, ''::text), csm_diagnosticos.csm_name) AS ccm
           FROM csm_diagnosticos
          WHERE csm_diagnosticos.client_ghlid IS NOT NULL
          ORDER BY csm_diagnosticos.client_ghlid, csm_diagnosticos.updated_at DESC NULLS LAST, csm_diagnosticos.id
        )
 SELECT k.person_key AS id,
    COALESCE(NULLIF(l.ghlid, ''::text), NULLIF(c.ghlid, ''::text),
        CASE
            WHEN k.person_key !~~ '%:%'::text THEN k.person_key
            ELSE NULL::text
        END) AS ghlid,
    COALESCE(NULLIF(l.nombre, ''::text), NULLIF(c.nombre, ''::text), r.nombre, 'Sin nombre'::text) AS name,
    l.closer,
    l.setter,
    l.fecha_agenda,
    l.fecha_llamada,
    l.llamada_meg,
    c.id AS csm_id,
    c.acceso,
    c.contrato,
    c.onboarding,
    c.f_onboarding,
    c.f_acceso,
    c.fecha_final,
    c.pausa,
    c.abandono,
    c.despedida,
    p.support_active,
    d.ccm,
    COALESCE(r.items, '[]'::jsonb) AS receipts,
    g.calendar ->> 'calendarName'::text AS calendar_name,
    g.calendar ->> 'startTime'::text AS appointment_start,
    g.calendar ->> 'endTime'::text AS appointment_end,
    COALESCE(g.calendar ->> 'appointmentStatus'::text, g.calendar ->> 'appoinmentStatus'::text) AS appointment_status,
    g.calendar ->> 'selectedTimezone'::text AS appointment_timezone,
    COALESCE(g.calendar ->> 'date_created'::text, g.calendar ->> 'createdAt'::text) AS appointment_created,
    g.webinar_setter,
    GREATEST(g.updated_at, c.updated_at, l.last_edited_time::timestamp with time zone) AS source_updated_at,
    l.origen_actual
   FROM keys k
     LEFT JOIN leads l ON l.person_key = k.person_key
     LEFT JOIN clients c ON c.person_key = k.person_key
     LEFT JOIN receipts r ON r.person_key = k.person_key
     LEFT JOIN ghl g ON g.ghlid = k.person_key
     LEFT JOIN csm_followup_profiles p ON p.ghlid = k.person_key
     LEFT JOIN diagnostics d ON d.client_ghlid = k.person_key;
DO $check$ BEGIN
 IF EXISTS ((SELECT * FROM public.mati_world_sources EXCEPT ALL SELECT * FROM public.disk_io_candidate)
 UNION ALL (SELECT * FROM public.disk_io_candidate EXCEPT ALL SELECT * FROM public.mati_world_sources))
 THEN RAISE EXCEPTION 'Result mismatch for mati_world_sources'; END IF;
 END $check$;
CREATE OR REPLACE VIEW public.mati_world_sources AS  WITH lead_keys AS NOT MATERIALIZED (
         SELECT l_1.id,
            l_1.ghlid,
            l_1.nombre,
            l_1.closer,
            l_1.setter,
            l_1.fecha_agenda,
            l_1.fecha_llamada,
            l_1.llamada_meg,
            l_1.last_edited_time,
            l_1.origen_actual,
            COALESCE(NULLIF(l_1.ghlid, ''::text), 'lead:'::text || l_1.id) AS person_key
           FROM leads_raw l_1
        ), leads AS (
         SELECT DISTINCT ON (lead_keys.person_key) lead_keys.person_key,
            lead_keys.id,
            lead_keys.ghlid,
            lead_keys.nombre,
            lead_keys.closer,
            lead_keys.setter,
            lead_keys.fecha_agenda,
            lead_keys.fecha_llamada,
            lead_keys.llamada_meg,
            lead_keys.last_edited_time,
            lead_keys.origen_actual
           FROM lead_keys
          ORDER BY lead_keys.person_key, lead_keys.last_edited_time DESC NULLS LAST, lead_keys.id
        ), clients AS (
         SELECT DISTINCT ON ((COALESCE(NULLIF(c_1.ghlid, ''::text), l_1.person_key, 'csm:'::text || c_1.id))) COALESCE(NULLIF(c_1.ghlid, ''::text), l_1.person_key, 'csm:'::text || c_1.id) AS person_key,
            c_1.id,
            c_1.ghlid,
            c_1.nombre,
            c_1.acceso,
            c_1.contrato,
            c_1.onboarding,
            c_1.f_onboarding,
            c_1.f_acceso,
            c_1.fecha_final,
            c_1.pausa,
            c_1.abandono,
            c_1.despedida,
            c_1.updated_at,
            c_1.closer
           FROM csm c_1
             LEFT JOIN lead_keys l_1 ON l_1.id = c_1.crm_2_0
          ORDER BY (COALESCE(NULLIF(c_1.ghlid, ''::text), l_1.person_key, 'csm:'::text || c_1.id)), c_1.updated_at DESC NULLS LAST, c_1.id
        ), receipts AS (
         SELECT COALESCE(NULLIF(c_1.ghlid, ''::text), l_1.person_key, 'receipt:'::text || c_1.id) AS person_key,
            jsonb_agg(jsonb_build_object('id', c_1.id, 'tipo', c_1.tipo, 'product', c_1.producto_format, 'estado', c_1.estado, 'rebotar_pago', c_1.rebotar_pago, 'saleDate', c_1.f_venta, 'createdAt', c_1.fecha_creado, 'closer', c_1.responsable_venta) ORDER BY c_1.f_venta DESC NULLS LAST, c_1.id) AS items,
            max(c_1.cliente_format) AS nombre
           FROM comprobantes c_1
             LEFT JOIN lead_keys l_1 ON l_1.id = c_1.cliente
          GROUP BY (COALESCE(NULLIF(c_1.ghlid, ''::text), l_1.person_key, 'receipt:'::text || c_1.id))
        ), keys AS (
         SELECT leads.person_key
           FROM leads
          WHERE leads.fecha_agenda >= (CURRENT_DATE - 30) OR leads.fecha_llamada >= ((CURRENT_DATE - 30)::text)
        UNION
         SELECT clients.person_key
           FROM clients
          WHERE lower(clients.acceso) = 'acceso'::text OR lower(clients.contrato) = 'pendiente'::text OR lower(clients.onboarding) = 'pendiente'::text
        UNION
         SELECT receipts.person_key
           FROM receipts
          WHERE (EXISTS ( SELECT 1
                   FROM jsonb_array_elements(receipts.items) item(value)
                  WHERE lower(COALESCE(item.value ->> 'estado'::text, ''::text)) <> 'conciliado'::text OR (item.value ->> 'rebotar_pago'::text) = 'true'::text OR lower(item.value ->> 'tipo'::text) = 'venta'::text AND (item.value ->> 'saleDate'::text) >= ((CURRENT_DATE - 90)::text)))
        ), ghl AS MATERIALIZED (
         SELECT g_1.ghlid,
            (g_1.fields -> 'calendar'::text) -> 'value'::text AS calendar,
            (g_1.fields -> 'Webinar 28/10 Setter'::text) ->> 'value'::text AS webinar_setter,
            g_1.updated_at
           FROM keys k_1 JOIN LATERAL (SELECT ghlid,fields,updated_at FROM leads_ghl_contacts WHERE ghlid=k_1.person_key OFFSET 0) g_1 ON true
        ), diagnostics AS (
         SELECT DISTINCT ON (csm_diagnosticos.client_ghlid) csm_diagnosticos.client_ghlid,
            COALESCE(NULLIF(((csm_diagnosticos.data -> 'checkpoints'::text) -> 'inicial'::text) ->> 'csm'::text, ''::text), csm_diagnosticos.csm_name) AS ccm
           FROM csm_diagnosticos
          WHERE csm_diagnosticos.client_ghlid IS NOT NULL
          ORDER BY csm_diagnosticos.client_ghlid, csm_diagnosticos.updated_at DESC NULLS LAST, csm_diagnosticos.id
        )
 SELECT k.person_key AS id,
    COALESCE(NULLIF(l.ghlid, ''::text), NULLIF(c.ghlid, ''::text),
        CASE
            WHEN k.person_key !~~ '%:%'::text THEN k.person_key
            ELSE NULL::text
        END) AS ghlid,
    COALESCE(NULLIF(l.nombre, ''::text), NULLIF(c.nombre, ''::text), r.nombre, 'Sin nombre'::text) AS name,
    l.closer,
    l.setter,
    l.fecha_agenda,
    l.fecha_llamada,
    l.llamada_meg,
    c.id AS csm_id,
    c.acceso,
    c.contrato,
    c.onboarding,
    c.f_onboarding,
    c.f_acceso,
    c.fecha_final,
    c.pausa,
    c.abandono,
    c.despedida,
    p.support_active,
    d.ccm,
    COALESCE(r.items, '[]'::jsonb) AS receipts,
    g.calendar ->> 'calendarName'::text AS calendar_name,
    g.calendar ->> 'startTime'::text AS appointment_start,
    g.calendar ->> 'endTime'::text AS appointment_end,
    COALESCE(g.calendar ->> 'appointmentStatus'::text, g.calendar ->> 'appoinmentStatus'::text) AS appointment_status,
    g.calendar ->> 'selectedTimezone'::text AS appointment_timezone,
    COALESCE(g.calendar ->> 'date_created'::text, g.calendar ->> 'createdAt'::text) AS appointment_created,
    g.webinar_setter,
    GREATEST(g.updated_at, c.updated_at, l.last_edited_time::timestamp with time zone) AS source_updated_at,
    l.origen_actual
   FROM keys k
     LEFT JOIN leads l ON l.person_key = k.person_key
     LEFT JOIN clients c ON c.person_key = k.person_key
     LEFT JOIN receipts r ON r.person_key = k.person_key
     LEFT JOIN ghl g ON g.ghlid = k.person_key
     LEFT JOIN csm_followup_profiles p ON p.ghlid = k.person_key
     LEFT JOIN diagnostics d ON d.client_ghlid = k.person_key;
DROP VIEW public.disk_io_candidate;
NOTIFY pgrst,'reload schema';
COMMIT;
