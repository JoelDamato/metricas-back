CREATE TABLE IF NOT EXISTS public.kpi_marketing_inversiones (
  id bigserial PRIMARY KEY,
  fecha_desde date NOT NULL,
  fecha_hasta date NOT NULL,
  origen text NOT NULL DEFAULT '__ALL__',
  inversion_planificada numeric NOT NULL DEFAULT 0,
  inversion_realizada numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kpi_marketing_inversiones_fecha_check CHECK (fecha_hasta >= fecha_desde),
  CONSTRAINT kpi_marketing_inversiones_unique UNIQUE (fecha_desde, fecha_hasta, origen)
);
