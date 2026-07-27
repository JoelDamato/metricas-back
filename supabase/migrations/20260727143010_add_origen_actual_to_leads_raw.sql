ALTER TABLE IF EXISTS public.leads_raw
  ADD COLUMN IF NOT EXISTS origen_actual text;
