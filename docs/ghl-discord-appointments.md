# Notificaciones de agendas GHL → Discord

## Endpoint

`POST https://central.matirandazzook.com/api/ghl/appointment-booked`

## Configuración rápida en GHL

1. Ir a **Automatizaciones / Workflows** y crear o abrir el workflow que detecta una reserva.
2. Usar el trigger **Customer Booked Appointment**. Aplicar los filtros de calendario o estado que correspondan.
3. Agregar una espera de **30–60 segundos** para dar tiempo a que GHL guarde la encuesta y la cita.
4. Agregar la acción **Custom Webhook**.
5. Elegir el método `POST`.
6. Pegar como URL:

   `https://central.matirandazzook.com/api/ghl/appointment-booked`

7. Agregar estos headers:

   | Header | Valor |
   | --- | --- |
   | `Content-Type` | `application/json` |
   | `X-Webhook-Secret` | El mismo valor de `GHL_APPOINTMENT_WEBHOOK_SECRET` en Render |

8. Configurar el body como JSON y seleccionar el ID del contacto desde el selector de valores dinámicos de GHL:

```json
{
  "contact_id": "{{contact.id}}",
  "discord_webhook_url": "https://discord.com/api/webhooks/ID/TOKEN"
}
```

9. Reemplazar `discord_webhook_url` por el webhook del canal que debe recibir esa automatización.
10. Guardar, publicar el workflow y crear una cita de prueba.

No hay que enviar appointment ID, calendario, fecha, closer, nombre, email ni respuestas. El servidor obtiene todo eso desde GHL.

El servidor consulta las agendas de los cuatro closers, encuentra la cita creada más recientemente para `contact_id` y completa por API el appointment, closer, calendario, fecha, datos del contacto y su encuesta. También sigue aceptando el payload oficial completo `AppointmentCreate` de HighLevel.

`discord_webhook_url` permite elegir el canal de Discord desde cada acción de GHL, sin modificar ni volver a desplegar el código. Si se omite, se usa `DISCORD_APPOINTMENTS_WEBHOOK_URL` como destino predeterminado. Solo se aceptan URLs HTTPS oficiales de webhooks de Discord.

Los nombres exactos de los merge fields pueden variar en la interfaz de GHL. Elegir `contact.id` desde el selector de datos del trigger de cita, sin escribirlo manualmente.

## Variables de entorno en Render

```text
GHL_API_KEY=<private integration token con lectura de contactos, calendarios, encuestas, usuarios y custom fields>
GHL_LOCATION_ID=WU2z8kl23Dr3IyBW1hv5
GHL_APPOINTMENT_WEBHOOK_SECRET=<secreto largo y aleatorio>
DISCORD_APPOINTMENTS_WEBHOOK_URL=<webhook predeterminado opcional>
GHL_APPOINTMENTS_TIMEZONE=America/Argentina/Buenos_Aires
GHL_CLOSER_USER_IDS=G5OKD1JQ25SWgQ7LHVGn,frEN6iKQRyUT96jM4uvw,JbSkrxtUBLrKst8jFXSY,7YHYaj99YIpxO57MMp9e
GHL_APPOINTMENT_LOOKUP_USER_IDS=G5OKD1JQ25SWgQ7LHVGn,frEN6iKQRyUT96jM4uvw,JbSkrxtUBLrKst8jFXSY,7YHYaj99YIpxO57MMp9e
GHL_APPOINTMENT_SURVEY_IDS=LJNrvdVkA8qlYJG91Acn,KdaNbMtoTTmSBRgF3IdO,rbMEYfSbnkPn2B4LMyn1,mTnXK6n1UI4EevMYrVTn
```

`GHL_CLOSER_USER_IDS` es opcional. Si no se configura, se notifican todas las citas. Con la lista anterior solo se notifican agendas asignadas a Claudio Nicolini, Carlos Tu, Patricia Conti o Walter Alegre.

`GHL_APPOINTMENT_LOOKUP_USER_IDS` indica qué agendas debe revisar cuando GHL solo envía `contact_id`. Ya tiene los cuatro closers anteriores como valor predeterminado.

`GHL_APPOINTMENT_SURVEY_IDS` ya tiene como valor predeterminado las cuatro encuestas de Postulación MEG. Solo hace falta configurarla si esos IDs cambian.

## Respuestas del endpoint

Cuando se envía correctamente devuelve HTTP `200`, por ejemplo:

```json
{
  "ok": true,
  "notified": true,
  "appointmentId": "ID_ENCONTRADO_EN_GHL",
  "contactId": "ID_DEL_CONTACTO",
  "surveySubmissionId": "ID_DE_LA_ENCUESTA",
  "discordMessages": 1
}
```

Errores frecuentes:

- `400`: falta `contact_id` o el webhook de Discord no es válido.
- `401`: `X-Webhook-Secret` no coincide con el secreto configurado en Render.
- `404`: no se encontró una cita reciente del contacto en las agendas configuradas.
- `503`: faltan credenciales o variables de entorno en el servidor.

Si GHL reintenta el mismo envío, el servidor evita repetir la misma cita en el mismo canal durante 24 horas. Una misma cita sí puede enviarse a dos webhooks de Discord diferentes.

La notificación llega como un único mensaje: muestra lead, teléfono, email, fecha, closer, calendario, enlace al contacto y, debajo, las respuestas de la última de estas cuatro encuestas que el lead completó antes de agendar:

- `1️⃣ Postulación MEG - UNICO CAB`
- `2️⃣ Postulación MEG - UNICO`
- `3️⃣ Postulación MEG - VSL UNICO`
- `4️⃣ Postulacion MEG - Eventos`

No se consultan formularios ni otras encuestas. Tampoco se incluye el enlace de la reunión. Se omiten IP, UTM, campañas, IDs de anuncios, score, firmas internas y demás metadatos técnicos.
