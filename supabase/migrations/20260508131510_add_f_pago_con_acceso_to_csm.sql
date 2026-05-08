ALTER TABLE IF EXISTS public.csm
  ADD COLUMN IF NOT EXISTS f_pago_con_acceso timestamptz;
