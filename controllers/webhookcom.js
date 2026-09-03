const axios = require('axios');
const { NOTION_PERSON_NAME_BY_ID } = require('../modules/metricasv2/config/notion-people');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleScriptUrl = process.env.GOOGLE_SCRIPT_WEBHOOK || "https://script.google.com/macros/s/AKfycbxij3VPCpyGs3-adtVGEjzC1rVd9tgDyGs19_ChKUo5SytA_-K_pz_vghfFBQSVh6ZdHg/exec";
const GOOGLE_SHEETS_TIMEOUT_MS = parseInt(process.env.GOOGLE_SHEETS_TIMEOUT_MS || '120000', 10);

let sheetsQueue = Promise.resolve();

function toNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

function formatIsoNoMillis(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function shiftDateToArgentinaWallClock(date) {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000);
}

// Función para normalizar fechas al formato de Supabase (timestamp)
function normalizeDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue === null || dateValue === undefined) return null;
  if (typeof dateValue === 'string' && dateValue.trim() === '') return null;

  try {
    if (typeof dateValue === 'string') {
      const trimmed = dateValue.trim();

      // Notion suele enviar fechas "solo fecha" como YYYY-MM-DD.
      // Las guardamos como medianoche de Argentina para no caer el día anterior en UTC.
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return `${trimmed}T03:00:00Z`;
      }

      const parsed = new Date(trimmed);
      if (isNaN(parsed.getTime())) return null;

      // Para fechas con hora que llegan desde Notion en UTC,
      // guardamos la misma hora visual que ve el equipo en Argentina.
      return formatIsoNoMillis(shiftDateToArgentinaWallClock(parsed));
    }

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;

    return formatIsoNoMillis(shiftDateToArgentinaWallClock(date));
  } catch (error) {
    console.warn('⚠️ Error normalizando fecha:', dateValue, error.message);
    return null;
  }
}

// Para logs conviene guardar UTC real y convertir a Argentina en la UI.
function nowISO() {
  return formatIsoNoMillis(new Date());
}

// Función para safe stringify (evita errores con objetos circulares)
function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, function(key, value) {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  });
}

// Función para guardar logs en Supabase
async function saveLog(logData) {
  try {
    const processedData = { ...logData };

    // Asegurar que payload, attempted_data y supabase_error sean strings
    if (processedData.payload && typeof processedData.payload !== 'string') {
      try {
        processedData.payload = safeStringify(processedData.payload);
      } catch (e) {
        processedData.payload = String(processedData.payload);
      }
    }

    if (processedData.attempted_data && typeof processedData.attempted_data !== 'string') {
      try {
        processedData.attempted_data = safeStringify(processedData.attempted_data);
      } catch (e) {
        processedData.attempted_data = String(processedData.attempted_data);
      }
    }

    if (processedData.supabase_error && typeof processedData.supabase_error !== 'string') {
      try {
        processedData.supabase_error = safeStringify(processedData.supabase_error);
      } catch (e) {
        processedData.supabase_error = String(processedData.supabase_error);
      }
    }

    // Guardamos UTC real; la vista lo convierte a hora argentina.
    if (!Object.prototype.hasOwnProperty.call(processedData, 'created_at')) {
      processedData.created_at = nowISO();
    }

    await axios.post(`${SUPABASE_URL}/rest/v1/webhook_logs`, processedData, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('📝 Log guardado en Supabase');
  } catch (err) {
    console.error('❌ Error al guardar log:', err.message);
    console.error('📋 Status:', err.response?.status);
    console.error('📋 Error details:', JSON.stringify(err.response?.data, null, 2));
  }
}

// Helper universal que detecta el tipo de propiedad automáticamente
function getValue(prop) {
  if (!prop) return null;
  
  switch (prop.type) {
    case 'title':
    case 'rich_text':
      return prop[prop.type]?.[0]?.plain_text || null;
    
    case 'number':
      return prop.number ?? null;
    
    case 'select':
      return prop.select?.name ?? null;
    
    case 'multi_select':
      return prop.multi_select?.map(s => s.name).join(', ') || null;
    
    case 'date':
      return normalizeDate(prop.date?.start);
    
    case 'checkbox':
      return prop.checkbox ?? null;
    
    case 'url':
      return prop.url ?? null;
    
    case 'email':
      return prop.email ?? null;
    
    case 'phone_number':
      return prop.phone_number ?? null;
    
    case 'formula':
      if (prop.formula.type === 'string') return prop.formula.string;
      if (prop.formula.type === 'number') return prop.formula.number;
      if (prop.formula.type === 'boolean') return prop.formula.boolean;
      if (prop.formula.type === 'date') return normalizeDate(prop.formula.date?.start);
      return null;
    
    case 'rollup':
      if (prop.rollup.type === 'number') return prop.rollup.number;
      if (prop.rollup.type === 'date') return normalizeDate(prop.rollup.date?.start);
      if (prop.rollup.type === 'array') return prop.rollup.array?.length || 0;
      return null;
    
    case 'people':
      return prop.people?.[0]?.name
        ?? NOTION_PERSON_NAME_BY_ID[prop.people?.[0]?.id]
        ?? null;

    case 'relation':
      return prop.relation?.[0]?.id ?? null;
    
    case 'files':
      return prop.files?.[0]?.name ?? null;
    
    case 'created_time':
    case 'last_edited_time':
      return normalizeDate(prop[prop.type]);
    
    case 'created_by':
    case 'last_edited_by':
      return prop[prop.type]?.name ?? null;
    
    default:
      return null;
  }
}

function mapToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};

  // Obtener GHL ID (puede ser fórmula o texto)
  const ghlId = getValue(p['GHL ID']);
  const cashAr = getValue(p['Cash AR']) ?? getValue(p['Cash collected AR']) ?? getValue(p['Cash collected ARS']);
  const cashCollectedArs = getValue(p['Cash collected ARS']) ?? cashAr;

  const row = {
    id: data.id,  // Notion ID como identificador principal
    ghlid: ghlId ? ghlId.toString() : null,  // GHL ID como campo separado (puede ser null)
    adname: getValue(p['Adname']),
    adset: getValue(p['Adset']),
    agenda_format: getValue(p['Agenda Format']),
    csm_2_0: getValue(p['CSM 2.0']),
    calidad: getValue(p['Calidad']),
    campaign: getValue(p['Campaign']),
    cantidad_de_pagos: getValue(p['Cantidad de pagos']),
    cash_collected: getValue(p['Cash collected']),
    cash_ar: cashAr,
    cash_collected_ar: cashAr,
    cash_collected_ars: cashCollectedArs,
    cash_collected_total: getValue(p['Cash collected Total']),
    cliente: getValue(p['Cliente']),
    cobranza_relacionada: getValue(p['Cobranza relacionada']),
    comprobante: getValue(p['Comprobante']),
    conciliacion_financiera: getValue(p['Conciliacion Financiera']),
    conciliacion_financiera_2: getValue(p['Conciliacion financiera']),
    conciliar: getValue(p['Conciliar']),
    correspondiente_format: getValue(p['Correspondiente format']),
    creado_por: getValue(p['Creado por']),
    dni_cuit: getValue(p['Dni Cuit']),
    estado: getValue(p['Estado']),
    facturacion: getValue(p['Facturacion']),
    facturacion_ars: getValue(p['Facturacion ARS']),
    facturacion_arca: getValue(p['Facturacion Arca']),
    facturar: getValue(p['Facturar']),
    fecha_correspondiente: getValue(p['Fecha correspondiente']),
    fecha_creado: getValue(p['Fecha creado']),
    fecha_de_agendamiento: getValue(p['Fecha de agendamiento']),
    fecha_facturado: getValue(p['Fecha facturado']),
    fecha_respaldo: getValue(p['Fecha respaldo']),
    finalizar: getValue(p['Finalizar']),
    info_comprobantes: getValue(p['Info Comprobantes']),
    iva: getValue(p['IVA']) ?? getValue(p['Iva']),
    mail: getValue(p['Mail']),
    medios_de_pago: getValue(p['Medios de pago']),
    modelo_de_negocio: getValue(p['Modelo de negocio']),
    monto_pesos: getValue(p['Monto Pesos']),
    monto_incobrable: toNumber(getValue(p['Monto incobrable'])),
    origen: getValue(p['Origen']),
    origen_actual: getValue(p['Origen Actual']) ?? getValue(p['Origen actual']),
    primer_origen: getValue(p['Primer origen']) ?? getValue(p['Primer Origen']),
    ultimo_origen: getValue(p['Ultimo origen']) ?? getValue(p['Último origen']) ?? getValue(p['Ultimo Origen']) ?? getValue(p['Último Origen']),
    producto_format: getValue(p['Producto Format']),
    productos: getValue(p['Productos']),
    rebotar_pago: getValue(p['Rebotar pago']),
    rectificar_pago: getValue(p['Rectificar pago']),
    responsable_actual: getValue(p['Responsable Actual']),
    responsable_venta: getValue(p['Responsable venta']),
    score: getValue(p['Score']),
    tc: getValue(p['TC']),
    telefono: getValue(p['Telefono']),
    tipo: getValue(p['Tipo']),
    tipo_banco: getValue(p['Tipo Banco']),
    comisiones: getValue(p['Comisiones']) ?? getValue(p['Comision']) ?? getValue(p['Comisión']),
    venta_relacionada: getValue(p['Venta relacionada']),
    verificacion: getValue(p['Verificacion']),
    verificacion_comisiones: getValue(p['Verificacion comisiones']),
    crear_registro_csm: getValue(p['🟢 Crear registro CSM']),
    agenda_periodo_a: getValue(p['Agenda periodo A']),
    agenda_periodo_m: getValue(p['Agenda periodo M']),
    correspondiente_periodo_m: getValue(p['Correspondiente periodo M']),
    correspondiente_periodo_a: getValue(p['Correspondiente periodo A']),
    estado_cc: getValue(p['Estado CC']),
    fecha_de_venta_format: getValue(p['Fecha de venta format']),
    llamada_meg: getValue(p['Llamada Meg']),
    cheque: getValue(p['Cheque?']),
    fecha_de_acreditacion: getValue(p['Fecha de acreditacion']),
    fecha_de_llamada: getValue(p['Fecha de llamada']),
    calendario_agendado: getValue(p['Calendario agendado']),
    venta_periodo_m: getValue(p['Venta periodo M']),
    venta_periodo_a: getValue(p['Venta periodo A']),
    neto_club: getValue(p['Neto Club']),
    medios_de_pago_format: getValue(p['Medios de pago Format']),
    setter: getValue(p['Setter']),
    f_acreditacion: getValue(p['F.acreditacion']),
    f_acreditacion_format: getValue(p['F.acreditacion format']),
    cliente_format: getValue(p['Cliente Format']),
    porcentaje_venta_vieja_format: getValue(p['% venta vieja format']),
    acreditado_periodo_m: getValue(p['Acreditado periodo M']),
    acreditado_periodo_y: getValue(p['Acreditado periodo Y']),
    porcentaje_venta_vieja: getValue(p['% venta vieja']),
    f_venta: getValue(p['F.venta']),
    f_transaccion_string: getValue(p['F.transaccion string']),
    estrategia_a: getValue(p['Estrategia a']),
    f_renovacion: getValue(p['F. renovacion']),
    f_renovacion_string: getValue(p['F. Renovacion string'])
  };

  Object.keys(row).forEach(key => {
    if (key !== 'id' && key !== 'origen_actual' && key !== 'primer_origen' && row[key] === null) {
      delete row[key];
    }
  });

  return row;
}

function extractDeletedPageId(payload) {
  if (payload?.type !== 'page.deleted') return null;
  const notionId = typeof payload?.entity?.id === 'string' ? payload.entity.id.trim() : '';
  const compactId = notionId.replace(/-/g, '');
  return /^[a-f0-9]{32}$/i.test(compactId) ? notionId : null;
}



async function deleteFromSupabase(payload) {
  const deletedPageId = extractDeletedPageId(payload);
  if (!deletedPageId) {
    const error = new Error('El evento page.deleted no incluye entity.id');
    error.statusCode = 400;
    throw error;
  }

  const notionResponse = await axios.get(
    `https://api.notion.com/v1/pages/${deletedPageId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28'
      },
      timeout: 30000
    }
  );
  if (notionResponse.data?.archived !== true && notionResponse.data?.in_trash !== true) {
    const error = new Error('Notion no confirma que la página esté archivada');
    error.statusCode = 409;
    throw error;
  }

  const response = await supabaseWithLimit(() => axios.delete(
    `${SUPABASE_URL}/rest/v1/comprobantes`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      params: { id: `eq.${deletedPageId}` }
    }
  ));

  await saveLog({
    webhook_type: 'com',
    type: 'deleted',
    message: 'Comprobante eliminado de Supabase',
    http_status: response.status,
    notion_id: deletedPageId,
    attempted_data: { id: deletedPageId },
    payload
  });
  console.log(`✅ Comprobante eliminado de Supabase: ${deletedPageId}`);
  return response;
}

async function sendToSupabase(payload) {
  if (payload?.type === 'page.deleted') {
    return deleteFromSupabase(payload);
  }

  const data = payload.data || payload;
  const p = data.properties || {};
  
  const row = mapToSupabase(payload);

  // Log simple: campos y valores que se envían a Supabase
  console.log('\n📤 Enviando a Supabase (Comprobantes) – campos y valores:');
  Object.keys(row).forEach((key) => {
    console.log(`  ${key}: ${row[key] === null || row[key] === undefined ? 'null' : row[key]}`);
  });

  if (!row.id || row.id === '') {
    const errorLog = {
      webhook_type: 'com',
      type: 'invalid_id',
      message: 'El Notion ID es null, undefined o cadena vacía',
      notion_id: data.id,
      ghl_id: getValue(p['GHL ID']),
      payload: payload
    };
    await saveLog(errorLog);
    console.error('❌ No se envía: ID inválido');
    const error = new Error(errorLog.message);
    error.statusCode = 400;
    throw error;
  }

  try {
    const startTime = Date.now();
    const response = await supabasePostWithRetry(`${SUPABASE_URL}/rest/v1/comprobantes`, row, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      params: { on_conflict: 'id' }
    });
    const duration = Date.now() - startTime;
    
    // ========== ÉXITO EN SUPABASE ==========
    const successLog = {
      webhook_type: 'com',
      type: 'success',
      message: 'Comprobante guardado exitosamente',
      http_status: response.status,
      supabase_error: { duration_ms: duration },
      notion_id: data.id,
      ghl_id: row.ghlid,
      attempted_data: row,
      payload: payload
    };

    await saveLog(successLog);
    console.log('✅ Guardado en Supabase');
  } catch (err) {
    const errorLog = {
      webhook_type: 'com',
      type: 'supabase_error',
      message: err.message,
      http_status: err.response?.status,
      supabase_error: err.response?.data || {},
      notion_id: data.id,
      ghl_id: row.ghlid,
      attempted_data: row,
      payload: payload
    };
    await saveLog(errorLog);
    console.error('❌ Error Supabase:', err.response?.status, err.response?.data || err.message);
    throw err;
  }
}

function enqueueGoogleSheets(payload) {
  sheetsQueue = sheetsQueue.then(async () => {
    try {
      console.log("⏳ Procesando Sheets (Comprobantes)...");
      await axios.post(googleScriptUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: GOOGLE_SHEETS_TIMEOUT_MS
      });
      console.log("✅ Google Sheets procesado exitosamente");
    } catch (error) {
      console.error("❌ Error al procesar Google Sheets:", error.message);
      await saveLog({
        webhook_type: 'com',
        type: 'google_sheets_error',
        message: error.message,
        payload
      });
    }
  });

  return sheetsQueue;
}

// Helper: delay
function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

// Supabase POST con retries, backoff exponencial y spacing (usa supabaseWithLimit internamente)
async function supabasePostWithRetry(url, body, config = {}) {
  const MAX_RETRIES = parseInt(process.env.SUPABASE_MAX_RETRIES || '3', 10);
  const BASE_BACKOFF = parseInt(process.env.SUPABASE_BASE_BACKOFF_MS || '500', 10); // ms
  const SPACING_MS = parseInt(process.env.SUPABASE_SPACING_MS || '1000', 10); // ms entre requests para evitar picos

  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await supabaseWithLimit(() => axios.post(url, body, config));
      if (SPACING_MS > 0) await delay(SPACING_MS);
      return res;
    } catch (err) {
      lastErr = err;
      const jitter = Math.floor(Math.random() * 1000);
      const wait = Math.min(60000, BASE_BACKOFF * Math.pow(2, attempt - 1) + jitter);
      console.warn(`⚠️ Supabase POST fallo en intento ${attempt}/${MAX_RETRIES} - esperando ${wait}ms antes de reintentar`);
      try { await saveLog({ webhook_type: 'comprobantes', type: 'supabase_retry', message: `Retry ${attempt}`, notion_id: body?.id || null, supabase_error: err.response?.data || err.message }); } catch(e) {}
      if (attempt === MAX_RETRIES) break;
      await delay(wait);
    }
  }
  throw lastErr;
}

// Simple concurrency limiter para llamadas a Supabase
const MAX_SUPABASE_CONCURRENCY = 5;
let _currentSupabaseConcurrency = 0;
async function supabaseWithLimit(fn) {
  while (_currentSupabaseConcurrency >= MAX_SUPABASE_CONCURRENCY) {
    await new Promise(r => setTimeout(r, 100));
  }
  _currentSupabaseConcurrency++;
  try {
    return await fn();
  } finally {
    _currentSupabaseConcurrency--;
  }
}

exports.handleWebhook = async (req, res) => {
  try {
    console.log('📥 Webhook recibido (Comprobantes)');
    const payload = req.body;

    const isValidPayload =
      (payload.data && payload.data.object === 'page') ||
      (payload.type === 'page.deleted' && payload.entity);

    if (!isValidPayload) {
      console.warn('⚠️ Payload no válido');
      const errorLog = {
        webhook_type: 'com',
        type: 'invalid_payload',
        message: 'Payload no válido - no es un evento reconocido',
        payload: payload
      };
      await saveLog(errorLog);
      return res.status(400).json({ error: 'Payload inválido', received: payload.type || 'unknown' });
    }

    try {
      console.log('⏳ Procesando Supabase (Comprobantes)...');
      await sendToSupabase(payload);
    } catch (error) {
      console.error('❌ Error al procesar Supabase:', error.message);
      await saveLog({
        webhook_type: 'com',
        type: 'supabase_process_error',
        message: error.message,
        payload
      });
      const statusCode = Number(error.statusCode || error.response?.status || 502);
      return res.status(statusCode >= 400 && statusCode < 500 ? statusCode : 502).json({
        error: 'No pude persistir el webhook de comprobantes',
        message: error.message
      });
    }

    // Sheets conserva su propia cola y no demora la confirmación de la réplica crítica.
    enqueueGoogleSheets(payload);
    return res.status(200).json({
      status: 'ok',
      message: 'Webhook de comprobantes persistido en Supabase',
      receivedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Error en handler de Comprobantes:', err.message);
    return res.status(500).json({ error: 'Error interno en el handler de Comprobantes' });
  }
};

exports.getValue = getValue;
exports.mapToSupabase = mapToSupabase;
exports.extractDeletedPageId = extractDeletedPageId;
exports.deleteFromSupabase = deleteFromSupabase;
