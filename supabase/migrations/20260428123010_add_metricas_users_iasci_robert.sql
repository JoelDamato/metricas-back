INSERT INTO public.metricas_usuarios (email, nombre, role, password_hash, activo)
VALUES
  (
    'iascinahuel@gmail.com',
    'Nahuel Iasci',
    'comercial',
    'ffaab17dcc057751feb9263ece3cb6e4:755f5a1871a637dbc83602f7ee27b5bb44288f9d03b548dfea05c30c07a1a6465895f47796ef8e404997a3f3d064c74955a1ac23e676e7c0f2de4758613959ab',
    true
  ),
  (
    'robertoboero83@gmail.com',
    'Rober',
    'comercial',
    '2321578536de3ecf910e1ce1cfe0589a:7c4a16086c5b95b3b5616e024ae01568c3bc707b059b12a7079221f31d5e5a854f606ba25ba4114ae1b427f08b124e42946a45d62c0792c971d34df5742846af',
    true
  )
ON CONFLICT (email) DO UPDATE
SET nombre = EXCLUDED.nombre,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash,
    activo = true,
    updated_at = now();
