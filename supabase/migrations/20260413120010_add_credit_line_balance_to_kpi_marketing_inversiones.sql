ALTER TABLE public.kpi_marketing_inversiones
  ADD COLUMN IF NOT EXISTS saldo_restante_linea_credito numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.kpi_marketing_inversiones'::regclass
      AND conname = 'kpi_marketing_inversiones_saldo_restante_linea_credito_check'
  ) THEN
    ALTER TABLE public.kpi_marketing_inversiones
      ADD CONSTRAINT kpi_marketing_inversiones_saldo_restante_linea_credito_check
      CHECK (saldo_restante_linea_credito >= 0);
  END IF;
END $$;
