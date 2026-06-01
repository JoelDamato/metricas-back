UPDATE public.metricas_usuarios
SET access_config = jsonb_strip_nulls(COALESCE(access_config, '{}'::jsonb) || jsonb_build_object('canManageUsers', true))
WHERE email IN (
  'matirandazzo@gmail.com',
  'leonardoalaniz19@gmail.com'
);
