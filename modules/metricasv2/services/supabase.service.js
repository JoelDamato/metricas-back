const axios = require('axios');
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

function normalizePercentNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    select: '*',
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

    if (!sameDay(row.fecha_correspondiente, row.fecha_de_llamada)) return false;

    if (origen && normalizeMarketingOriginGroup(row.origen) !== origen) {
      return false;
    }

    if (estrategia && normalizeStrategyGroup(row.estrategia_a || row.estrategia) !== normalizeStrategyGroup(estrategia)) {
      return false;
    }

    if (closer && normalizeCloserGroup(row.creado_por) !== normalizeCloserGroup(closer)) {
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

module.exports = {
  listResources,
  listRows,
  getKpiCloserRules,
  upsertKpiCloserRules,
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
  getMarketingCampaignTotals,
  normalizeResourceName,
  parseLimit,
  parseOffset
};
