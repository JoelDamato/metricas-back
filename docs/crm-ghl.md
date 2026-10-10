# CRM directo desde GHL

`POST https://central.matirandazzook.com/api/crm` acepta el mismo webhook completo de contacto que CSM. No hace falta construir un payload de Notion. Se requieren `contact_id` y `location.id` (`WU2z8kl23Dr3IyBW1hv5`); un contacto nuevo necesita nombre. `GET /api/crm` describe las capacidades. No se modificó `/api/csm`.

Los campos existentes se normalizan hacia `leads_raw`. Cada evento completo, su antes/después y advertencias quedan en `leads_ghl_events`. `leads_ghl_contacts` conserva los campos acumulados y el último envío. `leads_ghl_fields` registra automáticamente nombres y tipos observados. `leads_ghl_field_values` permite consultar un campo nuevo por contacto sin agregar columnas SQL. Los campos desconocidos quedan disponibles como datos; no se les inventa una regla de negocio ni una métrica.

## Contrato

- Formato webhook plano, `customData`, `contact` y `customFields` (objeto o array). Los arrays con IDs usan el catálogo GHL auditado; si hay credenciales GHL en el servidor, se renueva cada cinco minutos. También se aceptan `customFieldDefinitions`. Un ID desconocido se conserva y genera una advertencia, sin asignarlo por semejanza a otra columna.
- Valores ausentes, vacíos e inválidos no borran columnas anteriores. El valor original, incluso vacío, se archiva en el evento. Borrar un campo existente no se infiere de un webhook parcial.
- Fechas ISO y `DD/MM/YYYY` estrictas. Un día sin hora conserva su día; un instante con zona se convierte a hora argentina para las columnas históricas sin zona. Las fechas de creación existentes se conservan para mantener cohortes.
- `contact_source` corresponde a `origen`; `Origen actual` y `Primer Origen` siguen separados. `Call Confirmer`, `Confirmo`, `Seguimientos Setting` y `Estrategia aperturas` conservan las equivalencias comprobadas con CRM.
- Si llega `date_updated`, `dateUpdated` o `updatedAt` con zona, un evento anterior se archiva como `stale` sin sobrescribir. Sin esa marca temporal sólo se conoce el orden de recepción. `eventId`/`webhookEventId` permite reconocer reintentos; sin él, el upsert sigue sin duplicar contactos.
- El servidor busca por GHL ID y conserva el ID actual de `leads_raw`. Duplicados existentes se registran para revisión: nunca se elige uno arbitrariamente.
- Un primer envío exitoso activa la protección contra actualizaciones y borrados posteriores de Notion para ese contacto. Los contactos que todavía no migraron siguen aceptando la integración anterior. No se hace una carga masiva ni se borran históricos al instalar.

## Cálculos internos

Etapa, recursos y enlace WhatsApp se calculan internamente. Último producto, fechas de venta, facturación, cobros y deuda usan los comprobantes vinculados en Supabase, incluidos los anteriores al cambio. Sólo los conciliados suman cobro; rebotes y pendientes no. El saldo del cliente descuenta IVA del cash, sin descontarle cargos del medio de pago. Las comisiones conservan su circuito existente.

Se recalcula al recibir GHL o cambiar comprobantes. Un trabajo horario actualiza la antigüedad de deuda (más de 60 días desde el último cobro conciliado). Los importes históricos que no tienen comprobantes individuales se conservan una sola vez como saldo inicial en `extra.ghl_opening_balance`, con el origen y los totales anteriores. No crean ventas ni comisiones. Se agregan a los movimientos posteriores sin duplicarse. Si la diferencia implica un cobro inicial negativo o superior a la facturación inicial, el evento requiere revisión antes de modificar el contacto. Se preservan productos y fechas históricos cuando no hay comprobantes disponibles. Este circuito no escribe en CSM ni en Notion.

## Operación

- `200`: `created`, `updated`, `unchanged`, o `stale`. Revisar `leadWritten` y `warnings`.
- `422`: evento archivado, `needs_review`, sin modificación del lead. El motivo queda en `message` y en la auditoría.
- `503`: no se pudo confirmar persistencia; el emisor debe reintentar.
- Configuración opcional: `GHL_LEADS_WEBHOOK_SECRET` exige el mismo valor en `x-webhook-token`.

Instalar `20261010120000_leads_ghl_ingestion.sql` y `20261010130000_preserve_crm_opening_balances.sql` antes de desplegar. Conectar el webhook GHL a `/api/crm`, validar el primer envío y después detener el flujo CRM de Notion. La instalación sola no reemplaza los workflows de GHL. La integración de tickets con Notion es independiente.

Validación: pruebas de mapeo, HTTP y PostgreSQL real embebido en `test/leads-ghl-*.test.js`; incluye reintentos, formatos de fecha, valores vacíos, nuevas propiedades, protección de IDs, permisos, financieros y los triggers existentes de comprobantes.
