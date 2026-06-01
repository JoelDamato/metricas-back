ALTER TABLE public.metricas_usuarios
ADD COLUMN IF NOT EXISTS access_config jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.metricas_usuarios
SET access_config = COALESCE(access_config, '{}'::jsonb) || jsonb_build_object('marketingOnly', true)
WHERE email IN (
  'juanma@romsconsultora.com',
  'fran@romsconsultora.com',
  'tomas@romsconsultora.com'
);

UPDATE public.metricas_usuarios
SET access_config = COALESCE(access_config, '{}'::jsonb) || jsonb_build_object('restrictedCommercial', true)
WHERE email IN (
  'walteralegre56@gmail.com',
  'posadaelmontecito@gmail.com',
  'charliecarlostu@gmail.com',
  'meg.claudionicolini@gmail.com',
  'gaitanmauro23@gmail.com',
  'pmbutera1234@gmail.com'
);

UPDATE public.metricas_usuarios
SET access_config = COALESCE(access_config, '{}'::jsonb) || jsonb_build_object('csmOnly', true)
WHERE email IN (
  'valecalmet@gmail.com',
  'belenherrera.gestion@gmail.com',
  'glcosta.gc11@gmail.com'
);

UPDATE public.metricas_usuarios
SET access_config = COALESCE(access_config, '{}'::jsonb) || jsonb_build_object('canEditReportesPremio', true)
WHERE email IN ('leonardoalaniz19@gmail.com');

UPDATE public.metricas_usuarios
SET access_config = COALESCE(access_config, '{}'::jsonb) || jsonb_build_object('canGenerateCloserAiReport', true)
WHERE email IN ('leonardoalaniz19@gmail.com', 'matirandazzo@gmail.com');

UPDATE public.metricas_usuarios
SET access_config = jsonb_strip_nulls(
  COALESCE(access_config, '{}'::jsonb)
  || jsonb_build_object(
    'useCustomAccess', true,
    'homePath', '/metricas/views/setting.html',
    'allowedPages', '["setting.html"]'::jsonb,
    'allowedResources', '["setters"]'::jsonb,
    'allowedFeatures', '{}'::jsonb
  )
)
WHERE email = 'iascinahuel@gmail.com';

UPDATE public.metricas_usuarios
SET access_config = jsonb_strip_nulls(
  COALESCE(access_config, '{}'::jsonb)
  || jsonb_build_object(
    'useCustomAccess', true,
    'homePath', '/metricas',
    'allowedPages', '["index.html","ranking.html","agendas-totales.html","analisis-ventas.html","mag-sistema-agendas.html","mag-reportes-personales.html","mag-reporte-closers-2026.html","mag-manual-closers.html","setting.html","leads-bdd.html","marketing.html"]'::jsonb,
    'allowedResources', '["ranking_closers_mensual","agenda_totales","setters","leads_raw","kpi_marketing_diario","kpi_marketing_inversiones","comprobantes"]'::jsonb,
    'allowedFeatures', '{"marketing_inversion":["GET"]}'::jsonb
  )
)
WHERE email = 'robertoboero83@gmail.com';
