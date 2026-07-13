const axios = require('axios');
const crypto = require('crypto');
const env = require('../config/env');

function requiredEnv() {
  if (!env.supabaseUrl || !env.supabaseKey) {
    const error = new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en variables de entorno');
    error.statusCode = 500;
    throw error;
  }
}

function buildHeaders(extra = {}) {
  requiredEnv();
  return {
    apikey: env.supabaseKey,
    Authorization: `Bearer ${env.supabaseKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function buildStorageHeaders(extra = {}) {
  requiredEnv();
  return {
    apikey: env.supabaseKey,
    Authorization: `Bearer ${env.supabaseKey}`,
    ...extra
  };
}

function parseLimit(rawLimit) {
  const limit = Number(rawLimit || 100);
  if (Number.isNaN(limit) || limit <= 0 || limit > 1000) {
    return 100;
  }
  return limit;
}

function parseOffset(rawOffset) {
  const offset = Number(rawOffset || 0);
  if (Number.isNaN(offset) || offset < 0) {
    return 0;
  }
  return offset;
}

function parseList(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeResourceName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9_]/g, '');
}

function normalizeSelect(value) {
  const fields = parseList(value)
    .map((field) => normalizeResourceName(field))
    .filter(Boolean);

  return fields.length ? fields.join(',') : '*';
}

function normalizePercentNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function slugifyStorageSegment(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function validateMonthKey(value) {
  return /^\d{4}-\d{2}$/.test(String(value || '').trim());
}

function encodeStoragePath(pathValue) {
  return String(pathValue || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeReportePersonalPdfParams(params = {}) {
  const closer = String(params.closer || '').trim();
  const month = String(params.month || '').trim();
  const filename = String(params.filename || '').trim();

  if (!closer) {
    const error = new Error('Falta el closer para el PDF personal');
    error.statusCode = 400;
    throw error;
  }

  if (!validateMonthKey(month)) {
    const error = new Error('El mes debe venir en formato YYYY-MM');
    error.statusCode = 400;
    throw error;
  }

  const closerSlug = slugifyStorageSegment(closer);
  if (!closerSlug) {
    const error = new Error('Closer inválido para guardar el PDF');
    error.statusCode = 400;
    throw error;
  }

  return {
    bucket: env.reportesPersonalesBucket,
    closer,
    month,
    closerSlug,
    safeFilename: filename || `reporte-personal-${closerSlug}-${month}.pdf`,
    objectPath: `closers/${month}/${closerSlug}.pdf`
  };
}

function normalizeReportePersonalReportParams(params = {}) {
  const closer = String(params.closer || '').trim();
  const month = String(params.month || '').trim();

  if (!closer) {
    const error = new Error('Falta el closer para el reporte personal');
    error.statusCode = 400;
    throw error;
  }

  if (!validateMonthKey(month)) {
    const error = new Error('El mes debe venir en formato YYYY-MM');
    error.statusCode = 400;
    throw error;
  }

  const closerSlug = slugifyStorageSegment(closer);
  if (!closerSlug) {
    const error = new Error('Closer inválido para guardar el reporte');
    error.statusCode = 400;
    throw error;
  }

  return {
    bucket: env.reportesPersonalesDataBucket,
    closer,
    month,
    closerSlug,
    objectPath: `closers/${month}/${closerSlug}.json`
  };
}

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function nextDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function resourceListFromOpenApi(openApi) {
  const paths = openApi?.paths || {};
  const resources = [];

  Object.keys(paths).forEach((pathName) => {
    if (!pathName.startsWith('/')) return;

    const resource = pathName.slice(1);
    if (!resource || resource.startsWith('rpc/')) return;

    const methods = Object.keys(paths[pathName] || {}).map((m) => m.toLowerCase());
    if (!methods.includes('get')) return;

    resources.push(resource);
  });

  return [...new Set(resources)].sort((a, b) => a.localeCompare(b));
}

async function listResources() {
  const configuredViews = parseList(process.env.SUPABASE_VIEWS);
  if (configuredViews.length) {
    return configuredViews;
  }

  try {
    const url = `${env.supabaseUrl}/rest/v1/`;
    const response = await axios.get(url, {
      headers: buildHeaders({ Accept: 'application/openapi+json' })
    });

    const resources = resourceListFromOpenApi(response.data);
    if (resources.length) {
      return resources;
    }
  } catch (error) {
    // Fallback manejado abajo
  }

  const fallback = [env.tables.clientes, env.tables.metricas, env.tables.objetivos].filter(Boolean);
  return [...new Set(fallback)];
}

function applyDateFilter(params, from, to, dateField) {
  if (!from && !to) return;

  const field = normalizeResourceName(dateField || 'created_at') || 'created_at';
  const safeTo = isDateOnly(to) ? nextDate(to) : to;
  const toOperator = isDateOnly(to) ? 'lt' : 'lte';

  if (from && to) {
    params.and = `(${field}.gte.${from},${field}.${toOperator}.${safeTo})`;
    return;
  }

  if (from) {
    params[field] = `gte.${from}`;
    return;
  }

  params[field] = `${toOperator}.${safeTo}`;
}

async function listRows(resourceName, options = {}) {
  const resource = normalizeResourceName(resourceName);
  if (!resource) {
    const error = new Error('Nombre de vista/tabla inválido');
    error.statusCode = 400;
    throw error;
  }

  const limit = parseLimit(options.limit);
  const offset = parseOffset(options.offset);
  const params = {
    select: normalizeSelect(options.select),
    limit,
    offset
  };

  if (options.orderBy) {
    const orderBy = normalizeResourceName(options.orderBy);
    if (orderBy) {
      const direction = options.orderDir === 'asc' ? 'asc' : 'desc';
      params.order = `${orderBy}.${direction}`;
    }
  }

  if (options.eqFilters && typeof options.eqFilters === 'object') {
    Object.entries(options.eqFilters).forEach(([field, value]) => {
      const safeField = normalizeResourceName(field);
      if (!safeField) return;
      if (value === undefined || value === null || value === '') return;
      params[safeField] = `eq.${value}`;
    });
  }

  applyDateFilter(params, options.from, options.to, options.dateField);

  const url = `${env.supabaseUrl}/rest/v1/${resource}`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params
    });

    return response.data;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error consultando ${resource}: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function getKpiCloserRules({ anio, mes }) {
  const year = Number(anio);
  const month = Number(mes);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const error = new Error('Parámetros inválidos para reglas KPI (anio/mes)');
    error.statusCode = 400;
    throw error;
  }

  const url = `${env.supabaseUrl}/rest/v1/kpi_closers_rules`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: '*',
        anio: `eq.${year}`,
        mes: `eq.${month}`,
        limit: 1
      }
    });

    return response.data?.[0] || null;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error leyendo reglas KPI: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

function getLegacyAgendaBonusDefaults(year, month) {
  const safeYear = Number(year);
  const safeMonth = Number(month);
  const legacyWeeklyBase = safeYear === 2026 && safeMonth === 5 ? 12500 : 16500;
  const legacyWeeklyTarget = safeYear === 2026 && safeMonth === 5 ? 16500 : 20000;

  return {
    anio: safeYear,
    mes: safeMonth,
    monto_base_mensual: Number(legacyWeeklyBase.toFixed(2)),
    objetivo_mensual: Number(legacyWeeklyTarget.toFixed(2)),
    updated_at: null,
    updated_by_email: null,
    is_default: true
  };
}

function getAgendaBonusRulesStorageMeta({ anio, mes }) {
  return {
    bucket: env.reportesPersonalesDataBucket,
    objectPath: `config/agendas/bonus/${anio}-${String(mes).padStart(2, '0')}.json`
  };
}

async function readAgendaBonusRulesFromStorage({ anio, mes }) {
  await ensureReportesPersonalesDataBucket();
  const meta = getAgendaBonusRulesStorageMeta({ anio, mes });
  const url = `${env.supabaseUrl}/storage/v1/object/${meta.bucket}/${encodeStoragePath(meta.objectPath)}`;

  try {
    const response = await axios.get(url, {
      headers: buildStorageHeaders(),
      responseType: 'text'
    });
    const raw = typeof response.data === 'string'
      ? response.data
      : Buffer.isBuffer(response.data)
        ? response.data.toString('utf8')
        : JSON.stringify(response.data || {});
    const row = JSON.parse(raw || '{}');

    return {
      anio: Number(row.anio || anio),
      mes: Number(row.mes || mes),
      monto_base_mensual: Number(row.monto_base_mensual || 0),
      objetivo_mensual: Number(row.objetivo_mensual || 0),
      updated_at: row.updated_at || row.savedAt || null,
      updated_by_email: row.updated_by_email || row.savedBy || null,
      is_default: row.is_default === true
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const message = String(err.response?.data?.message || err.message || '');
    if (status === 400 || status === 404 || /not found/i.test(message)) {
      return null;
    }

    const error = new Error(`Error leyendo reglas de agenda bonus desde storage: ${message}`);
    error.statusCode = status;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function saveAgendaBonusRulesToStorage(config = {}, user) {
  await ensureReportesPersonalesDataBucket();
  const meta = getAgendaBonusRulesStorageMeta(config);
  const uploadUrl = `${env.supabaseUrl}/storage/v1/object/${meta.bucket}/${encodeStoragePath(meta.objectPath)}`;
  const body = Buffer.from(JSON.stringify({
    ...config,
    savedAt: new Date().toISOString(),
    savedBy: String(user?.email || '').trim().toLowerCase() || null
  }, null, 2), 'utf8');

  await axios.post(uploadUrl, body, {
    headers: buildStorageHeaders({
      'Content-Type': 'application/json',
      'x-upsert': 'true',
      'cache-control': '3600'
    }),
    maxBodyLength: Infinity
  });

  return {
    anio: Number(config.anio || 0),
    mes: Number(config.mes || 0),
    monto_base_mensual: Number(config.monto_base_mensual || 0),
    objetivo_mensual: Number(config.objetivo_mensual || 0),
    updated_at: config.updated_at || null,
    updated_by_email: config.updated_by_email || null,
    is_default: config.is_default === true
  };
}

async function getAgendaBonusRules({ anio, mes }) {
  const year = Number(anio);
  const month = Number(mes);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const error = new Error('Parámetros inválidos para reglas de agenda bonus (anio/mes)');
    error.statusCode = 400;
    throw error;
  }

  const url = `${env.supabaseUrl}/rest/v1/agenda_bonus_rules`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: '*',
        anio: `eq.${year}`,
        mes: `eq.${month}`,
        limit: 1
      }
    });

    const row = response.data?.[0] || null;
    if (!row) {
      const storageConfig = await readAgendaBonusRulesFromStorage({ anio: year, mes: month });
      return storageConfig || getLegacyAgendaBonusDefaults(year, month);
    }

    return {
      anio: year,
      mes: month,
      monto_base_mensual: Number(row.monto_base_mensual || 0),
      objetivo_mensual: Number(row.objetivo_mensual || 0),
      updated_at: row.updated_at || null,
      updated_by_email: row.updated_by_email || null,
      is_default: false
    };
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const isMissingTable = String(message || '').includes("Could not find the table 'public.agenda_bonus_rules' in the schema cache");
    if (isMissingTable) {
      console.warn('[agenda_bonus_rules] tabla no disponible en Supabase; usando storage como respaldo');
      const storageConfig = await readAgendaBonusRulesFromStorage({ anio: year, mes: month });
      return storageConfig || getLegacyAgendaBonusDefaults(year, month);
    }

    const error = new Error(`Error leyendo reglas de agenda bonus: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function upsertAgendaBonusRules(payload, user) {
  const year = Number(payload.anio);
  const month = Number(payload.mes);
  const montoBaseMensual = Number(payload.monto_base_mensual);
  const objetivoMensual = Number(payload.objetivo_mensual);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const error = new Error('Parámetros inválidos para guardar reglas de agenda bonus (anio/mes)');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(montoBaseMensual) || montoBaseMensual < 0) {
    const error = new Error('El monto base semanal debe ser un número mayor o igual a 0');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isFinite(objetivoMensual) || objetivoMensual < 0) {
    const error = new Error('El objetivo semanal debe ser un número mayor o igual a 0');
    error.statusCode = 400;
    throw error;
  }

  if (objetivoMensual < montoBaseMensual) {
    const error = new Error('El objetivo semanal no puede ser menor al monto base semanal');
    error.statusCode = 400;
    throw error;
  }

  const body = {
    anio: year,
    mes: month,
    monto_base_mensual: montoBaseMensual,
    objetivo_mensual: objetivoMensual,
    updated_at: new Date().toISOString(),
    updated_by_email: String(user?.email || '').trim().toLowerCase() || null
  };

  const url = `${env.supabaseUrl}/rest/v1/agenda_bonus_rules`;

  try {
    const response = await axios.post(url, body, {
      headers: buildHeaders({
        Prefer: 'resolution=merge-duplicates,return=representation'
      }),
      params: {
        on_conflict: 'anio,mes'
      }
    });

    const row = response.data?.[0] || body;
    const normalized = {
      anio: year,
      mes: month,
      monto_base_mensual: Number(row.monto_base_mensual || 0),
      objetivo_mensual: Number(row.objetivo_mensual || 0),
      updated_at: row.updated_at || body.updated_at,
      updated_by_email: row.updated_by_email || body.updated_by_email,
      is_default: false
    };
    await saveAgendaBonusRulesToStorage(normalized, user);
    return normalized;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const isMissingTable = String(message || '').includes("Could not find the table 'public.agenda_bonus_rules' in the schema cache");
    if (isMissingTable) {
      console.warn('[agenda_bonus_rules] tabla no disponible en Supabase; guardando config en storage');
      return saveAgendaBonusRulesToStorage({
        anio: year,
        mes: month,
        monto_base_mensual: montoBaseMensual,
        objetivo_mensual: objetivoMensual,
        updated_at: body.updated_at,
        updated_by_email: body.updated_by_email,
        is_default: false
      }, user);
    }

    const error = new Error(`Error guardando reglas de agenda bonus: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function listAgendaCalendarAssignments({ anio, mes }) {
  const year = Number(anio);
  const month = Number(mes);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const error = new Error('Parámetros inválidos para asignaciones de calendario (anio/mes)');
    error.statusCode = 400;
    throw error;
  }

  const url = `${env.supabaseUrl}/rest/v1/agenda_calendar_assignments`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: 'anio,mes,closer_nombre,calendar_letter,updated_at,updated_by_email',
        anio: `eq.${year}`,
        mes: `eq.${month}`,
        order: 'closer_nombre.asc'
      }
    });

    return (response.data || []).map((row) => ({
      anio: Number(row.anio || year),
      mes: Number(row.mes || month),
      closer_nombre: String(row.closer_nombre || '').trim(),
      calendar_letter: String(row.calendar_letter || '').trim().toUpperCase(),
      updated_at: row.updated_at || null,
      updated_by_email: row.updated_by_email || null
    }));
  } catch (err) {
    const details = err.response?.data || null;
    const message = details?.message || err.message;
    const isMissingTable = String(message || '').includes("Could not find the table 'public.agenda_calendar_assignments' in the schema cache");
    if (isMissingTable) {
      console.warn('[agenda_calendar_assignments] tabla no disponible en Supabase; devolviendo lista vacia');
      return [];
    }

    const error = new Error(`Error leyendo asignaciones de calendario: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = details;
    throw error;
  }
}

async function upsertAgendaCalendarAssignment(payload, user) {
  const year = Number(payload.anio);
  const month = Number(payload.mes);
  const closerNombre = String(payload.closer_nombre || '').trim();
  const calendarLetter = String(payload.calendar_letter || '').trim().toUpperCase();

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const error = new Error('Parámetros inválidos para guardar asignación de calendario (anio/mes)');
    error.statusCode = 400;
    throw error;
  }

  if (!closerNombre) {
    const error = new Error('El nombre del closer es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  if (!['A', 'B', 'C', 'D', 'E'].includes(calendarLetter)) {
    const error = new Error('El calendario debe ser una letra entre A y E');
    error.statusCode = 400;
    throw error;
  }

  const body = {
    anio: year,
    mes: month,
    closer_nombre: closerNombre,
    calendar_letter: calendarLetter,
    updated_at: new Date().toISOString(),
    updated_by_email: String(user?.email || '').trim().toLowerCase() || null
  };

  const url = `${env.supabaseUrl}/rest/v1/agenda_calendar_assignments`;

  try {
    const response = await axios.post(url, body, {
      headers: buildHeaders({
        Prefer: 'resolution=merge-duplicates,return=representation'
      }),
      params: {
        on_conflict: 'anio,mes,closer_nombre'
      }
    });

    const row = response.data?.[0] || body;
    return {
      anio: Number(row.anio || year),
      mes: Number(row.mes || month),
      closer_nombre: String(row.closer_nombre || closerNombre).trim(),
      calendar_letter: String(row.calendar_letter || calendarLetter).trim().toUpperCase(),
      updated_at: row.updated_at || body.updated_at,
      updated_by_email: row.updated_by_email || body.updated_by_email
    };
  } catch (err) {
    const details = err.response?.data || null;
    const message = details?.message || err.message;
    const isMissingTable = String(message || '').includes("Could not find the table 'public.agenda_calendar_assignments' in the schema cache");
    if (isMissingTable) {
      const error = new Error('La tabla de asignaciones de calendario todavia no existe en Supabase. Hay que aplicar la migracion 20260606234510_create_agenda_calendar_assignments.sql.');
      error.statusCode = 503;
      error.details = details;
      throw error;
    }

    const error = new Error(`Error guardando asignación de calendario: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = details;
    throw error;
  }
}

function validateAgendaCheckpointPeriod({ anio, mes }) {
  const year = Number(anio);
  const month = Number(mes);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const error = new Error('Parámetros inválidos para checks y strikes (anio/mes)');
    error.statusCode = 400;
    throw error;
  }

  return { year, month };
}

function getAgendaCheckpointStorageMeta({ anio, mes }) {
  return {
    bucket: env.reportesPersonalesDataBucket,
    objectPath: `config/agendas/checkpoints/${anio}-${String(mes).padStart(2, '0')}.json`
  };
}

function normalizeAgendaCheckpointEntry(rawEntry = {}) {
  const id = String(rawEntry.id || '').trim();
  const closerNombre = String(rawEntry.closer_nombre || rawEntry.closer || '').trim();
  const tipo = String(rawEntry.tipo || '').trim().toLowerCase();
  const detalle = String(rawEntry.detalle || rawEntry.reason || '').trim().slice(0, 1200);
  const cantidad = Math.max(1, Math.min(50, Math.round(Number(rawEntry.cantidad || 1) || 1)));

  if (!id || !closerNombre || !['check', 'strike'].includes(tipo)) return null;

  return {
    id,
    closer_nombre: closerNombre,
    tipo,
    cantidad,
    detalle,
    created_at: rawEntry.created_at || rawEntry.createdAt || null,
    created_by_email: String(rawEntry.created_by_email || rawEntry.createdBy || '').trim().toLowerCase() || null
  };
}

function emptyAgendaCheckpoints(year, month) {
  return {
    anio: year,
    mes: month,
    entries: [],
    updated_at: null,
    updated_by_email: null
  };
}

async function readAgendaCheckpointsFromStorage({ anio, mes }) {
  await ensureReportesPersonalesDataBucket();
  const meta = getAgendaCheckpointStorageMeta({ anio, mes });
  const url = `${env.supabaseUrl}/storage/v1/object/${meta.bucket}/${encodeStoragePath(meta.objectPath)}`;

  try {
    const response = await axios.get(url, {
      headers: buildStorageHeaders(),
      responseType: 'text'
    });
    const raw = typeof response.data === 'string'
      ? response.data
      : Buffer.isBuffer(response.data)
        ? response.data.toString('utf8')
        : JSON.stringify(response.data || {});
    const row = JSON.parse(raw || '{}');
    const { year, month } = validateAgendaCheckpointPeriod({
      anio: row.anio || anio,
      mes: row.mes || mes
    });

    return {
      anio: year,
      mes: month,
      entries: (Array.isArray(row.entries) ? row.entries : [])
        .map(normalizeAgendaCheckpointEntry)
        .filter(Boolean),
      updated_at: row.updated_at || row.savedAt || null,
      updated_by_email: String(row.updated_by_email || row.savedBy || '').trim().toLowerCase() || null
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const message = String(err.response?.data?.message || err.message || '');
    if (status === 400 || status === 404 || /not found/i.test(message)) {
      return null;
    }

    const error = new Error(`Error leyendo checks y strikes desde storage: ${message}`);
    error.statusCode = status;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function writeAgendaCheckpointsToStorage(data = {}, user) {
  await ensureReportesPersonalesDataBucket();
  const { year, month } = validateAgendaCheckpointPeriod({ anio: data.anio, mes: data.mes });
  const updatedAt = new Date().toISOString();
  const updatedBy = String(user?.email || '').trim().toLowerCase() || null;
  const normalized = {
    anio: year,
    mes: month,
    entries: (Array.isArray(data.entries) ? data.entries : [])
      .map(normalizeAgendaCheckpointEntry)
      .filter(Boolean),
    updated_at: updatedAt,
    updated_by_email: updatedBy
  };
  const meta = getAgendaCheckpointStorageMeta({ anio: year, mes: month });
  const uploadUrl = `${env.supabaseUrl}/storage/v1/object/${meta.bucket}/${encodeStoragePath(meta.objectPath)}`;
  const body = Buffer.from(JSON.stringify({
    ...normalized,
    savedAt: updatedAt,
    savedBy: updatedBy
  }, null, 2), 'utf8');

  await axios.post(uploadUrl, body, {
    headers: buildStorageHeaders({
      'Content-Type': 'application/json',
      'x-upsert': 'true',
      'cache-control': '120'
    }),
    maxBodyLength: Infinity
  });

  return normalized;
}

async function getAgendaCheckpoints({ anio, mes }) {
  const { year, month } = validateAgendaCheckpointPeriod({ anio, mes });
  const stored = await readAgendaCheckpointsFromStorage({ anio: year, mes: month });
  return stored || emptyAgendaCheckpoints(year, month);
}

async function updateAgendaCheckpoint(payload = {}, user) {
  const { year, month } = validateAgendaCheckpointPeriod({ anio: payload.anio, mes: payload.mes });
  const action = String(payload.action || 'add').trim().toLowerCase();
  const current = await getAgendaCheckpoints({ anio: year, mes: month });

  if (action === 'delete') {
    const id = String(payload.id || '').trim();
    if (!id) {
      const error = new Error('Falta el ID del check o strike a eliminar');
      error.statusCode = 400;
      throw error;
    }

    const nextEntries = current.entries.filter((entry) => entry.id !== id);
    if (nextEntries.length === current.entries.length) {
      const error = new Error('No se encontró el check o strike para eliminar');
      error.statusCode = 404;
      throw error;
    }

    return writeAgendaCheckpointsToStorage({
      anio: year,
      mes: month,
      entries: nextEntries
    }, user);
  }

  const closerNombre = String(payload.closer_nombre || '').trim();
  const tipo = String(payload.tipo || '').trim().toLowerCase();
  const detalle = String(payload.detalle || '').trim();
  const cantidad = Math.max(1, Math.min(50, Math.round(Number(payload.cantidad || 1) || 1)));

  if (!closerNombre) {
    const error = new Error('El closer es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  if (!['check', 'strike'].includes(tipo)) {
    const error = new Error('El tipo debe ser check o strike');
    error.statusCode = 400;
    throw error;
  }

  if (!detalle) {
    const error = new Error('El detalle del check o strike es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  const entry = normalizeAgendaCheckpointEntry({
    id: typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    closer_nombre: closerNombre,
    tipo,
    cantidad,
    detalle,
    created_at: new Date().toISOString(),
    created_by_email: String(user?.email || '').trim().toLowerCase() || null
  });

  return writeAgendaCheckpointsToStorage({
    anio: year,
    mes: month,
    entries: [entry, ...current.entries]
  }, user);
}

function normalizeUtmPresetKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeUtmPresetParams(rawParams) {
  if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams)) return {};

  return Object.fromEntries(
    Object.entries(rawParams)
      .map(([key, value]) => [String(key || '').trim(), String(value ?? '').trim()])
      .filter(([key, value]) => key && value)
  );
}

function normalizeUtmPresetRecord(rawPreset = {}) {
  const key = normalizeUtmPresetKey(rawPreset.key || rawPreset.preset_key);
  const name = String(rawPreset.name || rawPreset.display_name || '').trim();
  const baseUrl = String(rawPreset.base_url || '').trim();
  const params = normalizeUtmPresetParams(rawPreset.params);

  if (!key || !name) return null;

  return {
    id: Number(rawPreset.id || 0) || null,
    key,
    name,
    base_url: baseUrl,
    params,
    updated_at: rawPreset.updated_at || null,
    updated_by_email: rawPreset.updated_by_email || null
  };
}

function getUtmPresetsStorageMeta() {
  return {
    bucket: env.reportesPersonalesDataBucket,
    objectPath: 'tools/utm-link-presets.json'
  };
}

function getContactoInstagramWebhookStorageMeta(id) {
  return {
    bucket: env.reportesPersonalesDataBucket,
    objectPath: `webhooks/contacto-instagram/${encodeURIComponent(String(id || '').trim())}.json`
  };
}

function normalizeWebhookNullableString(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;

  const lower = normalized.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;

  return normalized;
}

function normalizeWebhookInstagram(value) {
  const normalized = normalizeWebhookNullableString(value);
  return normalized ? normalized.toLowerCase() : null;
}

async function readUtmPresetsFromStorage() {
  const meta = getUtmPresetsStorageMeta();
  const url = `${env.supabaseUrl}/storage/v1/object/${meta.bucket}/${encodeStoragePath(meta.objectPath)}`;

  try {
    const response = await axios.get(url, {
      headers: buildStorageHeaders(),
      responseType: 'json'
    });

    const raw = response.data;
    const presets = Array.isArray(raw?.presets)
      ? raw.presets
      : (Array.isArray(raw) ? raw : []);

    return presets
      .map((preset) => normalizeUtmPresetRecord(preset))
      .filter(Boolean)
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  } catch (err) {
    const status = err.response?.status || 500;
    const message = String(err.response?.data?.message || err.message || '');
    if (status === 400 || status === 404 || /not found/i.test(message)) {
      return [];
    }

    const error = new Error(`Error leyendo presets UTM desde storage: ${message}`);
    error.statusCode = status;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function saveUtmPresetsToStorage(presets = []) {
  const meta = getUtmPresetsStorageMeta();
  await ensureReportesPersonalesDataBucket();

  const uploadUrl = `${env.supabaseUrl}/storage/v1/object/${meta.bucket}/${encodeStoragePath(meta.objectPath)}`;
  const body = Buffer.from(JSON.stringify({
    presets: presets
      .map((preset) => normalizeUtmPresetRecord(preset))
      .filter(Boolean)
  }, null, 2), 'utf8');

  try {
    await axios.post(uploadUrl, body, {
      headers: buildStorageHeaders({
        'Content-Type': 'application/json',
        'x-upsert': 'true',
        'cache-control': '3600'
      }),
      maxBodyLength: Infinity
    });
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error guardando presets UTM en storage: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function listUtmLinkPresets(options = {}) {
  const key = normalizeUtmPresetKey(options.key);
  const url = `${env.supabaseUrl}/rest/v1/utm_link_presets`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: 'id,preset_key,display_name,base_url,params,updated_at,updated_by_email',
        ...(key ? { preset_key: `eq.${key}` } : {}),
        order: 'updated_at.desc',
        limit: key ? 1 : 200
      }
    });

    const tablePresets = (response.data || [])
      .map((row) => normalizeUtmPresetRecord(row))
      .filter(Boolean);
    const storagePresets = await readUtmPresetsFromStorage();
    const merged = new Map();

    [...storagePresets, ...tablePresets].forEach((preset) => {
      if (!preset?.key) return;
      merged.set(preset.key, preset);
    });

    const rows = [...merged.values()]
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));

    return key ? rows.filter((row) => row.key === key) : rows;
  } catch (err) {
    const details = err.response?.data || null;
    const message = details?.message || err.message;
    const isMissingTable = String(message || '').includes("Could not find the table 'public.utm_link_presets' in the schema cache");
    if (isMissingTable) {
      console.warn('[utm_link_presets] tabla no disponible en Supabase; usando storage como respaldo');
      const storagePresets = await readUtmPresetsFromStorage();
      return key ? storagePresets.filter((row) => row.key === key) : storagePresets;
    }

    const error = new Error(`Error leyendo presets UTM: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = details;
    throw error;
  }
}

async function upsertUtmLinkPreset(payload, user) {
  const displayName = String(payload.display_name || payload.origen_actual || payload.origin || payload.origen || payload.params?.origen_actual || '').trim();
  const presetKey = normalizeUtmPresetKey(payload.preset_key || displayName);
  const baseUrl = String(payload.base_url || '').trim();
  const params = normalizeUtmPresetParams(payload.params);

  if (!displayName) {
    const error = new Error('El origin/origen es obligatorio para guardar el preset UTM');
    error.statusCode = 400;
    throw error;
  }

  if (!presetKey) {
    const error = new Error('No pude generar una clave válida para ese origin/origen');
    error.statusCode = 400;
    throw error;
  }

  const body = {
    preset_key: presetKey,
    display_name: displayName,
    base_url: baseUrl || null,
    params,
    updated_at: new Date().toISOString(),
    updated_by_email: String(user?.email || '').trim().toLowerCase() || null
  };

  const url = `${env.supabaseUrl}/rest/v1/utm_link_presets`;
  const normalizedRecord = {
    id: null,
    key: presetKey,
    name: displayName,
    base_url: baseUrl,
    params,
    updated_at: body.updated_at,
    updated_by_email: body.updated_by_email
  };

  try {
    const response = await axios.post(url, body, {
      headers: buildHeaders({
        Prefer: 'resolution=merge-duplicates,return=representation'
      }),
      params: {
        on_conflict: 'preset_key'
      }
    });

    const row = response.data?.[0] || body;
    const normalized = normalizeUtmPresetRecord({
      ...row,
      preset_key: row.preset_key || presetKey,
      display_name: row.display_name || displayName,
      base_url: row.base_url || baseUrl,
      params: row.params || params,
      updated_at: row.updated_at || body.updated_at,
      updated_by_email: row.updated_by_email || body.updated_by_email
    }) || normalizedRecord;

    const currentStoragePresets = await readUtmPresetsFromStorage();
    const nextStoragePresets = [
      normalized,
      ...currentStoragePresets.filter((preset) => preset.key !== normalized.key)
    ];
    await saveUtmPresetsToStorage(nextStoragePresets);

    return normalized;
  } catch (err) {
    const details = err.response?.data || null;
    const message = details?.message || err.message;
    const isMissingTable = String(message || '').includes("Could not find the table 'public.utm_link_presets' in the schema cache");
    if (isMissingTable) {
      console.warn('[utm_link_presets] tabla no disponible en Supabase; guardando preset en storage');
      const currentStoragePresets = await readUtmPresetsFromStorage();
      const nextStoragePresets = [
        normalizedRecord,
        ...currentStoragePresets.filter((preset) => preset.key !== normalizedRecord.key)
      ];
      await saveUtmPresetsToStorage(nextStoragePresets);
      return normalizedRecord;
    }

    const error = new Error(`Error guardando preset UTM: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = details;
    throw error;
  }
}

async function deleteUtmLinkPreset(payload = {}) {
  const presetKey = normalizeUtmPresetKey(payload.preset_key || payload.key || payload.display_name || payload.origin || payload.origen);
  if (!presetKey) {
    const error = new Error('Falta la clave del preset para borrarlo');
    error.statusCode = 400;
    throw error;
  }

  const url = `${env.supabaseUrl}/rest/v1/utm_link_presets`;
  let tableDeleteAttempted = false;

  try {
    tableDeleteAttempted = true;
    await axios.delete(url, {
      headers: buildHeaders(),
      params: {
        preset_key: `eq.${presetKey}`
      }
    });
  } catch (err) {
    const details = err.response?.data || null;
    const message = details?.message || err.message;
    const isMissingTable = String(message || '').includes("Could not find the table 'public.utm_link_presets' in the schema cache");
    if (!isMissingTable) {
      const error = new Error(`Error borrando preset UTM: ${message}`);
      error.statusCode = err.response?.status || 500;
      error.details = details;
      throw error;
    }
  }

  const currentStoragePresets = await readUtmPresetsFromStorage();
  const existsInStorage = currentStoragePresets.some((preset) => preset.key === presetKey);
  const nextStoragePresets = currentStoragePresets.filter((preset) => preset.key !== presetKey);

  if (existsInStorage || !tableDeleteAttempted) {
    await saveUtmPresetsToStorage(nextStoragePresets);
  }

  return {
    ok: true,
    key: presetKey,
    deleted: existsInStorage || tableDeleteAttempted
  };
}

async function upsertContactoInstagramWebhook(payload = {}) {
  const id = String(payload.id || '').trim();
  const name = normalizeWebhookNullableString(payload.name);
  const email = normalizeWebhookNullableString(payload.email);
  const phone = normalizeWebhookNullableString(payload.phone);
  const instagram = normalizeWebhookInstagram(payload.instagram);

  if (!id) {
    const error = new Error('El campo id es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  const body = {
    id,
    name,
    email,
    phone,
    instagram,
    payload: {
      id,
      name,
      email,
      phone,
      instagram
    }
  };

  const url = `${env.supabaseUrl}/rest/v1/contacto_instagram_webhook`;
  const normalizedContact = {
    id,
    name,
    email,
    phone,
    instagram
  };

  try {
    const response = await axios.post(url, body, {
      headers: buildHeaders({
        Prefer: 'resolution=merge-duplicates,return=representation'
      }),
      params: {
        on_conflict: 'id'
      }
    });

    const row = response.data?.[0] || body;
    return {
      id: String(row.id || id).trim(),
      name: row.name || null,
      email: row.email || null,
      phone: row.phone || null,
      instagram: row.instagram || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    };
  } catch (err) {
    const message = String(err.response?.data?.message || err.message || '');
    const isMissingTable = message.includes("Could not find the table 'public.contacto_instagram_webhook' in the schema cache");

    if (isMissingTable) {
      console.warn('[contacto_instagram_webhook] tabla no disponible en Supabase; usando storage como respaldo');
      await ensureReportesPersonalesDataBucket();

      const meta = getContactoInstagramWebhookStorageMeta(id);
      const uploadUrl = `${env.supabaseUrl}/storage/v1/object/${meta.bucket}/${encodeStoragePath(meta.objectPath)}`;
      const timestamp = new Date().toISOString();
      const storageBody = Buffer.from(JSON.stringify({
        ...normalizedContact,
        payload: body.payload,
        savedAt: timestamp
      }, null, 2), 'utf8');

      await axios.post(uploadUrl, storageBody, {
        headers: buildStorageHeaders({
          'Content-Type': 'application/json',
          'x-upsert': 'true',
          'cache-control': '3600'
        }),
        maxBodyLength: Infinity
      });

      return {
        ...normalizedContact,
        created_at: timestamp,
        updated_at: timestamp
      };
    }

    const error = new Error(`Error guardando contacto instagram webhook: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function readContactoInstagramWebhookFromStorageById(id) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return null;

  const meta = getContactoInstagramWebhookStorageMeta(normalizedId);
  const url = `${env.supabaseUrl}/storage/v1/object/${meta.bucket}/${encodeStoragePath(meta.objectPath)}`;

  try {
    const response = await axios.get(url, {
      headers: buildStorageHeaders(),
      responseType: 'json'
    });

    const row = response.data || {};
    return {
      id: String(row.id || normalizedId).trim(),
      name: normalizeWebhookNullableString(row.name),
      email: normalizeWebhookNullableString(row.email),
      phone: normalizeWebhookNullableString(row.phone),
      instagram: normalizeWebhookInstagram(row.instagram),
      created_at: row.created_at || row.savedAt || null,
      updated_at: row.updated_at || row.savedAt || null
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const message = String(err.response?.data?.message || err.message || '');
    if (status === 400 || status === 404 || /not found/i.test(message)) {
      return null;
    }

    const error = new Error(`Error leyendo contacto instagram webhook desde storage: ${message}`);
    error.statusCode = status;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function searchContactoInstagramWebhookInStorage(payload = {}) {
  const id = String(payload.id || '').trim();
  const instagram = normalizeWebhookInstagram(payload.instagram);

  if (id) {
    const foundById = await readContactoInstagramWebhookFromStorageById(id);
    if (foundById) return foundById;
  }

  if (!instagram) return null;

  const listUrl = `${env.supabaseUrl}/storage/v1/object/list/${env.reportesPersonalesDataBucket}`;

  try {
    const response = await axios.post(listUrl, {
      prefix: 'webhooks/contacto-instagram',
      limit: 1000,
      sortBy: {
        column: 'created_at',
        order: 'desc'
      }
    }, {
      headers: buildStorageHeaders({ 'Content-Type': 'application/json' })
    });

    const files = Array.isArray(response.data) ? response.data : [];

    for (const file of files) {
      const objectName = String(file?.name || '').trim();
      if (!objectName) continue;

      const objectId = objectName.replace(/\.json$/i, '');
      const contact = await readContactoInstagramWebhookFromStorageById(decodeURIComponent(objectId));
      if (contact?.instagram && contact.instagram === instagram) {
        return contact;
      }
    }

    return null;
  } catch (err) {
    const message = String(err.response?.data?.message || err.message || '');
    const error = new Error(`Error buscando contacto instagram webhook en storage: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function searchContactoInstagramWebhook(payload = {}) {
  const id = String(payload.id || '').trim();
  const instagram = normalizeWebhookInstagram(payload.instagram);

  if (!id && !instagram) {
    const error = new Error('Para buscar necesitás enviar id o instagram');
    error.statusCode = 400;
    throw error;
  }

  const url = `${env.supabaseUrl}/rest/v1/contacto_instagram_webhook`;

  try {
    const filters = [];
    if (id) filters.push(`id.eq.${id}`);
    if (instagram) filters.push(`instagram.eq.${instagram}`);

    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: 'id,name,email,phone,instagram,created_at,updated_at',
        or: `(${filters.join(',')})`,
        order: 'updated_at.desc',
        limit: 1
      }
    });

    const row = response.data?.[0] || null;
    return {
      exists: Boolean(row),
      contact: row ? {
        id: String(row.id || '').trim(),
        name: normalizeWebhookNullableString(row.name),
        email: normalizeWebhookNullableString(row.email),
        phone: normalizeWebhookNullableString(row.phone),
        instagram: normalizeWebhookInstagram(row.instagram),
        created_at: row.created_at || null,
        updated_at: row.updated_at || null
      } : null
    };
  } catch (err) {
    const message = String(err.response?.data?.message || err.message || '');
    const isMissingTable = message.includes("Could not find the table 'public.contacto_instagram_webhook' in the schema cache");

    if (isMissingTable) {
      const contact = await searchContactoInstagramWebhookInStorage({ id, instagram });
      return {
        exists: Boolean(contact),
        contact
      };
    }

    const error = new Error(`Error buscando contacto instagram webhook: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function upsertKpiCloserRules(payload) {
  const year = Number(payload.anio);
  const month = Number(payload.mes);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const error = new Error('Parámetros inválidos para guardar reglas KPI (anio/mes)');
    error.statusCode = 400;
    throw error;
  }

  const body = {
    anio: year,
    mes: month,
    cierre_llamada_pct: Number(payload.cierre_llamada_pct || 0),
    asistencia_llamada_pct: Number(payload.asistencia_llamada_pct || 0),
    tasa_asistencia_pct: Number(payload.tasa_asistencia_pct || 0),
    tasa_cierre_pct: Number(payload.tasa_cierre_pct || 0),
    cash_collected_min: Number(payload.cash_collected_min || 0),
    cash_collected_3m_min: Number(payload.cash_collected_3m_min || 0),
    cierre_llamada_weight: Number(payload.cierre_llamada_weight || 0),
    asistencia_llamada_weight: Number(payload.asistencia_llamada_weight || 0),
    tasa_asistencia_weight: Number(payload.tasa_asistencia_weight || 0),
    tasa_cierre_weight: Number(payload.tasa_cierre_weight || 0),
    cash_collected_weight: Number(payload.cash_collected_weight || 0),
    cash_collected_3m_weight: Number(payload.cash_collected_3m_weight || 0),
    facturacion_min: Number(payload.facturacion_min || 0)
  };

  const url = `${env.supabaseUrl}/rest/v1/kpi_closers_rules`;

  try {
    const response = await axios.post(url, body, {
      headers: buildHeaders({
        Prefer: 'resolution=merge-duplicates,return=representation'
      }),
      params: {
        on_conflict: 'anio,mes'
      }
    });

    return response.data?.[0] || body;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error guardando reglas KPI: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function getReportesPremioConfig() {
  const url = `${env.supabaseUrl}/rest/v1/reportes_config`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: 'id,cash_collected_premio_pct,updated_at,updated_by_email',
        id: 'eq.1',
        limit: 1
      }
    });

    const row = response.data?.[0] || null;
    return {
      id: 1,
      cash_collected_premio_pct: normalizePercentNumber(row?.cash_collected_premio_pct, 1),
      updated_at: row?.updated_at || null,
      updated_by_email: row?.updated_by_email || null
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return {
        id: 1,
        cash_collected_premio_pct: 1,
        updated_at: null,
        updated_by_email: null
      };
    }

    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error leyendo premio de reportes: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function upsertReportesPremioConfig(payload, user) {
  const premioPct = normalizePercentNumber(payload.cash_collected_premio_pct, Number.NaN);

  if (!Number.isFinite(premioPct) || premioPct < 0 || premioPct > 100) {
    const error = new Error('El porcentaje de premio debe estar entre 0 y 100');
    error.statusCode = 400;
    throw error;
  }

  const body = {
    id: 1,
    cash_collected_premio_pct: premioPct,
    updated_at: new Date().toISOString(),
    updated_by_email: String(user?.email || '').trim().toLowerCase() || null
  };

  const url = `${env.supabaseUrl}/rest/v1/reportes_config`;

  try {
    const response = await axios.post(url, body, {
      headers: buildHeaders({
        Prefer: 'resolution=merge-duplicates,return=representation'
      }),
      params: {
        on_conflict: 'id'
      }
    });

    const row = response.data?.[0] || body;
    return {
      id: 1,
      cash_collected_premio_pct: normalizePercentNumber(row.cash_collected_premio_pct, premioPct),
      updated_at: row.updated_at || body.updated_at,
      updated_by_email: row.updated_by_email || body.updated_by_email
    };
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error guardando premio de reportes: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNameForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nameTokens(value) {
  return normalizeNameForMatch(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function tokensMatch(closerToken, userToken) {
  if (!closerToken || !userToken) return false;
  if (closerToken === userToken) return true;
  if (closerToken.length >= 3 && userToken.startsWith(closerToken)) return true;
  return userToken.length >= 3 && closerToken.startsWith(userToken);
}

function scoreReportRecipientMatch(closer, userName) {
  const closerName = normalizeNameForMatch(closer);
  const normalizedUserName = normalizeNameForMatch(userName);
  if (!closerName || !normalizedUserName) return 0;
  if (closerName === normalizedUserName) return 1000;
  if (normalizedUserName.includes(closerName)) return 850 + closerName.length;
  if (closerName.includes(normalizedUserName)) return 800 + normalizedUserName.length;

  const closerTokens = nameTokens(closer);
  const userTokens = nameTokens(userName);
  if (!closerTokens.length || !userTokens.length) return 0;

  let score = 0;
  const allCloserTokensMatched = closerTokens.every((closerToken) => {
    const matchedToken = userTokens.find((userToken) => tokensMatch(closerToken, userToken));
    if (!matchedToken) return false;
    score += closerToken === matchedToken ? 20 : 12;
    return true;
  });

  return allCloserTokensMatched ? 300 + score : 0;
}

function isMissingReportCommentsTableError(err) {
  const message = String(err.response?.data?.message || err.message || '').toLowerCase();
  return message.includes('reportes_comentarios') && (
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find') ||
    message.includes('relation')
  );
}

function isTruthyFlag(value) {
  return value === true || ['1', 'true', 'si', 'sí'].includes(String(value || '').trim().toLowerCase());
}

async function findReportRecipientEmail(closer) {
  const url = `${env.supabaseUrl}/rest/v1/metricas_usuarios`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: 'email,nombre,role,activo',
        activo: 'eq.true',
        limit: 1000
      }
    });

    const matches = (response.data || [])
      .map((user) => ({
        email: normalizeEmail(user.email),
        score: scoreReportRecipientMatch(closer, user.nombre || user.email)
      }))
      .filter((user) => user.email && user.score > 0)
      .sort((a, b) => b.score - a.score);

    return matches[0]?.email || null;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error resolviendo destinatario del comentario: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

function normalizeReportCommentPayload(payload = {}) {
  const from = String(payload.from || payload.fecha_desde || '').trim();
  const to = String(payload.to || payload.fecha_hasta || '').trim();
  const closer = String(payload.closer || '').trim();
  const commentText = String(payload.comment_text || payload.comentario || '').trim();

  validateDateRange(from, to);

  if (to < from) {
    const error = new Error('La fecha hasta no puede ser menor a la fecha desde');
    error.statusCode = 400;
    throw error;
  }

  if (!closer) {
    const error = new Error('Debés elegir un closer para comentar el reporte');
    error.statusCode = 400;
    throw error;
  }

  if (!commentText) {
    const error = new Error('El comentario no puede estar vacío');
    error.statusCode = 400;
    throw error;
  }

  if (commentText.length > 2000) {
    const error = new Error('El comentario no puede superar 2000 caracteres');
    error.statusCode = 400;
    throw error;
  }

  return { from, to, closer, commentText };
}

async function listReportComments({ from, to, unread }, user) {
  const unreadOnly = isTruthyFlag(unread);
  const params = {
    select: 'id,fecha_desde,fecha_hasta,closer,recipient_email,comment_text,created_by_email,created_by_name,created_at,read_at,read_by_email',
    order: 'created_at.desc',
    limit: 1000
  };

  if (from || to) {
    validateDateRange(from, to);

    if (to < from) {
      const error = new Error('La fecha hasta no puede ser menor a la fecha desde');
      error.statusCode = 400;
      throw error;
    }

    params.fecha_desde = `eq.${from}`;
    params.fecha_hasta = `eq.${to}`;
  } else if (!unreadOnly) {
    validateDateRange(from, to);
  }

  if (unreadOnly) {
    params.read_at = 'is.null';
  }

  if (user?.role !== 'total') {
    const email = normalizeEmail(user?.email);
    if (!email) return [];
    params.recipient_email = `eq.${email}`;
  }

  const url = `${env.supabaseUrl}/rest/v1/reportes_comentarios`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params
    });

    return response.data || [];
  } catch (err) {
    if (isMissingReportCommentsTableError(err)) return [];

    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error leyendo comentarios de reportes: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function createReportComment(payload, user) {
  if (user?.role !== 'total') {
    const error = new Error('Solo los usuarios admin pueden comentar reportes');
    error.statusCode = 403;
    throw error;
  }

  const normalized = normalizeReportCommentPayload(payload);
  const recipientEmail = normalizeEmail(payload.recipient_email) ||
    await findReportRecipientEmail(normalized.closer);
  const body = {
    fecha_desde: normalized.from,
    fecha_hasta: normalized.to,
    closer: normalized.closer,
    recipient_email: recipientEmail || null,
    comment_text: normalized.commentText,
    created_by_email: normalizeEmail(user?.email),
    created_by_name: String(user?.nombre || user?.email || '').trim() || null
  };
  const url = `${env.supabaseUrl}/rest/v1/reportes_comentarios`;

  try {
    const response = await axios.post(url, body, {
      headers: buildHeaders({
        Prefer: 'return=representation'
      })
    });

    return response.data?.[0] || body;
  } catch (err) {
    if (isMissingReportCommentsTableError(err)) {
      const error = new Error('Para guardar comentarios de reportes falta aplicar la migración de Supabase.');
      error.statusCode = 500;
      throw error;
    }

    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error guardando comentario de reporte: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function markReportCommentRead(id, user) {
  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    const error = new Error('Comentario inválido');
    error.statusCode = 400;
    throw error;
  }

  const url = `${env.supabaseUrl}/rest/v1/reportes_comentarios`;

  try {
    const currentResponse = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: 'id,recipient_email,read_at',
        id: `eq.${commentId}`,
        limit: 1
      }
    });

    const current = currentResponse.data?.[0] || null;
    if (!current) {
      const error = new Error('Comentario no encontrado');
      error.statusCode = 404;
      throw error;
    }

    const userEmail = normalizeEmail(user?.email);
    if (user?.role !== 'total' && normalizeEmail(current.recipient_email) !== userEmail) {
      const error = new Error('Sin permiso para marcar este comentario');
      error.statusCode = 403;
      throw error;
    }

    const response = await axios.patch(url, {
      read_at: current.read_at || new Date().toISOString(),
      read_by_email: current.read_at ? undefined : userEmail
    }, {
      headers: buildHeaders({
        Prefer: 'return=representation'
      }),
      params: {
        id: `eq.${commentId}`
      }
    });

    return response.data?.[0] || null;
  } catch (err) {
    if (err.statusCode) throw err;

    if (isMissingReportCommentsTableError(err)) {
      const error = new Error('Para leer comentarios de reportes falta aplicar la migración de Supabase.');
      error.statusCode = 500;
      throw error;
    }

    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error marcando comentario de reporte: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

function normalizeMarketingOrigin(value) {
  const origin = String(value || '').trim();
  return origin || '__ALL__';
}

function normalizeMarketingOriginGroup(value) {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return 'Sin origen';
  if (text.includes('APSET')) return 'APSET';
  if (text.includes('CLASES') || text.includes('CLASE')) return 'CLASES';
  if (text.includes('ORG')) return 'ORG';
  if (text.includes('VSL')) return 'VSL';
  return String(value || '').trim() || 'Sin origen';
}

function normalizeStrategyGroup(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text || text === 'sin estrategia') return 'sin estrategia';
  return text;
}

function normalizeCloserGroup(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 'Sin closer';
  if (text === 'pablo butera vie' || text === 'pablo butera') return 'Pablo Butera';
  if (text === 'nahuel iasci') return 'Nahuel Iasci';
  return String(value || '').trim();
}

function normalizeMarketingText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function includesMarketingWord(text, word) {
  return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(text);
}

function getMarketingCampaignCircle(value) {
  const raw = String(value || '');
  const text = normalizeMarketingText(raw);

  if (
    raw.includes('\u{1F534}') ||
    text.includes('circulo rojo') ||
    text.includes('circulito rojo') ||
    includesMarketingWord(text, 'rojo') ||
    includesMarketingWord(text, 'red')
  ) {
    return { key: 'red', label: 'Circulito rojo', sortOrder: 1 };
  }

  if (
    raw.includes('\u{1F535}') ||
    text.includes('circulo azul') ||
    text.includes('circulito azul') ||
    includesMarketingWord(text, 'azul') ||
    includesMarketingWord(text, 'blue')
  ) {
    return { key: 'blue', label: 'Circulito azul', sortOrder: 2 };
  }

  return null;
}

function validateDateRange(from, to) {
  if (!from || !to) {
    const error = new Error('Debés enviar desde y hasta');
    error.statusCode = 400;
    throw error;
  }

  if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    const error = new Error('Rango de fechas inválido');
    error.statusCode = 400;
    throw error;
  }
}

const MARKETING_INVESTMENT_SELECT =
  'fecha_desde,fecha_hasta,origen,inversion_planificada,inversion_realizada,saldo_restante_linea_credito,updated_at';
const MARKETING_INVESTMENT_LEGACY_SELECT =
  'fecha_desde,fecha_hasta,origen,inversion_planificada,inversion_realizada,updated_at';
const MARKETING_INVESTMENT_CURRENT_SELECT =
  'fecha_desde,fecha_hasta,origen,inversion_planificada,inversion_realizada,saldo_restante_linea_credito';
const MARKETING_INVESTMENT_CURRENT_LEGACY_SELECT =
  'fecha_desde,fecha_hasta,origen,inversion_planificada,inversion_realizada';

function isMissingCreditLineBalanceColumnError(err) {
  const message = String(err.response?.data?.message || err.message || '').toLowerCase();
  return message.includes('saldo_restante_linea_credito') && (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find')
  );
}

function withCreditLineBalanceFallback(rows) {
  return (rows || []).map((row) => ({
    saldo_restante_linea_credito: 0,
    ...row
  }));
}

async function getMarketingInvestment({ from, to, origen }) {
  validateDateRange(from, to);

  const rawOrigin = String(origen || '').trim();
  const hasOriginFilter = Boolean(rawOrigin);
  const safeOrigin = normalizeMarketingOrigin(origen);
  const url = `${env.supabaseUrl}/rest/v1/kpi_marketing_inversiones`;
  const params = {
    select: MARKETING_INVESTMENT_SELECT,
    and: `(fecha_desde.gte.${from},fecha_hasta.lte.${to})`,
    order: 'fecha_desde.asc,fecha_hasta.asc',
    limit: 1000
  };

  if (hasOriginFilter) {
    params.origen = `eq.${safeOrigin}`;
  }

  try {
    let response;

    try {
      response = await axios.get(url, {
        headers: buildHeaders(),
        params
      });
    } catch (err) {
      if (!isMissingCreditLineBalanceColumnError(err)) throw err;

      response = await axios.get(url, {
        headers: buildHeaders(),
        params: {
          ...params,
          select: MARKETING_INVESTMENT_LEGACY_SELECT
        }
      });
    }

    const rows = withCreditLineBalanceFallback(response.data || []);

    if (!rows.length) {
      return {
        fecha_desde: from,
        fecha_hasta: to,
        origen: hasOriginFilter ? safeOrigin : '__ALL__',
        inversion_planificada: 0,
        inversion_realizada: 0,
        saldo_restante_linea_credito: 0,
        cantidad_registros: 0
      };
    }

    return rows.reduce((acc, row) => ({
      fecha_desde: from,
      fecha_hasta: to,
      origen: hasOriginFilter ? safeOrigin : '__ALL__',
      inversion_planificada: acc.inversion_planificada + Number(row.inversion_planificada || 0),
      inversion_realizada: acc.inversion_realizada + Number(row.inversion_realizada || 0),
      saldo_restante_linea_credito: acc.saldo_restante_linea_credito + Number(row.saldo_restante_linea_credito || 0),
      cantidad_registros: acc.cantidad_registros + 1,
      updated_at: row.updated_at || acc.updated_at || null
    }), {
      fecha_desde: from,
      fecha_hasta: to,
      origen: hasOriginFilter ? safeOrigin : '__ALL__',
      inversion_planificada: 0,
      inversion_realizada: 0,
      saldo_restante_linea_credito: 0,
      cantidad_registros: 0,
      updated_at: null
    });
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error leyendo inversión MKT: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function upsertMarketingInvestment(payload) {
  validateDateRange(payload.from, payload.to);

  const url = `${env.supabaseUrl}/rest/v1/kpi_marketing_inversiones`;
  const safeOrigin = normalizeMarketingOrigin(payload.origen);
  const addPlanificada = payload.inversion_planificada === undefined
    ? null
    : Number(payload.inversion_planificada || 0);
  const addRealizada = payload.inversion_realizada === undefined
    ? null
    : Number(payload.inversion_realizada || 0);
  const addSaldoRestanteLineaCredito = payload.saldo_restante_linea_credito === undefined
    ? null
    : Number(payload.saldo_restante_linea_credito || 0);

  if (
    (addPlanificada !== null && addPlanificada < 0) ||
    (addRealizada !== null && addRealizada < 0) ||
    (addSaldoRestanteLineaCredito !== null && addSaldoRestanteLineaCredito < 0)
  ) {
    const error = new Error('Solo podés agregar montos positivos o cero');
    error.statusCode = 400;
    throw error;
  }

  try {
    const currentParams = {
      select: MARKETING_INVESTMENT_CURRENT_SELECT,
      fecha_desde: `eq.${payload.from}`,
      fecha_hasta: `eq.${payload.to}`,
      origen: `eq.${safeOrigin}`,
      limit: 1
    };
    let hasCreditLineBalanceColumn = true;
    let currentResponse;

    try {
      currentResponse = await axios.get(url, {
        headers: buildHeaders(),
        params: currentParams
      });
    } catch (err) {
      if (!isMissingCreditLineBalanceColumnError(err)) throw err;

      hasCreditLineBalanceColumn = false;
      currentResponse = await axios.get(url, {
        headers: buildHeaders(),
        params: {
          ...currentParams,
          select: MARKETING_INVESTMENT_CURRENT_LEGACY_SELECT
        }
      });
    }

    if (!hasCreditLineBalanceColumn && addSaldoRestanteLineaCredito !== null) {
      const error = new Error('Para guardar saldo restante en línea de crédito falta aplicar la migración de Supabase.');
      error.statusCode = 500;
      throw error;
    }

    const current = currentResponse.data?.[0] || null;
    const body = {
      fecha_desde: payload.from,
      fecha_hasta: payload.to,
      origen: safeOrigin,
      inversion_planificada: Number(current?.inversion_planificada || 0) + Number(addPlanificada || 0),
      inversion_realizada: Number(current?.inversion_realizada || 0) + Number(addRealizada || 0),
      updated_at: new Date().toISOString()
    };

    if (hasCreditLineBalanceColumn) {
      body.saldo_restante_linea_credito = Number(current?.saldo_restante_linea_credito || 0) +
        Number(addSaldoRestanteLineaCredito || 0);
    }

    const response = await axios.post(url, body, {
      headers: buildHeaders({
        Prefer: 'resolution=merge-duplicates,return=representation'
      }),
      params: {
        on_conflict: 'fecha_desde,fecha_hasta,origen'
      }
    });

    return response.data?.[0] || body;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error guardando inversión MKT: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function listMarketingInvestments({ from, to }) {
  const url = `${env.supabaseUrl}/rest/v1/kpi_marketing_inversiones`;
  const params = {
    select: MARKETING_INVESTMENT_SELECT,
    order: 'fecha_desde.desc,fecha_hasta.desc,origen.asc',
    limit: 1000
  };

  if (from && to) {
    validateDateRange(from, to);
    params.and = `(fecha_desde.gte.${from},fecha_hasta.lte.${to})`;
  } else if (from) {
    if (Number.isNaN(Date.parse(from))) {
      const error = new Error('Fecha desde inválida');
      error.statusCode = 400;
      throw error;
    }
    params.fecha_desde = `gte.${from}`;
  } else if (to) {
    if (Number.isNaN(Date.parse(to))) {
      const error = new Error('Fecha hasta inválida');
      error.statusCode = 400;
      throw error;
    }
    params.fecha_hasta = `lte.${to}`;
  }

  try {
    let response;

    try {
      response = await axios.get(url, {
        headers: buildHeaders(),
        params
      });
    } catch (err) {
      if (!isMissingCreditLineBalanceColumnError(err)) throw err;

      response = await axios.get(url, {
        headers: buildHeaders(),
        params: {
          ...params,
          select: MARKETING_INVESTMENT_LEGACY_SELECT
        }
      });
    }

    return withCreditLineBalanceFallback(response.data || []);
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error listando inversiones MKT: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function updateMarketingInvestmentRecord(payload) {
  validateDateRange(payload.fecha_desde, payload.fecha_hasta);

  const safeOrigin = normalizeMarketingOrigin(payload.origen);
  const body = {
    inversion_planificada: Number(payload.inversion_planificada || 0),
    inversion_realizada: Number(payload.inversion_realizada || 0),
    updated_at: new Date().toISOString()
  };
  const saldoRestanteLineaCredito = Number(payload.saldo_restante_linea_credito || 0);

  if (
    body.inversion_planificada < 0 ||
    body.inversion_realizada < 0 ||
    saldoRestanteLineaCredito < 0
  ) {
    const error = new Error('Los montos no pueden ser negativos');
    error.statusCode = 400;
    throw error;
  }

  if (payload.saldo_restante_linea_credito !== undefined) {
    body.saldo_restante_linea_credito = saldoRestanteLineaCredito;
  }

  const url = `${env.supabaseUrl}/rest/v1/kpi_marketing_inversiones`;

  try {
    const patchOptions = {
      headers: buildHeaders({
        Prefer: 'return=representation'
      }),
      params: {
        fecha_desde: `eq.${payload.fecha_desde}`,
        fecha_hasta: `eq.${payload.fecha_hasta}`,
        origen: `eq.${safeOrigin}`
      }
    };
    let response;

    try {
      response = await axios.patch(url, body, patchOptions);
    } catch (err) {
      if (!isMissingCreditLineBalanceColumnError(err)) throw err;

      if (payload.saldo_restante_linea_credito !== undefined && saldoRestanteLineaCredito > 0) {
        const error = new Error('Para guardar saldo restante en línea de crédito falta aplicar la migración de Supabase.');
        error.statusCode = 500;
        throw error;
      }

      const { saldo_restante_linea_credito: _unused, ...legacyBody } = body;
      response = await axios.patch(url, legacyBody, patchOptions);
    }

    return response.data?.[0] || null;
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error actualizando inversión MKT: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function deleteMarketingInvestmentRecord(payload) {
  validateDateRange(payload.fecha_desde, payload.fecha_hasta);

  const safeOrigin = normalizeMarketingOrigin(payload.origen);
  const url = `${env.supabaseUrl}/rest/v1/kpi_marketing_inversiones`;

  try {
    await axios.delete(url, {
      headers: buildHeaders(),
      params: {
        fecha_desde: `eq.${payload.fecha_desde}`,
        fecha_hasta: `eq.${payload.fecha_hasta}`,
        origen: `eq.${safeOrigin}`
      }
    });

    return {
      ok: true,
      fecha_desde: payload.fecha_desde,
      fecha_hasta: payload.fecha_hasta,
      origen: safeOrigin
    };
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error borrando inversión MKT: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function listAllRows(resourceName, options = {}) {
  const limit = Math.min(Number(options.limit || 1000), 1000);
  let offset = Number(options.offset || 0);
  const rows = [];

  while (true) {
    const chunk = await listRows(resourceName, {
      ...options,
      limit,
      offset
    });

    rows.push(...chunk);

    if (chunk.length < limit) {
      break;
    }

    offset += limit;
  }

  return rows;
}

function parseFlexibleDateParts(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate()
    };
  }

  const text = String(value).trim();
  if (!text) return null;

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);

    if (year < 100) {
      year += 2000;
    }

    return { year, month, day };
  }

  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return null;

  const date = new Date(parsed);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function sameDay(dateA, dateB) {
  const a = parseFlexibleDateParts(dateA);
  const b = parseFlexibleDateParts(dateB);
  if (!a || !b) return false;

  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function isMarketingApplicableAgenda(row) {
  return normalizeMarketingText(row.agendo) === 'agendo' &&
    normalizeMarketingText(row.aplica) === 'aplica';
}

function isMarketingCompletedMeeting(row) {
  return isMarketingApplicableAgenda(row) &&
    normalizeMarketingText(row.llamada_meg) === 'efectuada';
}

function isMarketingCcSuccess(row) {
  return normalizeMarketingText(row.call_confirm) === 'exitoso' ||
    normalizeMarketingText(row.llamada_cc) === 'exitoso' ||
    normalizeMarketingText(row.cc_whatsapp) === 'exitoso';
}

function emptyMarketingCampaignTotal(circle, campaign) {
  return {
    marker: circle.key,
    markerLabel: circle.label,
    sortOrder: circle.sortOrder,
    campaign,
    agendas: 0,
    aplican: 0,
    ccExitosos: 0,
    ccNoExitosos: 0,
    reuniones: 0,
    reunionesCce: 0,
    reunionesCcne: 0,
    ventas: 0,
    ventasCce: 0,
    ventasCcne: 0,
    facturacion: 0,
    cashCollected: 0,
    tasaCierre: 0,
    aov: 0
  };
}

function getMarketingCampaignTotal(acc, campaign) {
  const circle = getMarketingCampaignCircle(campaign);
  if (!circle) return null;

  const cleanCampaign = String(campaign || '').trim();
  if (!cleanCampaign) return null;

  const key = `${circle.key}::${cleanCampaign}`;
  if (!acc.has(key)) {
    acc.set(key, emptyMarketingCampaignTotal(circle, cleanCampaign));
  }

  return acc.get(key);
}

async function getMarketingAovDia1({ from, to, origen, estrategia, closer }) {
  validateDateRange(from, to);

  const rows = await listAllRows('comprobantes', {
    limit: 1000,
    from,
    to,
    dateField: 'fecha_de_agendamiento',
    orderBy: 'fecha_de_agendamiento',
    orderDir: 'desc'
  });

  const filtered = rows.filter((row) => {
    if (String(row.tipo || '').trim().toLowerCase() !== 'venta') return false;

    const producto = String(row.producto_format || '').trim();
    if (!producto || producto.toLowerCase() === 'empty') return false;
    if (producto.toLowerCase().includes('club')) return false;
    const facturacion = Number(row.facturacion || 0);
    const primerPago = Number(row.cash_collected || 0);
    if (!(facturacion > 0)) return false;
    if (!(primerPago > facturacion * 0.3)) return false;

    if (origen && normalizeMarketingOriginGroup(row.origen) !== origen) {
      return false;
    }

    if (estrategia && normalizeStrategyGroup(row.estrategia_a || row.estrategia) !== normalizeStrategyGroup(estrategia)) {
      return false;
    }

    if (closer && normalizeCloserGroup(row.responsable_venta || row.creado_por) !== normalizeCloserGroup(closer)) {
      return false;
    }

    return true;
  });

  const facturacionDia1 = filtered.reduce((sum, row) => sum + Number(row.facturacion || 0), 0);
  const cashCollectedDia1 = filtered.reduce((sum, row) => sum + Number(row.cash_collected || 0), 0);
  const ventasDia1 = filtered.length;

  return {
    aovDia1: ventasDia1 > 0 ? cashCollectedDia1 / ventasDia1 : 0,
    ventasDia1,
    facturacionDia1,
    cashCollectedDia1
  };
}

async function getMarketingVentasTotales({ from, to, origen }) {
  validateDateRange(from, to);

  const rows = await listAllRows('comprobantes', {
    limit: 1000,
    from,
    to,
    dateField: 'fecha_de_agendamiento',
    orderBy: 'fecha_de_agendamiento',
    orderDir: 'desc'
  });

  const filtered = rows.filter((row) => {
    if (String(row.tipo || '').trim().toLowerCase() !== 'venta') return false;

    const producto = String(row.producto_format || '').trim();
    if (!producto || producto.toLowerCase() === 'empty') return false;
    if (producto.toLowerCase().includes('club')) return false;

    if (origen && normalizeMarketingOriginGroup(row.origen) !== origen) {
      return false;
    }

    return true;
  });

  return {
    ventasTotales: filtered.length,
    facturacionVentasTotales: filtered.reduce((sum, row) => sum + Number(row.facturacion || 0), 0)
  };
}

function isNonClubProductForCash(row) {
  const producto = String(row?.producto_format || '').trim().toLowerCase();
  return !producto || !producto.includes('club');
}

function isTodayOrPastInArgentina(dateValue) {
  const parts = parseFlexibleDateParts(dateValue);
  if (!parts) return false;

  const today = new Date();
  const todayAr = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate()
  };

  if (parts.year !== todayAr.year || parts.month !== todayAr.month) {
    return true;
  }

  return parts.day <= todayAr.day;
}

async function getMarketingCashCollectedAgenda({ from, to, origen }) {
  validateDateRange(from, to);

  const rows = await listAllRows('comprobantes', {
    limit: 1000,
    from,
    to,
    dateField: 'fecha_de_agendamiento',
    orderBy: 'fecha_de_agendamiento',
    orderDir: 'desc'
  });

  const cashCollectedAgenda = rows.reduce((sum, row) => {
    const tipo = String(row.tipo || '').trim().toLowerCase();
    if (tipo !== 'venta' && tipo !== 'cobranza') return sum;
    if (!isNonClubProductForCash(row)) return sum;

    if (origen && normalizeMarketingOriginGroup(row.origen) !== origen) {
      return sum;
    }

    const agenda = parseFlexibleDateParts(row.fecha_de_agendamiento);
    const acreditacion = parseFlexibleDateParts(row.f_acreditacion);
    if (!agenda || !acreditacion) return sum;

    if (agenda.year !== acreditacion.year || agenda.month !== acreditacion.month) {
      return sum;
    }

    if (!isTodayOrPastInArgentina(row.f_acreditacion)) {
      return sum;
    }

    return sum + Number(row.cash_collected || 0);
  }, 0);

  return {
    cashCollectedAgenda
  };
}

async function getMarketingCampaignTotals({ from, to, origen }) {
  validateDateRange(from, to);

  const [leadRows, comprobanteRows] = await Promise.all([
    listAllRows('leads_raw', {
      limit: 1000,
      from,
      to,
      dateField: 'fecha_agenda',
      orderBy: 'fecha_agenda',
      orderDir: 'desc'
    }),
    listAllRows('comprobantes', {
      limit: 1000,
      from,
      to,
      dateField: 'fecha_de_agendamiento',
      orderBy: 'fecha_de_agendamiento',
      orderDir: 'desc'
    })
  ]);

  const byCampaign = new Map();

  leadRows.forEach((row) => {
    if (origen && normalizeMarketingOriginGroup(row.origen) !== origen) return;

    const current = getMarketingCampaignTotal(byCampaign, row.campaign);
    if (!current) return;

    current.agendas += 1;

    const applicableAgenda = isMarketingApplicableAgenda(row);
    const ccSuccess = isMarketingCcSuccess(row);

    if (applicableAgenda) {
      current.aplican += 1;

      if (ccSuccess) {
        current.ccExitosos += 1;
      } else {
        current.ccNoExitosos += 1;
      }
    }

    if (isMarketingCompletedMeeting(row)) {
      current.reuniones += 1;

      if (ccSuccess) {
        current.reunionesCce += 1;
      } else {
        current.reunionesCcne += 1;
      }
    }
  });

  comprobanteRows.forEach((row) => {
    if (String(row.tipo || '').trim().toLowerCase() !== 'venta') return;

    const producto = String(row.producto_format || '').trim();
    if (!producto || producto.toLowerCase() === 'empty') return;
    if (producto.toLowerCase().includes('club')) return;

    if (origen && normalizeMarketingOriginGroup(row.origen) !== origen) return;

    const current = getMarketingCampaignTotal(byCampaign, row.campaign);
    if (!current) return;

    current.ventas += 1;
    current.facturacion += Number(row.facturacion || 0);
    current.cashCollected += Number(row.cash_collected || 0);

    const estadoCc = normalizeMarketingText(row.estado_cc);
    if (estadoCc === 'exitoso') {
      current.ventasCce += 1;
    } else if (estadoCc === 'no exitoso') {
      current.ventasCcne += 1;
    }
  });

  return [...byCampaign.values()]
    .map((row) => ({
      ...row,
      tasaCierre: row.reuniones > 0 ? (row.ventas * 100) / row.reuniones : 0,
      aov: row.ventas > 0 ? row.facturacion / row.ventas : 0
    }))
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      const agendasDiff = b.agendas - a.agendas;
      if (agendasDiff !== 0) return agendasDiff;
      return a.campaign.localeCompare(b.campaign);
    });
}

async function ensureStorageBucket(bucketId, options = {}) {
  const url = `${env.supabaseUrl}/storage/v1/bucket`;
  const allowedMimeTypes = Array.isArray(options.allowedMimeTypes) && options.allowedMimeTypes.length
    ? options.allowedMimeTypes
    : null;

  try {
    await axios.post(url, {
      id: bucketId,
      name: bucketId,
      public: false,
      file_size_limit: 20971520,
      allowed_mime_types: allowedMimeTypes
    }, {
      headers: buildStorageHeaders({ 'Content-Type': 'application/json' })
    });
  } catch (err) {
    const message = String(err.response?.data?.message || err.message || '').toLowerCase();
    if (
      err.response?.status === 409
      || message.includes('already exists')
      || message.includes('duplicate')
    ) {
      return;
    }

    const error = new Error(`Error asegurando bucket ${bucketId}: ${err.response?.data?.message || err.message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function ensureReportesPersonalesBucket() {
  return ensureStorageBucket(env.reportesPersonalesBucket, {
    allowedMimeTypes: ['application/pdf']
  });
}

async function ensureReportesPersonalesDataBucket() {
  return ensureStorageBucket(env.reportesPersonalesDataBucket, {
    allowedMimeTypes: ['application/json']
  });
}

async function getCloserPersonalPdf(params = {}) {
  const normalized = normalizeReportePersonalPdfParams(params);
  const signUrl = `${env.supabaseUrl}/storage/v1/object/sign/${normalized.bucket}/${encodeStoragePath(normalized.objectPath)}`;

  try {
    const response = await axios.post(signUrl, {
      expiresIn: 60 * 60 * 24
    }, {
      headers: buildStorageHeaders({ 'Content-Type': 'application/json' })
    });

    const signedUrl = response.data?.signedURL || response.data?.signedUrl || null;
    const absoluteUrl = signedUrl
      ? (signedUrl.startsWith('http')
        ? signedUrl
        : `${env.supabaseUrl}/storage/v1${signedUrl}`)
      : null;

    return {
      exists: Boolean(absoluteUrl),
      closer: normalized.closer,
      month: normalized.month,
      filename: normalized.safeFilename,
      path: normalized.objectPath,
      downloadUrl: absoluteUrl
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const message = String(err.response?.data?.message || err.message || '');
    if (status === 400 || status === 404 || /not found/i.test(message)) {
      return {
        exists: false,
        closer: normalized.closer,
        month: normalized.month,
        filename: normalized.safeFilename,
        path: normalized.objectPath,
        downloadUrl: null
      };
    }

    const error = new Error(`Error consultando PDF personal: ${message}`);
    error.statusCode = status;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function uploadCloserPersonalPdf(params = {}, fileBuffer, user) {
  const normalized = normalizeReportePersonalPdfParams(params);

  if (!Buffer.isBuffer(fileBuffer) || !fileBuffer.length) {
    const error = new Error('No llegó un archivo PDF para subir');
    error.statusCode = 400;
    throw error;
  }

  await ensureReportesPersonalesBucket();

  const uploadUrl = `${env.supabaseUrl}/storage/v1/object/${normalized.bucket}/${encodeStoragePath(normalized.objectPath)}`;

  try {
    await axios.post(uploadUrl, fileBuffer, {
      headers: buildStorageHeaders({
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
        'cache-control': '3600'
      }),
      maxBodyLength: Infinity
    });

    const pdf = await getCloserPersonalPdf(normalized);
    return {
      ...pdf,
      uploadedBy: String(user?.email || '').trim().toLowerCase() || null
    };
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error subiendo PDF personal: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function getStoredCloserPersonalReport(params = {}) {
  const normalized = normalizeReportePersonalReportParams(params);
  const url = `${env.supabaseUrl}/storage/v1/object/${normalized.bucket}/${encodeStoragePath(normalized.objectPath)}`;

  try {
    const response = await axios.get(url, {
      headers: buildStorageHeaders(),
      responseType: 'text'
    });
    const raw = typeof response.data === 'string'
      ? response.data
      : Buffer.isBuffer(response.data)
        ? response.data.toString('utf8')
        : JSON.stringify(response.data || {});
    const report = JSON.parse(raw);

    return {
      exists: true,
      closer: normalized.closer,
      month: normalized.month,
      path: normalized.objectPath,
      report
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const message = String(err.response?.data?.message || err.message || '');
    if (status === 400 || status === 404 || /not found/i.test(message)) {
      return {
        exists: false,
        closer: normalized.closer,
        month: normalized.month,
        path: normalized.objectPath,
        report: null
      };
    }

    const error = new Error(`Error consultando reporte personal guardado: ${message}`);
    error.statusCode = status;
    error.details = err.response?.data || null;
    throw error;
  }
}

async function saveCloserPersonalReport(params = {}, reportPayload = {}, user) {
  const normalized = normalizeReportePersonalReportParams(params);

  if (!reportPayload || typeof reportPayload !== 'object') {
    const error = new Error('No llegó contenido válido para guardar el reporte personal');
    error.statusCode = 400;
    throw error;
  }

  await ensureReportesPersonalesDataBucket();

  const uploadUrl = `${env.supabaseUrl}/storage/v1/object/${normalized.bucket}/${encodeStoragePath(normalized.objectPath)}`;
  const body = Buffer.from(JSON.stringify({
    ...reportPayload,
    savedAt: new Date().toISOString(),
    savedBy: String(user?.email || '').trim().toLowerCase() || null
  }, null, 2), 'utf8');

  try {
    await axios.post(uploadUrl, body, {
      headers: buildStorageHeaders({
        'Content-Type': 'application/json',
        'x-upsert': 'true',
        'cache-control': '3600'
      }),
      maxBodyLength: Infinity
    });

    return getStoredCloserPersonalReport(normalized);
  } catch (err) {
    const message = err.response?.data?.message || err.message;
    const error = new Error(`Error guardando reporte personal: ${message}`);
    error.statusCode = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

module.exports = {
  listResources,
  listRows,
  getKpiCloserRules,
  upsertKpiCloserRules,
  getAgendaBonusRules,
  upsertAgendaBonusRules,
  listAgendaCalendarAssignments,
  upsertAgendaCalendarAssignment,
  getAgendaCheckpoints,
  updateAgendaCheckpoint,
  listUtmLinkPresets,
  upsertUtmLinkPreset,
  deleteUtmLinkPreset,
  upsertContactoInstagramWebhook,
  searchContactoInstagramWebhook,
  getReportesPremioConfig,
  upsertReportesPremioConfig,
  listReportComments,
  createReportComment,
  markReportCommentRead,
  getMarketingInvestment,
  upsertMarketingInvestment,
  listMarketingInvestments,
  updateMarketingInvestmentRecord,
  deleteMarketingInvestmentRecord,
  getMarketingAovDia1,
  getMarketingVentasTotales,
  getMarketingCashCollectedAgenda,
  getMarketingCampaignTotals,
  getCloserPersonalPdf,
  uploadCloserPersonalPdf,
  getStoredCloserPersonalReport,
  saveCloserPersonalReport,
  normalizeResourceName,
  parseLimit,
  parseOffset
};
