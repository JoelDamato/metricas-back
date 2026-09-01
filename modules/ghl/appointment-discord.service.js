const axios = require('axios');

const DEFAULT_GHL_API_BASE = 'https://services.leadconnectorhq.com';
const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';
const CACHE_TTL_MS = 10 * 60 * 1000;
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_TARGET_SURVEYS = new Map([
  ['LJNrvdVkA8qlYJG91Acn', '1️⃣ Postulación MEG - UNICO CAB'],
  ['KdaNbMtoTTmSBRgF3IdO', '2️⃣ Postulación MEG - UNICO'],
  ['rbMEYfSbnkPn2B4LMyn1', '3️⃣ Postulación MEG - VSL UNICO'],
  ['mTnXK6n1UI4EevMYrVTn', '4️⃣ Postulacion MEG - Eventos']
]);

const DEFAULT_APPOINTMENT_LOOKUP_USER_IDS = new Set([
  'G5OKD1JQ25SWgQ7LHVGn',
  'frEN6iKQRyUT96jM4uvw',
  'JbSkrxtUBLrKst8jFXSY',
  '7YHYaj99YIpxO57MMp9e'
]);

const cache = new Map();
const notifiedAppointments = new Map();
const inFlightAppointments = new Map();

const STANDARD_FIELD_LABELS = {
  first_name: 'Nombre',
  last_name: 'Apellido',
  full_name: 'Nombre completo',
  name: 'Nombre',
  email: 'Email',
  phone: 'Teléfono',
  company_name: 'Empresa',
  companyName: 'Empresa',
  website: 'Sitio web',
  city: 'Ciudad',
  state: 'Provincia/Estado',
  country: 'País',
  postal_code: 'Código postal',
  guests: 'Invitados'
};

const SURVEY_METADATA_KEYS = new Set([
  'formId',
  'location_id',
  'query_contact_id',
  'sessionId',
  'eventData',
  'Timezone',
  'formAction',
  'calendar_id',
  'calendar_name',
  'dateFieldDetails',
  'internalSource',
  'source',
  'fieldsOriSequance',
  'submissionId',
  'signatureHash',
  'ip',
  'button',
  'contact_id',
  'contactId',
  'queryContactId',
  'calendarName',
  'contactFingerprint',
  'sessionFingerprint',
  'selected_timezone',
  'selected_slot'
]);

const TECHNICAL_SURVEY_FIELD_NAMES = new Set([
  'form postulacion',
  'origen actual',
  'cuenta',
  'score'
]);

function getConfig() {
  return {
    ghlApiKey: process.env.GHL_API_KEY || '',
    ghlLocationId: process.env.GHL_LOCATION_ID || '',
    ghlApiBase: process.env.GHL_API_BASE || DEFAULT_GHL_API_BASE,
    discordWebhookUrl: process.env.DISCORD_APPOINTMENTS_WEBHOOK_URL || '',
    timezone: process.env.GHL_APPOINTMENTS_TIMEZONE || DEFAULT_TIMEZONE,
    closerUserIds: new Set(
      String(process.env.GHL_CLOSER_USER_IDS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    ),
    appointmentLookupUserIds: new Set(
      String(process.env.GHL_APPOINTMENT_LOOKUP_USER_IDS || [...DEFAULT_APPOINTMENT_LOOKUP_USER_IDS].join(','))
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    ),
    surveyIds: new Set(
      String(process.env.GHL_APPOINTMENT_SURVEY_IDS || [...DEFAULT_TARGET_SURVEYS.keys()].join(','))
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  };
}

function assertRuntimeConfig(config) {
  const missing = [];
  if (!config.ghlApiKey) missing.push('GHL_API_KEY');
  if (!config.ghlLocationId) missing.push('GHL_LOCATION_ID');
  if (!config.discordWebhookUrl) missing.push('DISCORD_APPOINTMENTS_WEBHOOK_URL');

  if (missing.length) {
    const error = new Error(`Faltan variables para el webhook GHL/Discord: ${missing.join(', ')}`);
    error.statusCode = 503;
    throw error;
  }
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function getPayloadDiscordWebhookUrl(payload = {}) {
  const envelope = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  return firstValue(
    payload.discordWebhookUrl,
    payload.discord_webhook_url,
    payload.webhookDiscord,
    payload.webhook_discord,
    envelope.discordWebhookUrl,
    envelope.discord_webhook_url,
    envelope.webhookDiscord,
    envelope.webhook_discord
  );
}

function validateDiscordWebhookUrl(value) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    const error = new Error('discord_webhook_url no es una URL válida');
    error.statusCode = 400;
    throw error;
  }

  const allowedHosts = new Set(['discord.com', 'canary.discord.com', 'ptb.discord.com']);
  const isWebhookPath = /^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(url.pathname);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.port || !isWebhookPath) {
    const error = new Error('discord_webhook_url debe ser un webhook HTTPS válido de Discord');
    error.statusCode = 400;
    throw error;
  }

  return url.toString();
}

function resolveDiscordWebhookUrl(payload, fallbackUrl) {
  const candidate = getPayloadDiscordWebhookUrl(payload) || fallbackUrl;
  return candidate ? validateDiscordWebhookUrl(candidate) : '';
}

function discordWebhookIdentity(webhookUrl) {
  const url = new URL(webhookUrl);
  return url.pathname.split('/').filter(Boolean).slice(0, 3).join('/');
}

function normalizeAppointmentPayload(payload = {}) {
  const envelope = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const source = envelope.appointment || payload.appointment || envelope;

  return {
    type: firstValue(payload.type, envelope.type, 'AppointmentCreate'),
    locationId: firstValue(
      payload.locationId,
      payload.location_id,
      envelope.locationId,
      envelope.location_id,
      source.locationId,
      source.location_id
    ),
    id: firstValue(source.id, source.appointmentId, source.appointment_id, payload.appointmentId, payload.appointment_id),
    title: firstValue(source.title, source.appointmentTitle, source.appointment_title),
    address: firstValue(source.address, source.meetingLocation, source.meeting_location),
    calendarId: firstValue(source.calendarId, source.calendar_id, payload.calendarId, payload.calendar_id),
    contactId: firstValue(source.contactId, source.contact_id, payload.contactId, payload.contact_id),
    appointmentStatus: firstValue(source.appointmentStatus, source.appointment_status, source.status),
    assignedUserId: firstValue(source.assignedUserId, source.assigned_user_id, source.assignedTo, source.assigned_to),
    notes: firstValue(source.notes, source.description),
    source: firstValue(source.source, payload.source),
    startTime: firstValue(source.startTime, source.start_time, payload.startTime, payload.start_time),
    endTime: firstValue(source.endTime, source.end_time, payload.endTime, payload.end_time),
    dateAdded: firstValue(source.dateAdded, source.date_added, payload.dateAdded, payload.date_added),
    dateUpdated: firstValue(source.dateUpdated, source.date_updated, payload.dateUpdated, payload.date_updated)
  };
}

function validateAppointment(appointment, expectedLocationId) {
  if (appointment.type && appointment.type !== 'AppointmentCreate') {
    return { skipped: true, reason: `Evento ignorado: ${appointment.type}` };
  }

  if (appointment.locationId && appointment.locationId !== expectedLocationId) {
    const error = new Error('El locationId del webhook no coincide con la ubicación configurada');
    error.statusCode = 403;
    throw error;
  }

  const missing = ['contactId', 'calendarId', 'startTime'].filter((key) => !appointment[key]);
  if (missing.length) {
    const error = new Error(`Webhook de cita incompleto; faltan: ${missing.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  return { skipped: false };
}

function selectLatestAppointmentForContact(events = [], contactId, now = Date.now()) {
  return events
    .filter((event) => event && event.contactId === contactId && !event.deleted)
    .slice()
    .sort((left, right) => {
      const leftCreated = new Date(left.dateAdded || left.dateUpdated || '').getTime();
      const rightCreated = new Date(right.dateAdded || right.dateUpdated || '').getTime();
      const leftHasCreated = Number.isFinite(leftCreated);
      const rightHasCreated = Number.isFinite(rightCreated);

      if (leftHasCreated || rightHasCreated) {
        if (leftHasCreated !== rightHasCreated) return leftHasCreated ? -1 : 1;
        if (leftCreated !== rightCreated) return rightCreated - leftCreated;
      }

      const leftStart = new Date(left.startTime).getTime();
      const rightStart = new Date(right.startTime).getTime();
      const leftUpcoming = Number.isFinite(leftStart) && leftStart >= now;
      const rightUpcoming = Number.isFinite(rightStart) && rightStart >= now;
      if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
      if (leftUpcoming) return leftStart - rightStart;
      return rightStart - leftStart;
    })[0] || null;
}

function makeGhlClient(config) {
  return axios.create({
    baseURL: config.ghlApiBase,
    timeout: 12000,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.ghlApiKey}`
    }
  });
}

async function cached(key, loader, ttl = CACHE_TTL_MS) {
  const current = cache.get(key);
  if (current && current.expiresAt > Date.now()) return current.value;

  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}

async function ghlGet(client, path, params = {}, version = '2021-07-28') {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.get(path, {
        params,
        headers: { Version: version }
      });
      return response.data || {};
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (!retryable || attempt === 1) break;
      await wait(500 * (attempt + 1));
    }
  }

  const error = new Error(`GHL GET ${path} falló: ${lastError?.message || 'error desconocido'}`);
  error.statusCode = lastError?.response?.status || 502;
  error.cause = lastError;
  throw error;
}

async function fetchContact(client, contactId) {
  const data = await ghlGet(client, `/contacts/${encodeURIComponent(contactId)}`);
  return data.contact || data;
}

async function fetchUser(client, userId) {
  if (!userId) return null;
  return cached(`ghl-user:${userId}`, async () => {
    const data = await ghlGet(client, `/users/${encodeURIComponent(userId)}`);
    return data.user || data;
  });
}

async function fetchCalendar(client, calendarId) {
  if (!calendarId) return null;
  return cached(`ghl-calendar:${calendarId}`, async () => {
    const data = await ghlGet(client, `/calendars/${encodeURIComponent(calendarId)}`, {}, 'v3');
    return data.calendar || data;
  });
}

async function fetchLatestAppointmentForContact(client, config, contactId) {
  try {
    const directData = await ghlGet(
      client,
      `/contacts/${encodeURIComponent(contactId)}/appointments`,
      {},
      'v3'
    );
    const directEvents = (directData.events || []).map((event) => ({
      ...event,
      contactId: event.contactId || contactId
    }));
    const directAppointment = selectLatestAppointmentForContact(directEvents, contactId);
    if (directAppointment) return directAppointment;
  } catch (error) {
    // Algunos tokens antiguos no tienen el scope del endpoint por contacto.
    // En ese caso se mantiene la búsqueda por agendas como compatibilidad.
  }

  const now = Date.now();
  const startTime = now - (7 * 24 * 60 * 60 * 1000);
  const endTime = now + (548 * 24 * 60 * 60 * 1000);
  const lookupUserIds = config.appointmentLookupUserIds instanceof Set && config.appointmentLookupUserIds.size
    ? config.appointmentLookupUserIds
    : DEFAULT_APPOINTMENT_LOOKUP_USER_IDS;
  const results = await Promise.allSettled([...lookupUserIds].map((userId) => (
    ghlGet(client, '/calendars/events', {
      locationId: config.ghlLocationId,
      userId,
      startTime,
      endTime
    })
  )));
  const events = results.flatMap((result) => (
    result.status === 'fulfilled' ? (result.value.events || []) : []
  ));

  if (!events.length && results.every((result) => result.status === 'rejected')) {
    throw results[0].reason;
  }

  const appointment = selectLatestAppointmentForContact(events, contactId);
  if (!appointment) {
    const error = new Error('No se encontró una cita reciente de este contacto en las agendas de los closers');
    error.statusCode = 404;
    throw error;
  }
  return appointment;
}

async function fetchSurveysById(client, locationId) {
  return cached(`ghl-surveys:${locationId}`, async () => {
    const data = await ghlGet(client, '/surveys/', { locationId }, 'v3');
    const surveys = new Map(DEFAULT_TARGET_SURVEYS);
    (data.surveys || []).forEach((survey) => surveys.set(survey.id, survey));
    return surveys;
  });
}

async function fetchCustomField(client, locationId, fieldId) {
  return cached(`ghl-custom-field:${locationId}:${fieldId}`, async () => {
    const data = await ghlGet(
      client,
      `/locations/${encodeURIComponent(locationId)}/customFields/${encodeURIComponent(fieldId)}`,
      {},
      'v3'
    );
    return data.customField || data.field || data;
  });
}

function getPotentialCustomFieldIds(submission) {
  const others = submission?.others && typeof submission.others === 'object' ? submission.others : {};
  return Object.keys(others).filter((key) => (
    !SURVEY_METADATA_KEYS.has(key)
    && !STANDARD_FIELD_LABELS[key]
    && /^[A-Za-z0-9]{18,}$/.test(key)
  ));
}

async function fetchRelevantCustomFields(client, locationId, submission) {
  const fieldIds = getPotentialCustomFieldIds(submission);
  const results = await Promise.allSettled(
    fieldIds.map((fieldId) => fetchCustomField(client, locationId, fieldId))
  );
  const fields = new Map();
  results.forEach((result, index) => {
    if (result.status !== 'fulfilled' || !result.value) return;
    const field = result.value;
    fields.set(fieldIds[index], field);
    if (field.id) fields.set(field.id, field);
    if (field.fieldKey) fields.set(field.fieldKey, field);
  });
  return fields;
}

function isoDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

async function fetchSurveySubmissions(client, locationId, contactId, surveyIds) {
  const now = new Date();
  const start = new Date(now.getTime() - (366 * 24 * 60 * 60 * 1000));
  const end = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));
  const data = await ghlGet(client, '/surveys/submissions', {
    locationId,
    q: contactId,
    limit: 100,
    startAt: isoDateOnly(start),
    endAt: isoDateOnly(end)
  }, 'v3');

  return (data.submissions || []).filter((submission) => (
    submission.contactId === contactId
    && surveyIds.has(submission.surveyId)
  ));
}

function selectLatestSubmission(submissions = [], appointment = {}) {
  const ordered = submissions
    .filter((submission) => submission && submission.createdAt)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!ordered.length) return null;

  const cutoffValue = appointment.dateAdded || appointment.dateUpdated;
  const cutoff = cutoffValue ? new Date(cutoffValue).getTime() + (5 * 60 * 1000) : null;
  if (!Number.isFinite(cutoff)) return ordered[0];

  return ordered.find((submission) => new Date(submission.createdAt).getTime() <= cutoff) || ordered[0];
}

function stringifyAnswer(value) {
  if (value === undefined || value === null || value === '') return '';
  if (Array.isArray(value)) return value.map(stringifyAnswer).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const name = firstValue(value.name, value.label, value.title);
    const detail = firstValue(value.email, value.phone, value.value);
    if (name || detail) return [name, detail].filter(Boolean).join(' — ');
    return Object.entries(value)
      .map(([key, item]) => `${prettifyUnknownKey(key)}: ${stringifyAnswer(item)}`)
      .filter((item) => !item.endsWith(': '))
      .join(', ');
  }
  return String(value).trim();
}

function prettifyUnknownKey(key) {
  if (/^[A-Za-z0-9]{18,}$/.test(key)) return `Campo ${key}`;
  return String(key)
    .replace(/^contact\./, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isTechnicalSurveyField(key, customField) {
  const name = normalizeText(customField?.name);
  const identifiers = normalizeText(`${key} ${customField?.fieldKey || ''} ${customField?.name || ''}`);
  if (TECHNICAL_SURVEY_FIELD_NAMES.has(name)) return true;
  return /(^|[ ._\-])(utm|fbclid|fbc|fbp|adname|adset|campaign|tracking|fingerprint)([ ._\-]|$)/.test(identifiers);
}

function extractSurveyAnswers(submission, customFieldsByKey = new Map()) {
  if (!submission) return [];
  const others = submission.others && typeof submission.others === 'object' ? submission.others : {};
  const sequence = Array.isArray(others.fieldsOriSequance) ? others.fieldsOriSequance : [];
  const orderedKeys = [...new Set([...sequence, ...Object.keys(others)])];

  return orderedKeys.flatMap((key) => {
    if (SURVEY_METADATA_KEYS.has(key)) return [];
    const value = stringifyAnswer(others[key]);
    if (!value) return [];

    const customField = customFieldsByKey.get(key);
    if (isTechnicalSurveyField(key, customField)) return [];
    const label = customField?.name || STANDARD_FIELD_LABELS[key] || prettifyUnknownKey(key);
    return [{ key, label, value }];
  });
}

function truncate(value, maxLength) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function escapeMarkdown(value) {
  return String(value || '').replace(/([\\`*_{}\[\]()#+\-.!|>~])/g, '\\$1');
}

function formatContactName(contact, appointment, submission) {
  return firstValue(
    contact?.name,
    [contact?.firstName, contact?.lastName].filter(Boolean).join(' '),
    submission?.name,
    appointment.title,
    'Lead sin nombre'
  );
}

function formatDiscordTimestamp(dateValue, style = 'F') {
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return 'Fecha no informada';
  return `<t:${Math.floor(timestamp / 1000)}:${style}>`;
}

function makeLink(label, url) {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  return `[${label}](${url})`;
}

function splitBlocks(blocks, maxLength = 3900) {
  const chunks = [];
  let current = '';

  blocks.forEach((originalBlock) => {
    let block = String(originalBlock || '').trim();
    if (!block) return;

    while (block.length > maxLength) {
      const head = block.slice(0, maxLength);
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(head);
      block = block.slice(maxLength);
    }

    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > maxLength) {
      chunks.push(current);
      current = block;
    } else {
      current = candidate;
    }
  });

  if (current) chunks.push(current);
  return chunks;
}

function buildDiscordMessages({ appointment, contact, closer, calendar, submission, survey, answers, config }) {
  const contactName = formatContactName(contact, appointment, submission);
  const contactDetails = [
    contact?.email || submission?.email || submission?.others?.email,
    contact?.phone || submission?.others?.phone
  ]
    .filter(Boolean)
    .map(escapeMarkdown)
    .join('\n') || 'Sin email ni teléfono';
  const ghlContactUrl = `https://app.gohighlevel.com/v2/location/${encodeURIComponent(config.ghlLocationId)}/contacts/detail/${encodeURIComponent(appointment.contactId)}`;
  const links = makeLink('Abrir contacto en GHL', ghlContactUrl);
  const dateValue = `${formatDiscordTimestamp(appointment.startTime, 'F')}\n${formatDiscordTimestamp(appointment.startTime, 'R')}`;
  const surveyName = survey?.name
    || (typeof survey === 'string' ? survey : '')
    || submission?.others?.eventData?.parentName
    || DEFAULT_TARGET_SURVEYS.get(submission?.surveyId)
    || 'Encuesta sin identificar';

  const overviewEmbed = {
      title: '📅 Nueva agenda recibida',
      color: 0x2ECC71,
      fields: [
        { name: 'Lead', value: truncate(`**${escapeMarkdown(contactName)}**\n${contactDetails}`, 1024), inline: true },
        { name: 'Closer', value: truncate(escapeMarkdown(closer?.name || 'Sin asignar'), 1024), inline: true },
        { name: 'Fecha de la cita', value: dateValue, inline: false },
        { name: 'Calendario', value: truncate(escapeMarkdown(calendar?.name || appointment.calendarId), 1024), inline: true },
        { name: 'Estado', value: escapeMarkdown(appointment.appointmentStatus || 'nuevo'), inline: true },
        { name: 'Encuesta completada', value: truncate(escapeMarkdown(submission ? surveyName : 'No completó ninguna de las 4 encuestas configuradas'), 1024), inline: false },
        { name: 'Enlaces', value: truncate(links, 1024), inline: false }
      ],
      footer: { text: `Contacto GHL: ${appointment.contactId}` },
      timestamp: appointment.dateAdded || new Date().toISOString()
  };

  const message = {
    username: 'Agendas GHL',
    allowed_mentions: { parse: [] },
    embeds: [overviewEmbed]
  };

  if (!submission) return [message];

  const blocks = answers.length
    ? answers.map((answer) => `**${escapeMarkdown(answer.label)}**\n${escapeMarkdown(answer.value)}`)
    : ['La encuesta no tenía respuestas utilizables.'];
  const fullAnswers = blocks.join('\n\n');
  const description = fullAnswers.length > 3900
    ? `${truncate(fullAnswers, 3820)}\n\n_Las respuestas fueron recortadas por el límite de Discord._`
    : fullAnswers;

  message.embeds.push({
    title: `📝 ${truncate(surveyName, 240)}`,
    description,
    color: 0x3498DB,
    footer: {
      text: `Respuestas de ${contactName} · Enviado ${formatDiscordTimestamp(submission.createdAt, 'f')}`
    }
  });

  return [message];
}

function withWaitQuery(webhookUrl) {
  const url = new URL(webhookUrl);
  url.searchParams.set('wait', 'true');
  return url.toString();
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function postDiscordMessage(webhookUrl, message) {
  try {
    await axios.post(withWaitQuery(webhookUrl), message, { timeout: 20000 });
  } catch (error) {
    if (error.response?.status === 429) {
      const retryAfterSeconds = Number(error.response.data?.retry_after || 1);
      await wait(Math.min(Math.max(retryAfterSeconds * 1000, 1000), 10000));
      await axios.post(withWaitQuery(webhookUrl), message, { timeout: 20000 });
      return;
    }
    throw error;
  }
}

function cleanupDedupeCache() {
  const now = Date.now();
  notifiedAppointments.forEach((expiresAt, key) => {
    if (expiresAt <= now) notifiedAppointments.delete(key);
  });
}

async function processAppointmentWebhook(payload, runtime = {}) {
  const baseConfig = runtime.config || getConfig();
  const config = {
    ...baseConfig,
    discordWebhookUrl: resolveDiscordWebhookUrl(payload, baseConfig.discordWebhookUrl)
  };
  assertRuntimeConfig(config);
  let appointment = normalizeAppointmentPayload(payload);
  appointment.locationId = appointment.locationId || config.ghlLocationId;

  if (appointment.type && appointment.type !== 'AppointmentCreate') {
    return { skipped: true, reason: `Evento ignorado: ${appointment.type}` };
  }

  if (!appointment.contactId) {
    const error = new Error('Webhook incompleto; falta contact_id');
    error.statusCode = 400;
    throw error;
  }

  const client = runtime.ghlClient || makeGhlClient(config);
  if (!appointment.calendarId || !appointment.startTime) {
    const inferredAppointment = normalizeAppointmentPayload({
      type: 'AppointmentCreate',
      locationId: appointment.locationId,
      appointment: await fetchLatestAppointmentForContact(client, config, appointment.contactId)
    });
    const providedValues = Object.fromEntries(
      Object.entries(appointment).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
    appointment = { ...inferredAppointment, ...providedValues };
  }

  const validation = validateAppointment(appointment, config.ghlLocationId);
  if (validation.skipped) return validation;

  if (config.closerUserIds.size && !config.closerUserIds.has(appointment.assignedUserId)) {
    return { skipped: true, reason: 'La cita no pertenece a un closer configurado' };
  }

  cleanupDedupeCache();
  const destinationKey = discordWebhookIdentity(config.discordWebhookUrl);
  const appointmentKey = appointment.id
    ? `${appointment.locationId}:${appointment.id}`
    : `${appointment.locationId}:${appointment.contactId}:${appointment.calendarId}:${appointment.startTime}`;
  const notificationKey = `${appointmentKey}:${destinationKey}`;
  if (notifiedAppointments.has(notificationKey)) {
    return { skipped: true, duplicate: true, reason: 'La cita ya fue notificada' };
  }
  if (inFlightAppointments.has(notificationKey)) return inFlightAppointments.get(notificationKey);

  const job = (async () => {
    const surveyIds = config.surveyIds instanceof Set && config.surveyIds.size
      ? config.surveyIds
      : new Set(DEFAULT_TARGET_SURVEYS.keys());
    const enrichmentResults = await Promise.allSettled([
      fetchContact(client, appointment.contactId),
      fetchUser(client, appointment.assignedUserId),
      fetchCalendar(client, appointment.calendarId),
      fetchSurveySubmissions(client, config.ghlLocationId, appointment.contactId, surveyIds),
      fetchSurveysById(client, config.ghlLocationId)
    ]);

    const optionalValue = (index, fallback = null) => (
      enrichmentResults[index].status === 'fulfilled' ? enrichmentResults[index].value : fallback
    );
    const contact = optionalValue(0);
    const closer = optionalValue(1);
    const calendar = optionalValue(2);
    if (enrichmentResults[3].status === 'rejected') throw enrichmentResults[3].reason;
    const submissions = enrichmentResults[3].value;
    const surveysById = optionalValue(4, new Map(DEFAULT_TARGET_SURVEYS));

    const submission = selectLatestSubmission(submissions, appointment);
    const survey = submission ? surveysById.get(submission.surveyId) : null;
    const customFieldsByKey = submission
      ? await fetchRelevantCustomFields(client, config.ghlLocationId, submission)
      : new Map();
    const answers = extractSurveyAnswers(submission, customFieldsByKey);
    const messages = buildDiscordMessages({
      appointment,
      contact,
      closer,
      calendar,
      submission,
      survey,
      answers,
      config
    });

    for (const message of messages) {
      await (runtime.postDiscordMessage || postDiscordMessage)(config.discordWebhookUrl, message);
    }

    notifiedAppointments.set(notificationKey, Date.now() + DEDUPE_TTL_MS);
    return {
      skipped: false,
      notified: true,
      appointmentId: appointment.id || null,
      contactId: appointment.contactId,
      surveySubmissionId: submission?.id || null,
      discordMessages: messages.length
    };
  })().finally(() => {
    inFlightAppointments.delete(notificationKey);
  });

  inFlightAppointments.set(notificationKey, job);
  return job;
}

module.exports = {
  buildDiscordMessages,
  extractSurveyAnswers,
  getConfig,
  getPayloadDiscordWebhookUrl,
  normalizeAppointmentPayload,
  processAppointmentWebhook,
  resolveDiscordWebhookUrl,
  selectLatestAppointmentForContact,
  selectLatestSubmission,
  splitBlocks,
  validateDiscordWebhookUrl,
  validateAppointment
};
