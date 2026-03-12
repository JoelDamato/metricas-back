-- Archivo de migración: Añadir columnas necesarias a la tabla `csm`
-- Ejecutar con psql o desde el SQL editor de Supabase (requiere service_role o permisos de DDL)
-- Esta versión usa sentencias separadas para mayor compatibilidad con distintos ejecutores.

ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS pago_a_onbo text;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS diagnostico_7dias text;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS proximo_renovar_15d text;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS proximo_renovar_30d text;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS f_acceso timestamptz;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS activos boolean;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS f_abandono timestamptz;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS modelo_negocio text;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS nps_1 integer;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS nps_2 integer;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS nps_3 integer;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS nps_4 integer;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS nps_5 integer;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS nps_6 integer;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS nps_7 integer;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS nps_8 integer;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS nps_9 integer;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS nps_10 integer;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS insatisfecho boolean;
ALTER TABLE IF EXISTS csm ADD COLUMN IF NOT EXISTS solicito_devolucion boolean;
