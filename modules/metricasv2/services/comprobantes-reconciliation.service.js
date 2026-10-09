const axios = require('axios');
const env = require('../config/env');

const PAGE_SIZE = 500;
const MAX_ROWS = 10000;
const LIST_COLUMNS = [
  'id',
  'cliente_format',
  'ghlid',
  'mail',
  'dni_cuit',
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
  'motivo_rebote',
  'nota_conciliacion',
  'nota_conciliacion_revision',
  'nota_conciliacion_autor',
  'nota_conciliacion_fecha',
  'rebotar_pago',
  'creado_por',
  'responsable_venta',
  'setter',
  'info_comprobantes',
  'source_system'
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

function supabaseHeaders(extra = {}) {
  return {
    apikey: env.supabaseKey,
    Authorization: `Bearer ${env.supabaseKey}`,
    'Content-Type': 'application/json',
    ...extra
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
  let listColumns = LIST_COLUMNS;

  while (rows.length < MAX_ROWS) {
    const fetchPage = () => axios.get(`${env.supabaseUrl}/rest/v1/comprobantes`, {
      headers: supabaseHeaders(),
      params: {
        select: listColumns,
        order: 'id.asc',
        limit: PAGE_SIZE,
        ...(lastId ? { id: `gt.${lastId}` } : {})
      }
    });
    let response;
    try { response = await fetchPage(); } catch (error) {
      if (!listColumns.includes('source_system') || !String(error.response?.data?.message || '').includes('source_system')) throw error;
      listColumns = listColumns.split(',').filter((column) => column !== 'source_system').join(',');
      response = await fetchPage();
    }

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

  for (const row of rows) if (/^\[(TEST SUPABASE LOCAL|SUPABASE DIRECT)\]/.test(String(row.info_comprobantes || ''))) row.source_system = 'supabase_direct';
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
      select: LIST_COLUMNS.split(',').filter(column => column !== 'source_system').join(','),
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
  const id = normalizeUuid(rawId);
  const state = normalizeReconciliationState(rawState);
  const previous = await findComprobante(id);
  const status = RECONCILIATION_STATES[state];

  const response = await axios.patch(
    `${env.supabaseUrl}/rest/v1/comprobantes`,
    {
      estado: status,
      rebotar_pago: state === 'bounced'
    },
    {
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      params: { id: `eq.${id}` }
    }
  );

  const updated = response.data?.[0];
  if (!updated) {
    const error = new Error('El comprobante ya no existe; recargá la conciliación.');
    error.statusCode = 409;
    throw error;
  }

  return {
    row: updated,
    previousState: reconciliationStateFromRow(previous),
    state,
    message: `Comprobante marcado como ${status || 'No conciliado'}`
  };
}

async function saveReconciliationNote(rawId, input, user) {
  requiredSupabaseEnv();
  const id=normalizeUuid(rawId),note=input?.note,revision=input?.revision;
  if(typeof note!=='string'||note.length>4000||!Number.isInteger(revision)||revision<0){
    const error=new Error('La nota debe tener hasta 4000 caracteres y una revisión válida');error.statusCode=400;throw error;
  }
  const response=await axios.post(`${env.supabaseUrl}/rest/v1/rpc/metricas_reconciliation_note`,{
    p_id:id,p_note:note.trim(),p_revision:revision,p_author:user.nombre||user.email
  },{headers:supabaseHeaders(),timeout:15000});
  if(response.data?.conflict||!response.data?.row){const error=new Error('La nota cambió o el comprobante ya no existe. Recargá antes de guardar.');error.statusCode=409;throw error;}
  return {row:response.data.row,message:'Nota guardada. El closer puede verla en Mis comprobantes.'};
}

module.exports = {
  saveReconciliationNote,
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
