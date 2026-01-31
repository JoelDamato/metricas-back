const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbxnx8V4TnlotjWAI8Nh06nfXGLRuDNfq3toEC-m2mfOpCCiOvIf0zaos_eMCwpAvC0A/exec";

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

// Función para guardar logs en Supabase (safe stringify y created_at Argentina)
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

async function saveLog(logData) {
  try {
    const processedData = { ...logData };

    // Asegurar que payload, attempted_data y supabase_error sean strings (manejar objetos grandes o circulares)
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

    // Establecer created_at con la hora actual de Argentina (UTC-3) si no se proporciona
    if (!Object.prototype.hasOwnProperty.call(processedData, 'created_at')) {
      const now = new Date();
      const argentinaNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000) - (3 * 60 * 60 * 1000));
      processedData.created_at = argentinaNow.toISOString().replace(/\.\d{3}Z$/, 'Z');
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

function mapToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};

  // Helper universal que detecta el tipo de propiedad automáticamente
  const getValue = (prop) => {
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
  };

  // Obtener GHL ID (puede ser fórmula o texto)
  const ghlId = getValue(p['GHL ID']);

  return {
    id: data.id,  // Notion ID como identificador principal
    ghlid: ghlId ? ghlId.toString() : null,  // GHL ID como campo separado (puede ser null)
    nombre: getValue(p['Nombre']),
    acceso: getValue(p['Acceso']),
    actividad: getValue(p['Actividad']),
    bienvenida: getValue(p['Bienvenida']),
    cant_prod: getValue(p['Cant prod']),
    cashflow: getValue(p['Cashflow']),
    closer: getValue(p['Closer']),
    contrato: getValue(p['Contrato']),
    costos_1: getValue(p['Costos 1']),
    costos_2: getValue(p['Costos 2']),
    crm_2_0: getValue(p['Crm 2.0']),
    dispo_acceso: getValue(p['Dispo Acceso']),
    eerr_economico: getValue(p['EERR Economico']),
    eerr_financiero: getValue(p['EERR Financiero']),
    f_onboarding: getValue(p['F.Onboarding']),
    fecha_final: getValue(p['Fecha final']),
    formulario: getValue(p['Formulario']),
    mail: getValue(p['Mail']),
    modulo_1: getValue(p['Modulo 1']),
    modulo_10: getValue(p['Modulo 10']),
    modulo_2: getValue(p['Modulo 2']),
    modulo_3: getValue(p['Modulo 3']),
    modulo_4: getValue(p['Modulo 4']),
    modulo_5: getValue(p['Modulo 5']),
    modulo_6: getValue(p['Modulo 6']),
    modulo_7: getValue(p['Modulo 7']),
    modulo_8: getValue(p['Modulo 8']),
    modulo_9: getValue(p['Modulo 9']),
    onboarding: getValue(p['Onboarding']),
    pausa: getValue(p['Pausa']),
    productos_adquiridos: getValue(p['Productos adquiridos']),
    progreso_curso: getValue(p['Progreso curso']),
    proximo_contacto_csm: getValue(p['Proximo Contacto CSM']),
    telefono: getValue(p['Telefono']),
    ultima_fecha_de_avance: getValue(p['Ultima fecha de avance']),
    ultima_respuesta: getValue(p['Ultima respuesta']),
    ultimo_producto_adquirido: getValue(p['Ultimo producto Adquirido']),
    fecha_de_agendamiento: getValue(p['Fecha de agendamiento']),
    fecha_de_agendamiento_format: getValue(p['Fecha de agendamiento format']),
    agenda_periodo_m: getValue(p['Agenda periodo M']),
    agenda_periodo_a: getValue(p['Agenda periodo A']),
    modulo_1_format: getValue(p['Modulo 1 - Format']),
    modulo_2_format: getValue(p['Modulo 2 - Format']),
    modulo_3_format: getValue(p['Modulo 3 - Format']),
    modulo_4_format: getValue(p['Modulo 4 - Format']),
    modulo_5_format: getValue(p['Modulo 5 - Format']),
    modulo_6_format: getValue(p['Modulo 6 - Format']),
    modulo_7_format: getValue(p['Modulo 7 - Format']),
    modulo_8_format: getValue(p['Modulo 8 - Format']),
    modulo_9_format: getValue(p['Modulo 9 - Format']),
    modulo_10_format: getValue(p['Modulo 10 - Format']),
    f_onboarding_format: getValue(p['F.Onboarding - Format']),
    f_costos_1: getValue(p['F Costos 1']),
    f_costos_2: getValue(p['F Costos 2']),
    f_eerr_economico: getValue(p['F EERR Economico']),
    f_eerr_financiero: getValue(p['F EERR Financiero']),
    f_cashflow: getValue(p['F Cashflow']),
    f_traffiker: getValue(p['F Traffiker']),
    f_coaching: getValue(p['F Coaching']),
    costos_1_format: getValue(p['Costos 1 - Format']),
    costos_2_format: getValue(p['Costos 2 - Format']),
    eerr_eco_format: getValue(p['EERR Eco - Format']),
    eerr_fin_format: getValue(p['EERR Fin - Format']),
    cashflow_format: getValue(p['Cashflow - Format']),
    coaching_format: getValue(p['Coaching - Format']),
    traffiker_format: getValue(p['Traffiker - Format']),
    despedida: getValue(p['Despedida']),
    caso_de_exito: getValue(p['Caso de exito']),
    fecha_final_renovacion: getValue(p['Fecha final renovacion'])
  };
}

async function sendToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};
  
  // Helper universal que detecta el tipo de propiedad automáticamente
  const getValue = (prop) => {
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
  };
  
  // Helper para mostrar datos de forma legible
  const logSection = (title, data) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ${title}`);
    console.log('='.repeat(60));
    if (typeof data === 'object' && data !== null) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(data);
    }
  };
  
  // ========== DATOS QUE LLEGAN DE NOTION ==========
  logSection('DATOS QUE LLEGAN DE NOTION (CSM)', {
    'ID de Notion (PRINCIPAL)': data.id,
    'GHL ID (raw)': p['GHL ID'],
    'GHL ID (extraído)': getValue(p['GHL ID']),
    'Nombre': getValue(p['Nombre']),
    'Mail': getValue(p['Mail']),
    'Todas las propiedades disponibles': Object.keys(p).sort(),
  });
  
  // Mostrar propiedades importantes de forma individual
  console.log('\n📋 PROPIEDADES IMPORTANTES DE CSM:');
  const importantProps = ['GHL ID', 'Nombre', 'Mail', 'Telefono', 'Onboarding', 'Progreso curso'];
  importantProps.forEach(propName => {
    const prop = p[propName];
    if (prop) {
      console.log(`\n  🔹 ${propName}:`);
      console.log(`     Tipo: ${prop.type || 'N/A'}`);
      console.log(`     Valor extraído: ${getValue(prop) ?? 'null'}`);
      console.log(`     Valor completo:`, JSON.stringify(prop, null, 4));
    } else {
      console.log(`\n  🔹 ${propName}: NO EXISTE en las propiedades`);
    }
  });
  
  const row = mapToSupabase(payload);
  
  // ========== DATOS MAPEADOS PARA SUPABASE ==========
  logSection('DATOS MAPEADOS PARA SUPABASE (CSM)', row);
  
  // Validar que el Notion ID sea válido antes de enviar
  if (!row.id || row.id === '') {
    const errorLog = {
      webhook_type: 'csm',
      type: 'invalid_id',
      message: 'El Notion ID es null, undefined o cadena vacía',
      notion_id: data.id,
      ghl_id: getValue(p['GHL ID']),
      payload: payload
    };
    
    await saveLog(errorLog);
    
    logSection('❌ ERROR: NOTION ID INVÁLIDO - NO SE ENVIARÁ A SUPABASE', {
      'Notion ID recibido': data.id,
      'GHL ID recibido': getValue(p['GHL ID']),
      'Motivo': 'El Notion ID es null, undefined o cadena vacía'
    });
    return;
  }
  
  // ========== INTENTANDO GUARDAR EN SUPABASE ==========
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 INTENTANDO GUARDAR EN SUPABASE (CSM)`);
  console.log('='.repeat(60));
  console.log(`📤 URL: ${SUPABASE_URL}/rest/v1/csm`);
  console.log(`📤 Notion ID (PRIMARY KEY): ${row.id}`);
  console.log(`📤 GHL ID: ${row.ghlid || 'null'}`);
  console.log(`📤 Nombre: ${row.nombre || 'Sin nombre'}`);
  console.log(`📤 Total de campos: ${Object.keys(row).length}`);

  try {
    const startTime = Date.now();
    const response = await supabasePostWithRetry(`${SUPABASE_URL}/rest/v1/csm`, row, {
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
      webhook_type: 'csm',
      type: 'success',
      message: 'Registro guardado exitosamente',
      notion_id: data.id,
      ghl_id: row.ghlid,
      http_status: response.status,
      supabase_error: { duration_ms: duration }
    };
    
    await saveLog(successLog);
    
    logSection('✅ ÉXITO: REGISTRO CSM GUARDADO EN SUPABASE', {
      'Status HTTP': response.status,
      'Tiempo de respuesta': `${duration}ms`,
      'Notion ID guardado': row.id,
      'GHL ID guardado': row.ghlid || 'null',
      'Respuesta de Supabase': response.data,
      'Headers de respuesta': response.headers
    });
    
  } catch (err) {
    // ========== ERROR AL GUARDAR EN SUPABASE ==========
    const errorLog = {
      webhook_type: 'csm',
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
    
    logSection('❌ ERROR AL GUARDAR CSM EN SUPABASE', {
      'Mensaje de error': err.message,
      'Código de estado HTTP': err.response?.status,
      'Datos del error': err.response?.data,
      'URL intentada': `${SUPABASE_URL}/rest/v1/csm`,
      'Notion ID que intentamos guardar': row.id,
      'GHL ID': row.ghlid || 'null',
      'Datos que intentamos enviar': row
    });
    
    if (err.response?.data) {
      console.log('\n📋 DETALLES DEL ERROR DE SUPABASE:');
      console.log(JSON.stringify(err.response.data, null, 2));
    }
    
    if (err.response?.status === 400) {
      console.log('\n⚠️  Posible causa: Datos inválidos o formato incorrecto');
    } else if (err.response?.status === 401 || err.response?.status === 403) {
      console.log('\n⚠️  Posible causa: Problema de autenticación con Supabase');
    } else if (err.response?.status === 409) {
      console.log('\n⚠️  Posible causa: Conflicto con registro existente');
    } else if (err.response?.status === 500) {
      console.log('\n⚠️  Posible causa: Error del servidor de Supabase');
    }
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
      if (SPACING_MS > 0) await delay(SPACING_MS);
      return res;
    } catch (err) {
      lastErr = err;
      const jitter = Math.floor(Math.random() * 1000);
      const wait = Math.min(60000, BASE_BACKOFF * Math.pow(2, attempt - 1) + jitter);
      console.warn(`⚠️ Supabase POST fallo en intento ${attempt}/${MAX_RETRIES} - esperando ${wait}ms antes de reintentar`);
      try { await saveLog({ webhook_type: 'csm', type: 'supabase_retry', message: `Retry ${attempt}`, notion_id: body?.id || null, supabase_error: err.response?.data || err.message }); } catch(e) {}
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
  try { return await fn(); } finally { _currentSupabaseConcurrency--; }
}

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const { payload } = queue.shift();
  try {
    console.log("⏳ Procesando Sheets (CSM)...");
    await axios.post(googleScriptUrl, payload, { 
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    console.log("⏳ Procesando Supabase (CSM)...");
    await sendToSupabase(payload);
  } catch (error) {
    console.error("❌ Error en flujo de CSM:", error.message);
    
    // Log de error general en el flujo
    const errorLog = {
      webhook_type: 'csm',
      type: 'process_queue_error',
      message: error.message,
      payload: payload
    };
    
    await saveLog(errorLog);
  } finally {
    isProcessing = false;
    if (queue.length > 0) setImmediate(processQueue);
  }
}

exports.handleWebhook = async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("📥 WEBHOOK RECIBIDO (CSM)");
    console.log("=".repeat(60));
    console.log("⏰ Timestamp:", new Date().toISOString());

    // Log temprano para verificar que el payload llegó al controlador
    const receivedBody = req.body;
    const size = (() => { try { return JSON.stringify(receivedBody).length; } catch(e) { return 'N/A'; }})();
    console.log("📦 Tamaño del payload recibido por CSM:", size);
    try {
      const preview = JSON.stringify(receivedBody).slice(0, 2000);
      console.log("📥 Payload preview (primeros 2000 chars):", preview);
    } catch (e) {
      console.log("📥 No se pudo stringificar el payload para preview:", e.message);
    }

    const payload = req.body;
    const data = payload.data || payload;
    const p = data?.properties || {};

    console.log("🆔 Notion ID (PRIMARY KEY):", data?.id || 'No disponible');
    console.log("📝 Nombre:", p['Nombre']?.rich_text?.[0]?.plain_text || p['Nombre']?.title?.[0]?.plain_text || 'No disponible');
    console.log("📧 Mail:", p['Mail']?.email || 'No disponible');

    // Validar payload
    const isValidPayload = 
      (payload.data && payload.data.object === 'page') ||
      (payload.type === 'page.deleted' && payload.entity);

    if (!isValidPayload) {
      console.warn("⚠️ Payload NO VÁLIDO - no es un evento reconocido");

      // Log de payload inválido
      const errorLog = {
        webhook_type: 'csm',
        type: 'invalid_payload',
        message: 'Payload no válido - no es un evento reconocido',
        payload: payload
      };

      await saveLog(errorLog);

      return res.status(400).json({ 
        error: "Payload inválido",
        received: payload.type || 'unknown'
      });
    }

    console.log("\n📋 Payload completo (JSON):");
    try {
      console.log(JSON.stringify(req.body, null, 2));
    } catch(e) {
      console.log('No se pudo mostrar payload completo:', e.message);
    }

    res.status(200).json({ 
      status: "ok",
      message: "Webhook de CSM recibido y encolado",
      receivedAt: new Date().toISOString()
    });

    try {
      queue.push({ payload: req.body });
      processQueue();
    } catch (err) {
      console.error('❌ Error al encolar payload en CSM:', err.message);
      const errorLog = {
        webhook_type: 'csm',
        type: 'enqueue_error',
        message: err.message,
        payload: req.body,
        created_at: (new Date()).toISOString()
      };
      await saveLog(errorLog);
    }
  } catch (err) {
    console.error('❌ Error en handler CSM:', err.message);
    return res.status(500).json({ error: 'Error interno en el handler CSM' });
  }
};