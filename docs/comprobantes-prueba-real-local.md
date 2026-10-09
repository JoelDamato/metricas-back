# Carga TEST local sobre Supabase compartido

Arranque: `npm run start:test-comprobantes` en `http://localhost:3101`.
Usa el login y la pantalla de carga habituales. El servidor se limita a loopback; el modo no se habilita con NODE_ENV=production.

No ejecuta DDL, no migra histórico y no escribe en Notion. Usa el esquema actual y el catálogo auditado incluido en el código. Los nuevos registros afectan las vistas existentes y los totales de cliente/venta. No automatiza CSM ni ARCA. La edición, baja, conciliación y lectura de adjuntos TEST ahora se resuelven directamente en Supabase, con control de autor y estado. Ver `comprobantes-directo-local.md` para el nuevo modo directo normal.

Identificación:
- `cliente_format` empieza por `[TEST]`.
- `info_comprobantes` empieza por `[TEST SUPABASE LOCAL]`, seguido de la clave de carga.
- El bloque `TEST_METADATA` identifica lote, actor, archivos y totales previos de referencia.
- Adjuntos privados en el bucket `comprobantes-test-local`.
- Respaldo local de filas y datos previos en `tmp/comprobantes-real-test/<batchId>.json`.

Las inserciones de lote y actualizaciones de totales se realizan en una transacción, con bloqueo por clave de carga y bloqueo de cliente/venta. Los reintentos consultan la marca persistida para no duplicar filas. No cerrar ni eliminar comprobantes históricos para limpiar las pruebas. Para una limpieza posterior, identificar los lotes por la marca, quitar sus contribuciones a los totales dentro de una transacción y eliminar exclusivamente sus archivos. Los valores previos son referencias de auditoría: no deben restaurarse ciegamente si hubo otras operaciones posteriores.

Validación: pruebas de carga directa y marcado; transacciones de venta/cobranza/reintento en PostgreSQL embebido; inserción real con ROLLBACK y comprobación de totales intactos; archivo temporal subido, descargado con URL firmada y eliminado. No quedaron comprobantes del chequeo en la base compartida.
