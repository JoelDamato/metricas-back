create or replace view public.kpi_marketing_diario as
 WITH fechas AS (
         SELECT DISTINCT date(leads_raw.fecha_agenda) AS fecha
           FROM leads_raw
          WHERE leads_raw.fecha_agenda IS NOT NULL
        ), origenes AS (
         SELECT DISTINCT
                CASE
                    WHEN comprobantes.origen ~~* 'Postulación MEG - %'::text THEN
                    CASE
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%VSL%'::text THEN 'VSL'::text
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%ORG%'::text THEN 'ORG'::text
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%APSET%'::text THEN 'APSET'::text
                        ELSE split_part(comprobantes.origen, ' - '::text, 2)
                    END
                    ELSE COALESCE(comprobantes.origen, 'Sin origen'::text)
                END AS origen
           FROM comprobantes
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
    count(l.*) FILTER (WHERE l.call_confirm IS NOT NULL AND l.call_confirm <> ''::text) AS leads_contactados_cc,
    count(l.*) FILTER (WHERE l.call_confirm = 'Exitoso'::text) AS call_confirmer_exitosos,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm = 'Exitoso'::text OR l.llamada_cc = 'Exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) AS llamadas_venta_asistidas_cce,
    count(l.*) FILTER (WHERE l.call_confirm = 'Exitoso'::text AND l.u_product_adquirido ~~ '%Meg%'::text) AS ventas_cce,
    count(l.*) FILTER (WHERE l.call_confirm = 'Exitoso'::text AND l.aplica <> 'Aplica'::text) AS aplicaciones_no_calificaban_cc,
    count(l.*) FILTER (WHERE l.agendo = 'Agendo'::text AND l.aplica = 'Aplica'::text AND (l.call_confirm IS NULL OR btrim(l.call_confirm) = ''::text OR lower(btrim(l.call_confirm)) <> 'exitoso'::text) AND (l.cc_whatsapp IS NULL OR btrim(l.cc_whatsapp) = ''::text OR lower(btrim(l.cc_whatsapp)) <> 'exitoso'::text) AND l.llamada_meg = 'Efectuada'::text) AS llamadas_venta_asistidas_ccne,
    count(l.*) FILTER (WHERE l.call_confirm <> 'Exitoso'::text AND l.u_product_adquirido ~~ '%Meg%'::text) AS ventas_ccne
   FROM esqueleto e
     LEFT JOIN leads_raw l ON date(l.fecha_agenda) = e.fecha AND
        CASE
            WHEN l.origen ~~* 'Postulación MEG - %'::text THEN
            CASE
                WHEN split_part(l.origen, ' - '::text, 2) ~~* '%VSL%'::text THEN 'VSL'::text
                WHEN split_part(l.origen, ' - '::text, 2) ~~* '%ORG%'::text THEN 'ORG'::text
                WHEN split_part(l.origen, ' - '::text, 2) ~~* '%APSET%'::text THEN 'APSET'::text
                ELSE split_part(l.origen, ' - '::text, 2)
            END
            ELSE COALESCE(l.origen, 'Sin origen'::text)
        END = e.origen
     LEFT JOIN ( SELECT date(comprobantes.f_acreditacion) AS fecha_acred,
                CASE
                    WHEN comprobantes.origen ~~* 'Postulación MEG - %'::text THEN
                    CASE
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%VSL%'::text THEN 'VSL'::text
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%ORG%'::text THEN 'ORG'::text
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%APSET%'::text THEN 'APSET'::text
                        ELSE split_part(comprobantes.origen, ' - '::text, 2)
                    END
                    ELSE COALESCE(comprobantes.origen, 'Sin origen'::text)
                END AS origen,
            sum(comprobantes.cash_collected) AS cash_collected_total
           FROM comprobantes
          WHERE upper(comprobantes.producto_format) <> 'CLUB'::text AND comprobantes.f_acreditacion IS NOT NULL
          GROUP BY (date(comprobantes.f_acreditacion)), (
                CASE
                    WHEN comprobantes.origen ~~* 'Postulación MEG - %'::text THEN
                    CASE
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%VSL%'::text THEN 'VSL'::text
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%ORG%'::text THEN 'ORG'::text
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%APSET%'::text THEN 'APSET'::text
                        ELSE split_part(comprobantes.origen, ' - '::text, 2)
                    END
                    ELSE COALESCE(comprobantes.origen, 'Sin origen'::text)
                END)) cc ON e.fecha = cc.fecha_acred AND e.origen = cc.origen
     LEFT JOIN ( SELECT date(comprobantes.f_acreditacion) AS fecha_acred,
                CASE
                    WHEN comprobantes.origen ~~* 'Postulación MEG - %'::text THEN
                    CASE
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%VSL%'::text THEN 'VSL'::text
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%ORG%'::text THEN 'ORG'::text
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%APSET%'::text THEN 'APSET'::text
                        ELSE split_part(comprobantes.origen, ' - '::text, 2)
                    END
                    ELSE COALESCE(comprobantes.origen, 'Sin origen'::text)
                END AS origen,
            sum(comprobantes.facturacion) AS facturacion_total
           FROM comprobantes
          WHERE upper(comprobantes.producto_format) <> 'CLUB'::text AND comprobantes.f_acreditacion IS NOT NULL
          GROUP BY (date(comprobantes.f_acreditacion)), (
                CASE
                    WHEN comprobantes.origen ~~* 'Postulación MEG - %'::text THEN
                    CASE
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%VSL%'::text THEN 'VSL'::text
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%ORG%'::text THEN 'ORG'::text
                        WHEN split_part(comprobantes.origen, ' - '::text, 2) ~~* '%APSET%'::text THEN 'APSET'::text
                        ELSE split_part(comprobantes.origen, ' - '::text, 2)
                    END
                    ELSE COALESCE(comprobantes.origen, 'Sin origen'::text)
                END)) fact ON e.fecha = fact.fecha_acred AND e.origen = fact.origen
  GROUP BY e.fecha, e.origen, cc.cash_collected_total, fact.facturacion_total
  ORDER BY e.fecha DESC, e.origen;;
