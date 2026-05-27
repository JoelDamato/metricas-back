ALTER TABLE IF EXISTS public.csm
  ADD COLUMN IF NOT EXISTS f_diagnostico timestamptz;
