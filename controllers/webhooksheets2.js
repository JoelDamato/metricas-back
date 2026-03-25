const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// URL de tu App Script desplegado como endpoint web

const googleScriptUrl = "https://script.google.com/macros/s/AKfycbzbjJ8jT6XYDbwls0zWcCJzaerciuqsII9KU9oWXY8t5tVfXz-vZ9DNuqoSFYB2J4jmFg/exec";

// Cola en memoria para los envíos
const queue = [];
let isProcessing = false;

// Función para normalizar fechas: resta 3 horas y devuelve ISO con hora
function normalizeDate(dateValue) {
  if (!dateValue) return null;
  if (dateValue === null || dateValue === undefined) return null;
  if (typeof dateValue === 'string' && dateValue.trim() === '') return null;
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return null;
    const adjusted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return adjusted.toISOString().replace(/\.\d{3}Z$/, 'Z');
  } catch (error) {
    console.warn('⚠️ Error normalizando fecha:', dateValue, error.message);
    return null;
  }
}

// Helper para hora actual de Argentina (UTC-3) en ISO sin milisegundos
function argentinaNowISO() {
  const now = new Date();
  const argentinaNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000) - (3 * 60 * 60 * 1000));
  return argentinaNow.toISOString().replace(/\.\d{3}Z$/, 'Z');
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

    // Establecer created_at con la hora actual de Argentina si no se proporciona
    if (!Object.prototype.hasOwnProperty.call(processedData, 'created_at')) {
      processedData.created_at = argentinaNowISO();
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
      return prop.people?.[0]?.name ?? null;
    
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

// Helper para extraer texto de Notion (Rich Text o Title)
const getText = (prop) => prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || null;

function mapToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};

  // Obtener GHL ID (puede ser fórmula o texto)
  const ghlId = getValue(p['GHL ID']);

  return {
    id: data.id,  // Notion ID como identificador principal
    ghlid: ghlId ? ghlId.toString() : null,  // GHL ID como campo separado (puede ser null)
    created_time: normalizeDate(data.created_time),
    last_edited_time: normalizeDate(data.last_edited_time),
    archived: data.archived ?? false,

    // Identidad
    nombre: getText(p['Nombre']),
    dni: getValue(p['Dni']),
    mail: getValue(p['Mail']),
    telefono: getValue(p['Telefono']),
    whatsapp: getValue(p['WhatsApp']),
    cc_whatsapp: getValue(p['CC WP']) ?? getValue(p['cc_whatsapp']),
    instagram: getValue(p['Instagram']),
    usuario_ig: getValue(p['Usuario IG']),

    // Clasificación
    origen: getValue(p['Origen']),
    primer_origen: getValue(p['Primer origen']),
    etapa: getValue(p['Etapa']),
    temperatura: getValue(p['Temperatura']),
    calidad_lead: getValue(p['Calidad del lead']),
    modelo_negocio: getValue(p['Modelo de negocio']),

    // Marketing
    utm_source: getValue(p['Utm_source']),
    utm_medium: getValue(p['Utm_medium']),
    utm_campaign: getValue(p['Utm_campaign']),
    utm_content: getValue(p['Utm_content']),
    utm_term: getValue(p['Utm_term']),
    adname: getValue(p['Adname']),
    adset: getValue(p['Adset']),
    campaign: getValue(p['Campaign']),
    estrategia_a: getText(p['Estrategia apertura']),

    // Responsables
    responsable: getValue(p['Responsable']),
    responsable_id: getValue(p['ID responsable']),
    setter: getValue(p['Setter']),
    closer: getValue(p['Closer']),

    aplica: getValue(p['Aplica']),
    lista_negra: getValue(p['Lista negra']),
    recuperado: getValue(p['Recuperado']),
    cliente_viejo: getValue(p['Cliente viejo']),
    agendo: getValue(p['Agendo']),
    respondio_apertura: getValue(p['Respondio apertura']),
    confirmo_mensaje: getValue(p['Confirmo mensaje']),
    llamada_meg: getValue(p['Llamada MEG']),
    // Nuevos campos: Call confirm y Llamada CC
    call_confirm: getValue(p['Call confirm']),
    llamada_cc: getValue(p['Llamada CC']),
    // Último producto adquirido (campo u_product_adquirido en Supabase)
    u_product_adquirido: getValue(p['Ultimo producto adquirido']),
    // Fecha de venta MEG (timestamp)
    f_venta_meg: getValue(p['F.venta MEG']),

    // Números
    facturacion: getValue(p['Facturacion']),
    facturacion_total: getValue(p['Facturacion total']),
    cash_collected_total: getValue(p['Cash collected total']),
    saldo: getValue(p['Saldo']),
    inversion: getValue(p['Inversion']),
    score: getValue(p['Score']),
    // Monto incobrable (número)
    monto_incobrable: toNumber(getValue(p['Monto incobrable'])),

    // Fechas
    fecha_llamada: getValue(p['Fecha de llamada']),
    fecha_agenda: getValue(p['Fecha de agendamiento']),
    fecha_venta: getValue(p['Ult fecha de venta']),
    fecha_cancelada: getValue(p['Fecha cancelada']),
    fecha_rt: getValue(p['Fecha RT']),

    // Otros campos de tracking / marketing
    nuevo_seguidor: getValue(p['Nuevo Seguidor']),
    recurso_ig: getValue(p['Recurso IG']),
    calendario_agendado: getValue(p['Calendario agendado']),
    producto_de_interes: getValue(p['Producto de interes']),
    embudo_meg: getValue(p['Embudo MEG']),
    embudo_club: getValue(p['Embudo CLUB']),
    producto_adq: getValue(p['Producto adquirido']),
    seguimiento_setting: getValue(p['Seguimiento Setting']),
    fecha_creada: getValue(p['Fecha creada']),

    // Nuevos campos de recursos (Notion -> Supabase)
    primero_recurso: getValue(p['Primero recurso']),
    ultimo_recurso: getValue(p['Ultimo recurso']),
    cantidad_recursos: getValue(p['Cantidad de recursos']),
    formato_fuente: getValue(p['Formato contenido fuente']),
    recurso_tt: getValue(p['Recurso TT'])
  };
}

// Helper para convertir valores a número o null
function toNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

async function sendToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};
  
  const row = mapToSupabase(payload);

  // Log simple: campos y valores que se envían a Supabase
  console.log('\n📤 Enviando a Supabase (CRM) – campos y valores:');
  Object.keys(row).forEach((key) => {
    console.log(`  ${key}: ${row[key] === null || row[key] === undefined ? 'null' : row[key]}`);
  });

  if (!row.id || row.id === '') {
    const errorLog = {
      webhook_type: 'CRM',
      type: 'invalid_id',
      message: 'El Notion ID es null, undefined o cadena vacía',
      notion_id: data.id,
      ghl_id: getValue(p['GHL ID']),
      payload: payload
    };
    await saveLog(errorLog);
    console.error('❌ No se envía: ID inválido');
    return;
  }

  try {
    const startTime = Date.now();
    const response = await supabasePostWithRetry(`${SUPABASE_URL}/rest/v1/leads_raw`, row, {
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
      webhook_type: 'CRM',
      type: 'success',
      message: 'Registro guardado exitosamente',
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
      webhook_type: 'CRM',
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
  }
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
      // dejar un breve espacio después del éxito para alivianar la carga
      if (SPACING_MS > 0) await delay(SPACING_MS);
      return res;
    } catch (err) {
      lastErr = err;
      const jitter = Math.floor(Math.random() * 1000);
      const wait = Math.min(60000, BASE_BACKOFF * Math.pow(2, attempt - 1) + jitter);
      console.warn(`⚠️ Supabase POST fallo en intento ${attempt}/${MAX_RETRIES} - esperando ${wait}ms antes de reintentar`);
      try {
        await saveLog({ webhook_type: 'CRM', type: 'supabase_retry', message: `Retry ${attempt}`, notion_id: body?.id || null, supabase_error: err.response?.data || err.message });
      } catch(e) {}
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

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const { payload } = queue.shift();
  
  // Procesar Google Sheets (no bloqueante)
  try {
    console.log("⏳ Procesando Sheets...");
    await axios.post(googleScriptUrl, payload, { 
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    console.log("✅ Google Sheets procesado exitosamente");
  } catch (error) {
    console.error("❌ Error al procesar Google Sheets:", error.message);
    console.error("⚠️  Continuando con Supabase de todos modos...");
    
    // Log del error de Sheets
    await saveLog({
      webhook_type: 'CRM',
      type: 'google_sheets_error',
      message: error.message,
      http_status: error.response?.status,
      payload: payload
    });
  }
  
  // Procesar Supabase (independiente de Sheets)
  try {
    console.log("⏳ Procesando Supabase...");
    await sendToSupabase(payload);
  } catch (error) {
    console.error("❌ Error al procesar Supabase:", error.message);
    
    // Log del error de Supabase
    await saveLog({
      webhook_type: 'CRM',
      type: 'supabase_process_error',
      message: error.message,
      payload: payload
    });
  }
  
  isProcessing = false;
  if (queue.length > 0) setImmediate(processQueue);
}

exports.handleWebhook = async (req, res) => {
  try {
    console.log('📥 Webhook recibido (CRM)');
    const payload = req.body;
    const data = payload.data || payload;

    const isValidPayload =
      (payload.data && payload.data.object === 'page') ||
      (payload.type === 'page.deleted' && payload.entity);

    if (!isValidPayload) {
      console.warn('⚠️ Payload no válido');
      const errorLog = {
        webhook_type: 'CRM',
        type: 'invalid_payload',
        message: 'Payload no válido - no es un evento reconocido',
        payload: payload
      };
      await saveLog(errorLog);
      return res.status(400).json({ error: 'Payload inválido', received: payload.type || 'unknown' });
    }

    res.status(200).json({ 
      status: "ok",
      message: "Webhook de CRM recibido y encolado",
      receivedAt: new Date().toISOString()
    });
    
    try {
      queue.push({ payload: req.body });
      processQueue();
    } catch (err) {
      console.error('❌ Error al encolar payload:', err.message);
      const errorLog = {
        webhook_type: 'CRM',
        type: 'enqueue_error',
        message: err.message,
        payload: req.body
      };
      await saveLog(errorLog);
    }
  } catch (err) {
    console.error('❌ Error en handler CRM:', err.message);
    return res.status(500).json({ error: 'Error interno en el handler CRM' });
  }
};
