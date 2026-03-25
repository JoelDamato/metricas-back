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

  if (from && to) {
    params.and = `(${field}.gte.${from},${field}.lte.${to})`;
    return;
  }

  if (from) {
    params[field] = `gte.${from}`;
    return;
  }

  params[field] = `lte.${to}`;
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

async function getMarketingInvestment({ from, to, origen }) {
  validateDateRange(from, to);

  const safeOrigin = normalizeMarketingOrigin(origen);
  const url = `${env.supabaseUrl}/rest/v1/kpi_marketing_inversiones`;

  try {
    const response = await axios.get(url, {
      headers: buildHeaders(),
      params: {
        select: '*',
        fecha_desde: `eq.${from}`,
        fecha_hasta: `eq.${to}`,
        origen: `eq.${safeOrigin}`,
        limit: 1
      }
    });

    return response.data?.[0] || {
      fecha_desde: from,
      fecha_hasta: to,
      origen: safeOrigin,
      inversion_planificada: 0,
      inversion_realizada: 0
    };
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

  const body = {
    fecha_desde: payload.from,
    fecha_hasta: payload.to,
    origen: normalizeMarketingOrigin(payload.origen),
    inversion_planificada: Number(payload.inversion_planificada || 0),
    inversion_realizada: Number(payload.inversion_realizada || 0),
    updated_at: new Date().toISOString()
  };

  const url = `${env.supabaseUrl}/rest/v1/kpi_marketing_inversiones`;

  try {
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

async function getMarketingAovDia1({ from, to, origen }) {
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

module.exports = {
  listResources,
  listRows,
  getKpiCloserRules,
  upsertKpiCloserRules,
  getMarketingInvestment,
  upsertMarketingInvestment,
  getMarketingAovDia1,
  getMarketingVentasTotales,
  normalizeResourceName,
  parseLimit,
  parseOffset
};
