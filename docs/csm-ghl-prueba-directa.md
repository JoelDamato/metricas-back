# GHL directo a CSM

Endpoint: POST https://central.matirandazzook.com/api/csm.
GET del mismo endpoint informa versión ghl-csm-write-v1, modo write_and_archive.

## Datos guardados

- csm: campos normalizados para el dashboard. Busca por GHL ID y conserva el ID existente; altas nuevas usan UUID propio. CRM se resuelve por GHL ID si la coincidencia es única.
- csm_ghl_events: JSON completo de cada recepción, incluyendo vacíos, arrays, campos desconocidos y respuestas. Incluye patch, advertencias, estado y valores anteriores/posteriores. Los errores de aplicación también quedan archivados.
- csm_ghl_contacts: último payload completo y unión de campos recibidos a nivel superior. El historial conserva todas las versiones de objetos anidados.

Las dos tablas nuevas son privadas con RLS; la RPC transaccional sólo está disponible al service_role. No se guardan headers. No se reenvían payloads GHL a Sheets.

## Reglas

Vacíos y ausentes no borran los datos normalizados; el JSON sí conserva esos vacíos. MP1–MP3 corresponden a módulos 8–10. Las fechas no restan tres horas. NPS toma la nota de recomendación de 0 a 10 y no el indicador Sí. Productos se normalizan a texto y conservan el array original. Los campos inválidos se archivan y generan advertencias.

Campos calculados sin equivalente recibido mantienen el valor existente, o quedan vacíos para altas: no se inventan las fórmulas de Notion. Las recepciones se aplican por orden de llegada, sin usar date_created como fecha de actualización.

Concurrencia serializada por GHL ID; reenvíos no duplican CSM. Identidades preexistentes duplicadas requieren revisión. Una vez gestionado por GHL, el registro se protege contra sobrescrituras y duplicados de escritores anteriores, incluido Notion; otros contactos conservan el circuito previo.

HTTP 200: created/updated/unchanged, captured=true, csmWritten=true.
HTTP 422: needs_review; original archivado, sin modificar CSM.
HTTP 503: guardado no confirmado; reintentar.

## Validación

9 pruebas unitarias y scripts/validate_csm_ghl_runtime.js contra PostgreSQL embebido: alta, actualización, reenvíos, vacíos, JSON íntegro, relación CRM, protección Notion y errores archivados.

Nacho: 59 campos normalizados sin advertencias. La función instalada se verificó con el payload real mediante BEGIN/ROLLBACK y preservó el ID CSM. No se aplicaron persistentemente las capturas anteriores; los próximos envíos usan este circuito.
