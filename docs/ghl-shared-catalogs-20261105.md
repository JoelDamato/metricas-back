# CSM, leads y catálogos compartidos — 5/11/2026

## Alcance autorizado

Mantener Free, desactivar Mati World y conservar CSM con referencias para evitar datos duplicados.
No se fusionan contactos por nombre ni se eliminan clientes, comprobantes, contratos o seguimientos.

## Diagnóstico

- `csm` contiene 1922 fichas y ocupa unos 1,3 MiB; `leads_raw`, unos 40,7 MiB.
- 1875 fichas de CSM tienen una coincidencia única por GHL ID en leads; 47 no. No se modificaron
  esas identidades ni se forzaron coincidencias. Ya existe la relación `csm.crm_2_0`.
- El mayor consumo estaba en las copias JSON de GHL: cada tabla de snapshots ocupaba unos
  373 MiB. Muchos documentos incluían el mismo `customFieldDefinitions` de ~280 KB.
- Se conserva la separación funcional entre CSM y leads; eliminar sus siete columnas comunes
  habría ahorrado muy poco frente al riesgo de mezclar valores históricos o distintos.

## Implementación

Mati World devuelve HTTP 410 sin ejecutar consultas. Su página deja de cargar el motor y el polling.
Los recursos gráficos quedan en Git; no ocupaban la base de Supabase.

`ghl_field_catalogs` guarda cada versión exacta del catálogo una sola vez, identificada por SHA-256.
Ambos almacenes la referencian con claves foráneas. Cada versión es independiente: actualizar un
catálogo no modifica documentos antiguos ni los de otro contacto.

Las tablas físicas se llaman `leads_ghl_contacts_store` y `csm_ghl_contacts_store`. Las vistas con
los nombres originales conservan las columnas y reconstruyen exactamente los documentos.
Los sincronizadores escriben en los almacenes y un trigger normaliza automáticamente los nuevos
catálogos. Se conserva la semántica de reemplazo del último payload y mezcla de campos históricos.
El acceso continúa restringido a los roles existentes; las vistas usan `security_invoker`.

No se eliminan valores sensibles: la normalización mueve exclusivamente catálogos a una tabla
compartida. Se conservan valores nulos, vacíos, objetos tipados y catálogos dentro de `data`.

## Verificación y operación

- Prueba con PostgreSQL embebido: documentos originales/reconstruidos, upserts, catálogos nuevos,
  versiones independientes, payload sin catálogo, JSON null, wrappers, claves foráneas y permisos.
- Ambos sincronizadores reales se probaron dentro de una transacción revertida: estado `unchanged`.
- Cada fila histórica se bloquea brevemente, se compara completa antes/después y solo se confirma
  si coincide exactamente. Los hashes quedan en `ghl_catalog_compaction_audit`.
- `node scripts/compact_ghl_catalogs.cjs` es reanudable y usa lotes de 25 con timeout de 20 segundos.
  Un lote excedido se revierte completo; los anteriores permanecen verificados.
- La recuperación de espacio con VACUUM FULL se realiza solo en tablas sin filas pendientes, con
  espera de bloqueo de 2 segundos y timeout de 300 segundos. No borra filas vivas. Puede bloquear
  brevemente el acceso al almacén durante la reescritura.
- No se aumentó el plan ni se generaron cargos.

Los catálogos y sus referencias deben conservarse juntos en cualquier backup. Para recuperar un
snapshot completo se consulta la vista original; los `_store` contienen la representación normalizada.

## Auditoría final de normalización

Se verificaron 15.373 snapshots históricos completos con cero diferencias y cero filas pendientes.
Los sincronizadores continuaron recibiendo contactos nuevos durante la operación, sin errores
recientes. Las dos vistas de compatibilidad respondieron HTTP 200 con los catálogos reconstruidos.
CSM conserva sus 1.922 fichas; no se eliminaron ni fusionaron identidades.

La reescritura de CSM terminó en 26,6 segundos. El primer intento de leads alcanzó 45 segundos y
PostgreSQL lo canceló; se repitió con un límite de 120 segundos y la misma espera de bloqueo de 2 s.

Leads también superó el segundo límite de mantenimiento. Se detectó el índice GIN
`leads_ghl_contacts_fields` de 59.727.872 bytes con cero lecturas registradas; se retiró
concurrentemente en producción. Los índices únicos de identidad y lead siguen presentes.
La migración separada conserva el SQL para restaurarlo si una consulta futura lo necesita.
Se repitió la recuperación sin reconstruir ese índice; los dos intentos anteriores se revirtieron.
El intento de 120 s sin GIN también se canceló. `pg_stat_progress_cluster` confirmó que avanzaba
en la copia de registros (5.022 filas), sin esperar bloqueos; el último intento usa 300 s.

## Resultado medido

La última reescritura terminó en 100,5 segundos. Base completa: **441.691.283 bytes (442 MB)**,
frente a unos 895 MB iniciales: aproximadamente **51% menos**, por debajo de los 500 MB de Free.
El panel de facturación puede tardar en actualizar su medición.

- CSM snapshots: 57.597.952 bytes (antes ~390 MB).
- Leads snapshots: 280.084.480 bytes (antes ~391 MB, incluido GIN).
- Catálogos compartidos: 655.360 bytes.
- Auditoría de conservación: 4.259.840 bytes.
- 1.922 fichas CSM; 77.684 leads, incluidos ingresos durante el mantenimiento.
- 1.899 snapshots CSM y 13.481 de leads; cero pendientes y cero diferencias auditadas.
- APIs de ambas vistas: HTTP 200 tras el mantenimiento. Prueba PostgreSQL embebida aprobada.

Esto resuelve el exceso de tamaño medido hoy; no implica un cupo ilimitado ni garantiza que nunca
vuelva a crecer el consumo de I/O. Los catálogos futuros se normalizan automáticamente.
