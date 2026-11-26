// Facturación ARCA: comprobantes de cuentas propias pendientes de facturar a mano en ARCA.
// Criterio definido con Nadia (26-11-2026): acreditados desde el 1/11/2026, sin Club,
// y de los medios sin «Cuit a Facturar» sólo entra Exentos (Efectivo y PayPal quedan afuera).
const axios = require('axios');
const env = require('../config/env');
const { extractObservaciones } = require('./info-comprobantes');

const ARCA_START_DATE = '2026-11-01';
const EXCLUDED_METHODS = new Set(['efectivo', 'paypal', 'club - transferencias']);
const MAX_ROWS = 3000;
const MAX_BATCH = 200;
const BASE_COLUMNS = [
  'id', 'cliente_format', 'ghlid', 'dni_cuit', 'tipo', 'producto_format', 'medios_de_pago_format', 'tipo_banco',
  'f_acreditacion', 'cash_collected', 'cash_ar', 'cash_collected_ar', 'cash_collected_ars', 'tc', 'estado',
  'nota_conciliacion', 'creado_por', 'responsable_venta', 'info_comprobantes', 'facturacion_arca', 'fecha_facturado'
];
const AUTHOR_COLUMN = 'facturado_arca_por';

function requiredSupabaseEnv() {
  if (!env.supabaseUrl || !env.supabaseKey) {
    const error = new Error('Faltan variables de Supabase para Facturación ARCA');
    error.statusCode = 500;
    throw error;
  }
}

function headers() {
  return { apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}`, 'Content-Type': 'application/json' };
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function isBilled(row = {}) {
  return ['true', '1', 'si', 'sí'].includes(normalizeText(row.facturacion_arca));
}

function isEligible(row = {}) {
  if (row.tipo_banco !== 'Propia') return false;
  if (String(row.f_acreditacion || '').slice(0, 10) < ARCA_START_DATE) return false;
  if (normalizeText(row.producto_format).includes('club')) return false;
  if (EXCLUDED_METHODS.has(normalizeText(row.medios_de_pago_format))) return false;
  return true;
}

function present(row) {
  const { info_comprobantes: info, ...rest } = row;
  return {
    ...rest,
    observaciones_closer: extractObservaciones(info),
    facturado_arca: isBilled(row),
    facturado_arca_por: row.facturado_arca_por || null
  };
}

let authorColumnAvailable = true;

async function fetchCandidates(extraParams = {}) {
  const run = (columns) => axios.get(`${env.supabaseUrl}/rest/v1/comprobantes`, {
    headers: headers(),
    timeout: 20000,
    params: {
      select: columns.join(','),
      tipo_banco: 'eq.Propia',
      f_acreditacion: `gte.${ARCA_START_DATE}`,
      order: 'f_acreditacion.asc,id.asc',
      limit: MAX_ROWS,
      ...extraParams
    }
  });
  if (authorColumnAvailable) {
    try { return (await run([...BASE_COLUMNS, AUTHOR_COLUMN])).data || []; } catch (error) {
      // Antes de aplicar la migración la columna no existe: se lista igual, sin el autor.
      if (!String(error.response?.data?.message || '').includes(AUTHOR_COLUMN)) throw error;
      authorColumnAvailable = false;
    }
  }
  return (await run(BASE_COLUMNS)).data || [];
}

async function listArcaComprobantes() {
  requiredSupabaseEnv();
  const rows = (await fetchCandidates()).filter(isEligible).map(present);
  const summary = rows.reduce((acc, row) => {
    const key = row.facturado_arca ? 'billed' : 'pending';
    acc[key] += 1;
    acc.all += 1;
    return acc;
  }, { all: 0, pending: 0, billed: 0 });
  return { rows, summary, startDate: ARCA_START_DATE, canRecordAuthor: authorColumnAvailable };
}

function normalizeIds(raw) {
  const ids = [...new Set((Array.isArray(raw) ? raw : []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length || ids.length > MAX_BATCH || ids.some((id) => !/^[0-9a-f-]{32,36}$/i.test(id))) {
    const error = new Error(`Elegí entre 1 y ${MAX_BATCH} comprobantes válidos`);
    error.statusCode = 400;
    throw error;
  }
  return ids;
}

async function setArcaBilled(input = {}, user = {}) {
  requiredSupabaseEnv();
  const ids = normalizeIds(input.ids);
  if (typeof input.billed !== 'boolean') {
    const error = new Error('Indicá si el comprobante quedó facturado o pendiente');
    error.statusCode = 400;
    throw error;
  }
  const author = String(user.nombre || user.email || '').trim();
  if (!author) {
    const error = new Error('No pude identificar quién marca la facturación');
    error.statusCode = 401;
    throw error;
  }
  const candidates = await fetchCandidates({ id: `in.(${ids.join(',')})` });
  const eligible = new Set(candidates.filter(isEligible).map((row) => row.id));
  if (ids.some((id) => !eligible.has(id))) {
    const error = new Error('Alguno de los comprobantes no está en Facturación ARCA. Recargá la lista.');
    error.statusCode = 409;
    throw error;
  }
  const response = await axios.post(`${env.supabaseUrl}/rest/v1/rpc/metricas_set_arca_billed`, {
    p_ids: ids, p_billed: input.billed, p_author: author
  }, { headers: headers(), timeout: 15000 });
  const changed = Array.isArray(response.data?.rows) ? response.data.rows : [];
  if (changed.length !== ids.length) {
    const error = new Error('No se pudieron marcar todos los comprobantes. Recargá la lista.');
    error.statusCode = 409;
    throw error;
  }
  return {
    rows: changed.map((row) => ({ ...row, facturado_arca: isBilled(row) })),
    message: input.billed
      ? `${changed.length === 1 ? 'Comprobante marcado' : `${changed.length} comprobantes marcados`} como facturado en ARCA`
      : `${changed.length === 1 ? 'Comprobante devuelto' : `${changed.length} comprobantes devueltos`} a pendientes`
  };
}

module.exports = {
  listArcaComprobantes,
  setArcaBilled,
  _test: { isEligible, isBilled, normalizeIds, ARCA_START_DATE, resetAuthorColumn: () => { authorColumnAvailable = true; } }
};
