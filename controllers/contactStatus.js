const axios = require('axios');
const NodeCache = require('node-cache');

const responseCache = new NodeCache({
  stdTTL: 600,
  checkperiod: 60,
  useClones: false
});

const inFlightRequests = new Map();

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const error = new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    error.statusCode = 500;
    throw error;
  }

  return { supabaseUrl, supabaseKey };
}

function buildHeaders() {
  const { supabaseKey } = getSupabaseConfig();
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`
  };
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;

  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
}

function getCacheKey(ghlId) {
  return `contact-status:${ghlId}`;
}

function mapLead(row, ghlId) {
  return {
    pageId: row.id || null,
    ghlId,
    estado: row.etapa || 'Sin estado',
    nombre: row.nombre || 'Sin nombre',
    email: row.mail || '',
    telefono: row.telefono || '',
    facturacionTotal: normalizeAmount(row.facturacion_total),
    cashCollectedTotal: normalizeAmount(row.cash_collected_total)
  };
}

function getRowScore(row) {
  let score = 0;
  if (row.facturacion_total !== null && row.facturacion_total !== undefined) score += 2;
  if (row.cash_collected_total !== null && row.cash_collected_total !== undefined) score += 2;
  if (row.etapa && row.etapa !== 'Sin agenda') score += 1;
  return score;
}

async function fetchContactByGhlId(ghlId) {
  const { supabaseUrl } = getSupabaseConfig();

  const response = await axios.get(`${supabaseUrl}/rest/v1/leads_raw`, {
    headers: buildHeaders(),
    params: {
      select: 'id,ghlid,nombre,mail,telefono,etapa,facturacion_total,cash_collected_total',
      ghlid: `eq.${ghlId}`,
      order: 'last_edited_time.desc',
      limit: 10
    }
  });

  const rows = response.data || [];
  const row = rows
    .slice()
    .sort((a, b) => getRowScore(b) - getRowScore(a))[0] || null;

  return row ? mapLead(row, ghlId) : null;
}

async function getContactStatus(req, res, next) {
  try {
    const ghlId = String(req.params.ghlId || req.query.ghlId || '').trim();
    const acceptsHtml = String(req.headers.accept || '').includes('text/html');

    if (!ghlId) {
      return res.status(400).json({
        ok: false,
        message: 'Falta ghlId'
      });
    }

    if (acceptsHtml) {
      return res.redirect(`/contacto-estado/${encodeURIComponent(ghlId)}`);
    }

    const cacheKey = getCacheKey(ghlId);
    const cached = responseCache.get(cacheKey);

    if (cached) {
      res.set('Cache-Control', 'private, max-age=60');
      return res.json({
        ok: true,
        cached: true,
        source: 'supabase',
        contact: cached
      });
    }

    let promise = inFlightRequests.get(cacheKey);
    if (!promise) {
      promise = fetchContactByGhlId(ghlId)
        .finally(() => {
          inFlightRequests.delete(cacheKey);
        });
      inFlightRequests.set(cacheKey, promise);
    }

    const contact = await promise;

    if (!contact) {
      return res.status(404).json({
        ok: false,
        message: 'No encontramos un contacto con ese GHL ID'
      });
    }

    responseCache.set(cacheKey, contact);
    res.set('Cache-Control', 'private, max-age=60');
    res.json({
      ok: true,
      cached: false,
      source: 'supabase',
      contact
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getContactStatus
};
