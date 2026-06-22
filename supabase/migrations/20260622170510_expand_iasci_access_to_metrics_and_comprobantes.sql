UPDATE public.metricas_usuarios
SET access_config = jsonb_strip_nulls(
  COALESCE(access_config, '{}'::jsonb)
  || jsonb_build_object(
    'useCustomAccess', true,
    'homePath', '/dashboard.html',
    'allowedPages', '[
      "dashboard.html",
      "index.html",
      "split-screen.html",
      "ranking.html",
      "agendas-totales.html",
      "agendas-ultimo-origen.html",
      "agendas-detalle-closer.html",
      "analisis-ventas.html",
      "kpi-closers.html",
      "setting.html",
      "reportes.html",
      "mag-sistema-agendas.html",
      "mag-reportes-personales.html",
      "mag-reporte-closers-2026.html",
      "mag-manual-closers.html",
      "comprobantes.html",
      "carga-comprobantes.html",
      "mis-comprobantes.html"
    ]'::jsonb,
    'allowedResources', '[
      "ranking_closers_mensual",
      "agenda_totales",
      "agenda_totales_ultimo_origen",
      "agenda_detalle_por_origen_closer",
      "kpi_closers_mensual",
      "setters",
      "setting",
      "agenda_detalle_diario_closer",
      "ventas_diario_closer",
      "cash_collected_diario_closer",
      "comprobantes"
    ]'::jsonb,
    'allowedFeatures', '{"views":["GET"]}'::jsonb
  )
)
WHERE email = 'iascinahuel@gmail.com';
