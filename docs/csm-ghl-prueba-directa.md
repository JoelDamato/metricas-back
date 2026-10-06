# Recepción de prueba directa GHL → CSM

Endpoint indicado: `POST https://central.matirandazzook.com/api/csm` (Render).

El cambio local identifica payloads GHL con contact_id, contactId, contact.id, ghlid, ghl_id, o id acompañado de source=ghl o ubicación. Acepta envoltorio data. Las páginas y eventos Notion conservan su procesamiento anterior.

La prueba guarda el JSON original en webhook_logs con webhook_type=csm, type=ghl_preview_received, GHL ID y UUID de recepción. No guarda headers. Sólo responde éxito una vez persistida la captura; si falla devuelve 503.

Consulta CSM por GHL ID: would_update para una coincidencia, would_create sin coincidencias, ambiguous si hay varias, lookup_unavailable si falla la consulta. Es un diagnóstico de identidad; no confirma equivalencia de campos ni suficiencia para crear. mappingReady=false y csmWritten=false indican que esta etapa no crea ni actualiza CSM ni reenvía a Sheets. Las pruebas declaradas como GHL sin ID se capturan con needs_contact_id.

Después del envío real se deben revisar campos personalizados, tipos, fechas y nulos frente al mapeo de Notion. La futura escritura deberá preservar el ID existente y evitar borrar campos ausentes del payload parcial GHL.

Validación: 10 pruebas locales aprobadas. Cambio pendiente de despliegue en Render. Un POST de comprobación público fue bloqueado por revisión automática y no se ejecutó.
