const axios = require('axios');
const env = require('../config/env');

const TABLE_NAME = 'pdi_closer_records';
const MAX_PAYLOAD_BYTES = 500 * 1024;

function requiredEnv() {
  if (!env.supabaseUrl || !env.supabaseKey) {
    const error = new Error('Faltan las credenciales de Supabase para PDI');
    error.statusCode = 500;
    throw error;
  }
}

function headers(extra = {}) {
  requiredEnv();
  return {
    apikey: env.supabaseKey,
    Authorization: `Bearer ${env.supabaseKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function tableUrl() {
  return `${env.supabaseUrl}/rest/v1/${TABLE_NAME}`;
}

function cleanText(value, limit = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit);
}

function normalizeCloserKey(value) {
  return cleanText(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensurePayloadSize(value) {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_PAYLOAD_BYTES) return;
  const error = new Error('El PDI supera el tamaño máximo permitido');
  error.statusCode = 413;
  throw error;
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    closerKey: row.closer_key,
    closerName: row.closer_name,
    performance: cleanObject(row.performance),
    plan: cleanArray(row.action_plan),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    updatedByEmail: row.updated_by_email || null
  };
}

function buildPayload(input = {}, user = {}) {
  const closerName = cleanText(input.closerName || input.performance?.nombre);
  const closerKey = normalizeCloserKey(input.closerKey || closerName);
  if (!closerName || !closerKey) {
    const error = new Error('Indicá un nombre válido para el closer');
    error.statusCode = 400;
    throw error;
  }

  const performance = cleanObject(input.performance);
  const plan = cleanArray(input.plan);
  ensurePayloadSize({ performance, plan });

  return {
    closer_key: closerKey,
    closer_name: closerName,
    performance,
    action_plan: plan,
    updated_by_email: cleanText(user.email).toLowerCase() || null,
    updated_at: new Date().toISOString()
  };
}

function isMissingTableError(error) {
  const detail = JSON.stringify(error.response?.data || error.message || '').toLowerCase();
  return error.response?.status === 404
    || detail.includes(TABLE_NAME)
      && (detail.includes('does not exist') || detail.includes('schema cache') || detail.includes('pgrst205'));
}

async function listPdiRecords() {
  try {
    const response = await axios.get(tableUrl(), {
      headers: headers(),
      params: {
        select: 'id,closer_key,closer_name,performance,action_plan,created_at,updated_at,updated_by_email',
        order: 'closer_name.asc',
        limit: 250
      }
    });
    return {
      storageReady: true,
      records: (response.data || []).map(normalizeRow).filter(Boolean)
    };
  } catch (error) {
    if (isMissingTableError(error)) return { storageReady: false, records: [] };
    throw error;
  }
}

async function upsertPdiRecord(input, user) {
  const payload = {
    ...buildPayload(input, user),
    created_by_email: cleanText(user.email).toLowerCase() || null
  };
  try {
    const response = await axios.post(tableUrl(), payload, {
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      params: { on_conflict: 'closer_key' }
    });
    return normalizeRow(response.data?.[0]);
  } catch (error) {
    if (isMissingTableError(error)) {
      const unavailable = new Error('El almacenamiento PDI todavía no está habilitado en Supabase');
      unavailable.statusCode = 503;
      throw unavailable;
    }
    throw error;
  }
}

async function deletePdiRecord(rawCloserKey) {
  const closerKey = normalizeCloserKey(rawCloserKey);
  if (!closerKey) {
    const error = new Error('Closer inválido');
    error.statusCode = 400;
    throw error;
  }

  try {
    const response = await axios.delete(tableUrl(), {
      headers: headers({ Prefer: 'return=representation' }),
      params: { closer_key: `eq.${closerKey}` }
    });
    if (!response.data?.[0]) {
      const error = new Error('No encontré ese PDI');
      error.statusCode = 404;
      throw error;
    }
    return { deleted: true, closerKey };
  } catch (error) {
    if (isMissingTableError(error)) {
      const unavailable = new Error('El almacenamiento PDI todavía no está habilitado en Supabase');
      unavailable.statusCode = 503;
      throw unavailable;
    }
    throw error;
  }
}

module.exports = {
  listPdiRecords,
  upsertPdiRecord,
  deletePdiRecord,
  _test: {
    normalizeCloserKey,
    buildPayload,
    normalizeRow,
    isMissingTableError
  }
};
