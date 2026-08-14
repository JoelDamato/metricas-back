UPDATE public.metricas_usuarios
SET activo = false,
    updated_at = now()
WHERE LOWER(BTRIM(email)) = 'pmbutera1234@gmail.com';
