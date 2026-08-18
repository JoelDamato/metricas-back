const axios = require('axios');
const env = require('../config/env');

const PAGE_SIZE = 500;
const MAX_ROWS = 10000;
const LIST_COLUMNS = [
  'id',
  'cliente_format',
  'ghlid',
  'tipo',
  'producto_format',
  'medios_de_pago_format',
  'f_venta',
  'f_acreditacion',
  'fecha_creado',
  'created_at',
  'facturacion',
  'cash_collected',
  'cash_ar',
  'cash_collected_ar',
  'cash_collected_ars',
  'tc',
  'estado',
  'rebotar_pago',
  'creado_por',
  'responsable_venta',
  'setter',
  'info_comprobantes'
].join(',');

const RECONCILIATION_STATES = {
  conciliated: 'Conciliado',
  not_conciliated: null,
  bounced: 'Rebotado'
};

function requiredSupabaseEnv() {
  if (!env.supabaseUrl || !env.supabaseKey) {
    const error = new Error('Faltan variables de Supabase para conciliación');
    error.statusCode = 500;
    throw error;
  }
}

function requiredNotionEnv() {
  if (!env.notionApiKey) {
    const error = new Error('Falta NOTION_API_KEY para actualizar conciliación');
    error.statusCode = 500;
    throw error;
  }
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: env.supabaseKey,
    Authorization: `Bearer ${env.supabaseKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function notionHeaders() {
  return {
    Authorization: `Bearer ${env.notionApiKey}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function reconciliationStateFromRow(row = {}) {
  const status = normalizeText(row.estado);
  if (status.includes('rebot')) return 'bounced';
  if (status.includes('concili') && !status.includes('sin conciliar')) return 'conciliated';
  return 'not_conciliated';
}

function normalizeReconciliationState(value) {
  const state = String(value || '').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(RECONCILIATION_STATES, state)) {
    const error = new Error('Estado inválido. Elegí Conciliado, No conciliado o Rebotado');
    error.statusCode = 400;
    throw error;
  }
  return state;
}

function normalizeUuid(value) {
  const compact = String(value || '').trim().replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) {
    const error = new Error('El comprobante indicado no es válido');
    error.statusCode = 400;
    throw error;
  }
  return compact.replace(
    /^(........)(....)(....)(....)(............)$/,
    '$1-$2-$3-$4-$5'
  );
}

function sortRowsNewestFirst(rows = []) {
  return rows.sort((left, right) => {
    const leftDate = String(left.f_acreditacion || left.fecha_creado || left.created_at || '');
    const rightDate = String(right.f_acreditacion || right.fecha_creado || right.created_at || '');
    return rightDate.localeCompare(leftDate) || String(right.id || '').localeCompare(String(left.id || ''));
  });
}

function summarizeRows(rows = []) {
  return rows.reduce((summary, row) => {
    const state = reconciliationStateFromRow(row);
    summary.total += 1;
    summary[state] += 1;
    return summary;
  }, {
    total: 0,
    conciliated: 0,
    not_conciliated: 0,
    bounced: 0
  });
}

async function listAllComprobantes() {
  requiredSupabaseEnv();
  const rows = [];
  let lastId = '';

  while (rows.length < MAX_ROWS) {
    const response = await axios.get(`${env.supabaseUrl}/rest/v1/comprobantes`, {
      headers: supabaseHeaders(),
      params: {
        select: LIST_COLUMNS,
        order: 'id.asc',
        limit: PAGE_SIZE,
        ...(lastId ? { id: `gt.${lastId}` } : {})
      }
    });

    const chunk = Array.isArray(response.data) ? response.data : [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;

    const nextLastId = String(chunk[chunk.length - 1]?.id || '');
    if (!nextLastId || nextLastId === lastId) {
      const error = new Error('No pude continuar la paginación de comprobantes');
      error.statusCode = 502;
      throw error;
    }
    lastId = nextLastId;
  }

  if (rows.length >= MAX_ROWS) {
    const error = new Error(`La conciliación superó el límite operativo de ${MAX_ROWS} comprobantes`);
    error.statusCode = 409;
    throw error;
  }

  sortRowsNewestFirst(rows);
  return {
    rows,
    count: rows.length,
    summary: summarizeRows(rows)
  };
}

async function findComprobante(id) {
  const response = await axios.get(`${env.supabaseUrl}/rest/v1/comprobantes`, {
    headers: supabaseHeaders(),
    params: {
      select: LIST_COLUMNS,
      id: `eq.${id}`,
      limit: 1
    }
  });
  const row = response.data?.[0] || null;
  if (!row) {
    const error = new Error('No encontré ese comprobante en Supabase');
    error.statusCode = 404;
    throw error;
  }
  return row;
}

async function updateComprobanteState(rawId, rawState) {
  requiredSupabaseEnv();
  requiredNotionEnv();
  const id = normalizeUuid(rawId);
  const state = normalizeReconciliationState(rawState);
  const previous = await findComprobante(id);
  const notionStatus = RECONCILIATION_STATES[state];

  await axios.patch(
    `https://api.notion.com/v1/pages/${id}`,
    {
      properties: {
        Estado: {
          select: notionStatus ? { name: notionStatus } : null
        }
      }
    },
    {
      headers: notionHeaders(),
      timeout: 30000
    }
  );

  const response = await axios.patch(
    `${env.supabaseUrl}/rest/v1/comprobantes`,
    {
      estado: notionStatus,
      rebotar_pago: false
    },
    {
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      params: { id: `eq.${id}` }
    }
  );

  const updated = response.data?.[0] || {
    ...previous,
    estado: notionStatus,
    rebotar_pago: false
  };

  return {
    row: updated,
    previousState: reconciliationStateFromRow(previous),
    state,
    message: `Comprobante marcado como ${notionStatus || 'No conciliado'}`
  };
}

module.exports = {
  listAllComprobantes,
  updateComprobanteState,
  _test: {
    reconciliationStateFromRow,
    normalizeReconciliationState,
    normalizeUuid,
    sortRowsNewestFirst,
    summarizeRows
  }
};
