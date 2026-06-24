INSERT INTO public.metricas_usuarios (email, nombre, role, password_hash, activo, access_config)
VALUES (
  'sofiangallardod@gmail.com',
  'Sofia Gallardo',
  'csm',
  '27f1d705407249d3a34081c0eb9f397f:72c5c51802045ff56e66b476c21757ec996bc966df3ba1433f8f79c0e3792273cfd551ed1174f48d8556999d66e9c65e433beb0111afba923662aea7100b11bf',
  true,
  jsonb_build_object(
    'useCustomAccess', true,
    'homePath', '/views/csm-tiempo.html',
    'allowedPages', '["csm-tiempo.html","csm-situacion.html","csm-renovaciones.html","comprobantes.html","carga-comprobantes.html","mis-comprobantes.html"]'::jsonb,
    'allowedResources', '["csm","comprobantes","leads_raw"]'::jsonb,
    'allowedFeatures', '{"views":["GET"]}'::jsonb
  )
)
ON CONFLICT (email) DO UPDATE
SET nombre = EXCLUDED.nombre,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash,
    activo = true,
    access_config = EXCLUDED.access_config,
    updated_at = now();
