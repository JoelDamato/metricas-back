ALTER TABLE IF EXISTS csm
  ADD COLUMN IF NOT EXISTS pago_a_diagnostico text;

ALTER TABLE IF EXISTS csm
  ADD COLUMN IF NOT EXISTS f_primer_resultado timestamptz;
