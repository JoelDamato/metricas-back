const test = require('node:test');
const assert = require('node:assert/strict');

const appointmentDiscordService = require('../modules/ghl/appointment-discord.service');
const appointmentDiscordController = require('../controllers/ghlAppointmentDiscord');
const {
  buildDiscordMessages,
  extractSurveyAnswers,
  getPayloadDiscordWebhookUrl,
  normalizeAppointmentPayload,
  resolveDiscordWebhookUrl,
  selectLatestAppointmentForContact,
  selectLatestSubmission,
  splitBlocks,
  validateAppointment
} = appointmentDiscordService;

test('el webhook de citas entra sin token temporal ni header de autorización', async (t) => {
  t.mock.method(appointmentDiscordService, 'processAppointmentWebhook', async (payload) => ({
    skipped: false,
    appointmentId: payload.appointment_id
  }));

  const req = {
    body: { appointment_id: 'appointment-public-1' },
    headers: {},
    query: {}
  };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  let forwardedError = null;

  await appointmentDiscordController.handleAppointmentBooked(req, res, (error) => {
    forwardedError = error;
  });

  assert.equal(forwardedError, null);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    ok: true,
    skipped: false,
    appointmentId: 'appointment-public-1'
  });
});

test('acepta un webhook de Discord distinto en cada payload', () => {
  const url = 'https://discord.com/api/webhooks/123456789/token_de_prueba';
  assert.equal(getPayloadDiscordWebhookUrl({ discord_webhook_url: url }), url);
  assert.equal(resolveDiscordWebhookUrl({ discord_webhook_url: url }, ''), url);
});

test('rechaza destinos que no sean webhooks oficiales de Discord', () => {
  assert.throws(
    () => resolveDiscordWebhookUrl({ discord_webhook_url: 'https://example.com/api/webhooks/123/token' }, ''),
    /webhook HTTPS válido de Discord/
  );
});

test('encuentra la cita creada más recientemente usando únicamente el ID del contacto', () => {
  const selected = selectLatestAppointmentForContact([
    {
      id: 'otra-persona',
      contactId: 'contact-2',
      dateAdded: '2026-08-13T15:00:00Z'
    },
    {
      id: 'anterior',
      contactId: 'contact-1',
      dateAdded: '2026-08-13T14:00:00Z'
    },
    {
      id: 'correcta',
      contactId: 'contact-1',
      dateAdded: '2026-08-13T14:30:00Z'
    }
  ], 'contact-1');

  assert.equal(selected.id, 'correcta');
});

test('normaliza el payload oficial AppointmentCreate de GHL', () => {
  const appointment = normalizeAppointmentPayload({
    type: 'AppointmentCreate',
    locationId: 'location-1',
    appointment: {
      id: 'appointment-1',
      contactId: 'contact-1',
      calendarId: 'calendar-1',
      assignedUserId: 'closer-1',
      startTime: '2026-08-14T10:00:00-03:00'
    }
  });

  assert.equal(appointment.id, 'appointment-1');
  assert.equal(appointment.contactId, 'contact-1');
  assert.equal(appointment.assignedUserId, 'closer-1');
  assert.deepEqual(validateAppointment(appointment, 'location-1'), { skipped: false });
});

test('acepta payload plano para una automatización Custom Webhook de GHL', () => {
  const appointment = normalizeAppointmentPayload({
    location_id: 'location-1',
    appointment_id: 'appointment-1',
    contact_id: 'contact-1',
    calendar_id: 'calendar-1',
    assigned_user_id: 'closer-1',
    start_time: '2026-08-14T10:00:00-03:00'
  });

  assert.equal(appointment.locationId, 'location-1');
  assert.equal(appointment.startTime, '2026-08-14T10:00:00-03:00');
});

test('elige la última submission anterior a la creación de la cita', () => {
  const selected = selectLatestSubmission([
    { id: 'old', createdAt: '2026-08-10T10:00:00.000Z' },
    { id: 'right', createdAt: '2026-08-11T13:39:17.000Z' },
    { id: 'future', createdAt: '2026-08-20T10:00:00.000Z' }
  ], { dateAdded: '2026-08-11T13:39:41.000Z' });

  assert.equal(selected.id, 'right');
});

test('traduce IDs de campos y elimina metadata y tracking de la encuesta', () => {
  const answers = extractSurveyAnswers({
    others: {
      fieldsOriSequance: ['first_name', 'custom-1', 'tracking-1', 'score-1'],
      first_name: 'Lucas',
      'custom-1': 'Necesito ordenar las finanzas',
      'tracking-1': 'paid',
      'score-1': 3,
      signatureHash: 'secreto-técnico',
      ip: '127.0.0.1',
      eventData: { source: 'tracking' }
    }
  }, new Map([
    ['custom-1', { name: '¿Por qué decidís sumarte a esta llamada?' }],
    ['tracking-1', { name: 'utm_medium', fieldKey: 'contact.utm_medium' }],
    ['score-1', { name: 'Score', fieldKey: 'contact.score_score' }]
  ]));

  assert.deepEqual(answers, [
    { key: 'first_name', label: 'Nombre', value: 'Lucas' },
    {
      key: 'custom-1',
      label: '¿Por qué decidís sumarte a esta llamada?',
      value: 'Necesito ordenar las finanzas'
    }
  ]);
});

test('arma mensajes de Discord con cita, closer y respuestas', () => {
  const messages = buildDiscordMessages({
    appointment: {
      id: 'appointment-1',
      contactId: 'contact-1',
      calendarId: 'calendar-1',
      assignedUserId: 'closer-1',
      appointmentStatus: 'confirmed',
      startTime: '2026-08-14T10:00:00-03:00',
      address: 'https://meet.google.com/test'
    },
    contact: { name: 'Lucas Carpi', email: 'lucas@example.com', phone: '+5491112345678' },
    closer: { name: 'Patricia Conti' },
    calendar: { name: 'Postulación MEG' },
    submission: { id: 'submission-1', createdAt: '2026-08-13T12:00:00Z', surveyId: 'survey-1', others: {} },
    survey: { id: 'survey-1', name: '3️⃣ Postulación MEG - VSL UNICO' },
    answers: [{ label: 'Objetivo', value: 'Ordenar la rentabilidad del negocio' }],
    config: { ghlLocationId: 'location-1' }
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].embeds.length, 2);
  assert.match(JSON.stringify(messages[0]), /Patricia Conti/);
  assert.match(JSON.stringify(messages[0]), /Lucas Carpi/);
  assert.match(JSON.stringify(messages[0]), /Ordenar la rentabilidad/);
  assert.match(JSON.stringify(messages[0]), /Encuesta completada/);
  assert.doesNotMatch(JSON.stringify(messages[0]), /Entrar a la reunión/);
  assert.doesNotMatch(JSON.stringify(messages[0]), /meet\.google\.com/);
  assert.deepEqual(messages[0].allowed_mentions, { parse: [] });
});

test('incluye invitados de la encuesta como información legible', () => {
  const answers = extractSurveyAnswers({
    others: {
      guests: [
        { name: 'Romina Ferraro', email: 'romina@example.com' },
        { name: 'Darío Loforte', email: 'dario@example.com' }
      ]
    }
  });

  assert.equal(answers[0].label, 'Invitados');
  assert.match(answers[0].value, /Romina Ferraro — romina@example\.com/);
  assert.match(answers[0].value, /Darío Loforte — dario@example\.com/);
});

test('divide encuestas extensas respetando el máximo de descripción', () => {
  const chunks = splitBlocks(['a'.repeat(3000), 'b'.repeat(3000)], 3900);
  assert.equal(chunks.length, 2);
  assert.ok(chunks.every((chunk) => chunk.length <= 3900));
});
