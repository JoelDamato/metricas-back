const csmContactSummary = require('../modules/csm/contact-summary');
const {listContactReceipts,totals,openingBalance}=require('../modules/metricasv2/services/comprobantes-contacto.service');
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
    setter: row.setter || '',
    closer: row.closer || '',
    facturacionTotal: normalizeAmount(row.facturacion_total),
    cashCollectedTotal: normalizeAmount(row.cash_collected_total)
  };
}

function getRowScore(row) {
  let score = row.extra?.ghl_receipts_managed ? 10 : 0;
  if (row.facturacion_total !== null && row.facturacion_total !== undefined) score += 2;
  if (row.cash_collected_total !== null && row.cash_collected_total !== undefined) score += 2;
  if (row.etapa && row.etapa !== 'Sin agenda') score += 1;
  return score;
}

async function fetchContactByGhlId(ghlId) {
  const { supabaseUrl } = getSupabaseConfig();

  const [leadRows, csmResponse] = await Promise.all([
    (async () => {
      const result=[];
      for(let offset=0;;offset+=500){
        const {data}=await axios.get(`${supabaseUrl}/rest/v1/leads_raw`, {
          headers:buildHeaders(), timeout:30000,
          params:{select:'id,ghlid,nombre,mail,telefono,etapa,facturacion_total,cash_collected_total,setter,closer,extra',ghlid:`eq.${ghlId}`,order:'id.asc',limit:500,offset}
        });
        result.push(...data);if(data.length<500)return result;
      }
    })(),
    axios.get(`${supabaseUrl}/rest/v1/csm`, {
      headers: buildHeaders(),
      params: {
        select: ['id','crm_2_0','nombre','mail','telefono','ghlid','ultimo_producto_adquirido','closer',...csmContactSummary.fields].join(','),
        ghlid: `eq.${ghlId}`,
        order: 'updated_at.desc',
        limit: 5
      }
    }),

  ]);

  const rows = leadRows;
  let row = rows
    .slice()
    .sort((a, b) => getRowScore(b) - getRowScore(a))[0] || null;

  const csmRow = (csmResponse.data || [])[0] || null;
  const comprobantesRows = await listContactReceipts(ghlId,[...rows.map(r=>r.id),csmRow?.crm_2_0].filter(Boolean));
  const latestComprobante = comprobantesRows[0] || null;
  if(!row && !csmRow && !latestComprobante)return null;
  if(!row)row={nombre:csmRow?.nombre||latestComprobante?.cliente_format||'Sin nombre',mail:csmRow?.mail||latestComprobante?.mail,telefono:csmRow?.telefono||latestComprobante?.telefono,closer:csmRow?.closer,etapa:csmRow?'Cliente CSM':'Con comprobantes'};

  const contact = mapLead(row, ghlId);
  const historicalOpeningBalance=openingBalance(row.extra);
  const receiptTotals=totals(comprobantesRows,historicalOpeningBalance);
  contact.historicalOpeningBalance=historicalOpeningBalance;
  contact.comprobantes=comprobantesRows;
  contact.receiptTotals=receiptTotals;
  contact.facturacionTotal=receiptTotals.facturacion;
  contact.cashCollectedTotal=receiptTotals.cobrado;
  contact.areas = {
    comercial: [
      { label: 'Etapa', value: row.etapa || 'Sin dato' },
      { label: 'Setter', value: row.setter || 'Sin dato' },
      { label: 'Closer', value: row.closer || csmRow?.closer || 'Sin dato' }
    ],
    csm: csmContactSummary.summary(csmRow),
    administracion: [
      { label: 'Facturación total', value: receiptTotals.facturacion, type: 'amount' },
      { label: 'Cobrado conciliado sin IVA', value: receiptTotals.cobrado, type: 'amount' },
      { label: 'Último comprobante', value: latestComprobante ? `${latestComprobante.tipo || 'Sin tipo'} · ${latestComprobante.medios_de_pago_format || latestComprobante.estado || latestComprobante.producto_format || 'Sin dato'}` : 'Sin dato' }
    ]
  };

  return contact;
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

    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(ghlId))return res.status(400).json({ok:false,message:'GHL ID inválido'});

    if (acceptsHtml) {
      return res.redirect(`/contacto-estado/${encodeURIComponent(ghlId)}`);
    }

    const cacheKey = getCacheKey(ghlId);
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


    res.set('Cache-Control', 'no-store');
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
  getContactStatus,
  invalidateCache:()=>responseCache.flushAll(),
  _test:{fetchContactByGhlId}
};
