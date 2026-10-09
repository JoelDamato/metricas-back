# Comprobantes directos: implementación local

Arranque: `npm run start:comprobantes`, en `http://localhost:3101`.
El proceso escucha sólo en loopback y rechaza este arranque con NODE_ENV=production.

## Implementación actual — 3 de octubre de 2026

El formulario guarda directamente en el esquema existente de Supabase. No llama a Notion ni usa la API de administración para guardar comprobantes. La migración aditiva `20261003120000_comprobantes_internal_runtime.sql` fue instalada en el Supabase compartido con autorización explícita. No se migraron ni borraron comprobantes históricos. La aplicación publicada no se desplegó.

- Nueva venta, cobranza y devolución. Una cobranza se vincula por ID a una venta anterior aunque corresponda a otro mes; conserva producto y fecha de venta.
- Productos y medios generales activos se configuran en Administración. IVA y costos del medio se descuentan de la base de comisión.
- Antes de confirmar, la revisión muestra saldo actual, saldo pendiente, saldo después de conciliar y deducciones.
- Sólo Conciliado cuenta como cobrado y genera comisión. Pendiente no reduce saldo; Rebotado revierte el cobro. La conciliación recalcula saldos dentro de la misma transacción, evitando sumar dos veces.
- Hasta tres archivos se suben en paralelo. El progreso muestra etapas y cantidad de archivos efectivamente subidos; completa al recibir confirmación del servidor.
- La clave de envío persistida impide duplicados por reintentos. Auditoría y limpieza de archivos quedan en Supabase, incluyendo recuperación tras reinicio. El trabajador local reintenta cada minuto los trabajos vencidos.
- Archivos privados con URLs firmadas. Edición y baja verifican autor, estado y cambios concurrentes. Un conciliado no se puede editar ni borrar; una venta con movimientos asociados no se puede eliminar.
- Estado del contacto muestra todas las ventas, cobranzas y devoluciones, anteriores y nuevas, sin el límite anterior de 20. Incluye cobranzas históricas vinculadas sólo mediante la venta y presenta importes pendientes, rebotados y saldo.
- Las protecciones de base preservan recibos gestionados internamente y los saldos de sus clientes frente a escrituras externas antiguas. Se activan para los registros afectados por acciones internas; no constituyen una conversión masiva de históricos.

El catálogo existente se conserva en Storage privado. Los metadatos `[SUPABASE DIRECT]` permiten reconocer las nuevas cargas sin agregar source_system al esquema histórico. Se mantiene compatibilidad con los archivos TEST anteriores, sin moverlos. El modo explícito de pruebas conserva `npm run start:test-comprobantes`.

## Webhooks y otros circuitos

El código local de `/api/comprobantes` acusa recibo e ignora eventos entrantes. El distribuidor ya no reenvía ni borra comprobantes. Conciliación, edición y baja guardan en Supabase sin fallback a Notion. El webhook de clientes deja de tomar totales financieros desde Notion.

Estos cambios de aplicación aún requieren despliegue para regir en el servidor publicado. Las protecciones de base instaladas ya están disponibles. No se agregó una automatización de CSM ni de ARCA.

## Validación

74 pruebas focalizadas aprobadas: carga multipart, progreso, catálogo, permisos, comisiones, historial, webhook retirado y subidas paralelas con recuperación ante errores.

`scripts/validate_comprobantes_runtime.js` ejecuta el adaptador nuevo y las funciones SQL contra PostgreSQL embebido: alta, cobranza de venta anterior, idempotencia, edición, permisos, conciliación/rebote/reconciliación, protección frente a webhook antiguo, baja y reintento de limpieza. Verifica también una cobranza histórica relacionada sólo por venta. No realiza solicitudes externas. PGlite se puede indicar mediante PGLITE_PACKAGE_PATH.

En Supabase real se verificaron por lectura la RPC, el catálogo y una vista previa financiera sin persistir comprobantes. Navegador: servidor local hasta login; formulario e historial con datos controlados en escritorio y móvil, sin errores JavaScript ni desborde horizontal. No se crearon comprobantes comerciales de prueba en la base compartida durante esta validación.

## Motivo de rebote y reenvío

La migración aditiva `20261003140000_comprobantes_motivo_rebote.sql` está instalada. Al rebotar se exige un motivo de 1 a 1000 caracteres, visible en Conciliación y Mis comprobantes. El editor del autor muestra el motivo y ofrece **Guardar y reenviar a conciliación**. La corrección y el pase a pendiente son atómicos; el motivo anterior queda en la auditoría `resubmitted`. El reenvío no concilia ni genera cobro/comisión. Rebotados históricos sin motivo muestran “Sin motivo registrado”.

Validación adicional: 50 pruebas focalizadas, recorrido PostgreSQL con rechazo sin motivo, permisos de autor y auditoría de reenvío; navegador con motivo escapado, corrección y regreso a pendiente. Campo comprobado por lectura en Supabase real. Servidor local reiniciado; aplicación publicada sin desplegar.

## Prueba real final

El recorrido autenticado con Supabase real se completó y pasó el 3 de octubre de 2026. Ver `docs/prueba-comprobantes-real-2026-10-03.md`: carga por closer, rebote con motivo por administración, corrección y reenvío por closer, conciliación, saldos y comisiones reales, reversión y limpieza de datos y archivo TEST. Esta prueba sustituye la limitación previa de haber validado la interfaz sólo con respuestas controladas.
