UPDATE public.metricas_usuarios
SET access_config = jsonb_strip_nulls(
  COALESCE(access_config, '{}'::jsonb)
  || jsonb_build_object('canAccessAdministration', true)
)
WHERE lower(email) = 'matirandazzo@gmail.com';
