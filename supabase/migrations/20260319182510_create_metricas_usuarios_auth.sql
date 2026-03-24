CREATE TABLE IF NOT EXISTS public.metricas_usuarios (
  id bigserial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  nombre text,
  role text NOT NULL CHECK (role IN ('total', 'csm', 'comercial')),
  password_hash text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.metricas_usuarios (email, nombre, role, password_hash, activo)
VALUES (
  'matirandazzo@gmail.com',
  'Mati Randazzo',
  'total',
  'e8eeb7a47e5944e271e24e83b62d0e61:5977fb385ec56acb196844f1045a41781d11e315d721e0dde2757e82c6beaf3eccad73c5a3152911ef8a3065164f5925796a261ef244490bb5d9e7519554f2c0',
  true
)
ON CONFLICT (email) DO UPDATE
SET role = EXCLUDED.role,
    activo = true,
    nombre = EXCLUDED.nombre;
