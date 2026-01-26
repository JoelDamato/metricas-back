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

function mapToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};

  // Obtener GHL ID (puede ser fórmula o texto)
  const ghlId = getValue(p['GHL ID']);
  const finalId = (ghlId && ghlId.toString().trim() !== '') ? ghlId.toString() : data.id;

  return {
    id: finalId,
    created_time: normalizeDate(data.created_time),
    last_edited_time: normalizeDate(data.last_edited_time),
    archived: data.archived ?? false,

    // Identidad
    nombre: getValue(p['Nombre']),
    dni: getValue(p['Dni']),
    mail: getValue(p['Mail']),
    telefono: getValue(p['Telefono']),
    whatsapp: getValue(p['WhatsApp']),
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

    // Números
    facturacion: getValue(p['Facturacion']),
    facturacion_total: getValue(p['Facturacion total']),
    cash_collected_total: getValue(p['Cash collected total']),
    saldo: getValue(p['Saldo']),
    inversion: getValue(p['Inversion']),
    score: getValue(p['Score']),

    // Fechas
    fecha_llamada: getValue(p['Fecha de llamada']),
    fecha_agenda: getValue(p['Fecha de agendamiento']),
    fecha_venta: getValue(p['Ult fecha de venta'])
  };
}

async function sendToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};
  
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
  logSection('DATOS QUE LLEGAN DE NOTION (CRM)', {
    'ID de Notion': data.id,
    'Nombre del Lead': getValue(p['Nombre']),
    'GHL ID (raw)': p['GHL ID'],
    'GHL ID (extraído)': getValue(p['GHL ID']),
    'Todas las propiedades disponibles': Object.keys(p).sort(),
  });
  
  // Mostrar propiedades importantes de forma individual
  console.log('\n📋 PROPIEDADES IMPORTANTES DE NOTION:');
  const importantProps = ['GHL ID', 'Aplica', 'Agendo', 'Respondio apertura', 'Confirmo mensaje', 'Llamada MEG'];
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
  logSection('DATOS MAPEADOS PARA SUPABASE', row);
  
  // Validar que el ID sea válido antes de enviar
  if (!row.id || row.id === '') {
    const errorLog = {
      webhook_type: 'CRM',
      type: 'invalid_id',
      message: 'El ID es null, undefined o cadena vacía',
      notion_id: data.id,
      ghl_id: getValue(p['GHL ID']),
      payload: payload
    };
    
    await saveLog(errorLog);
    
    logSection('❌ ERROR: ID INVÁLIDO - NO SE ENVIARÁ A SUPABASE', {
      'GHL ID recibido': getValue(p['GHL ID']),
      'ID de Notion': data.id,
      'ID final calculado': row.id,
      'Motivo': 'El ID es null, undefined o cadena vacía'
    });
    return;
  }
  
  // ========== INTENTANDO GUARDAR EN SUPABASE ==========
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 INTENTANDO GUARDAR EN SUPABASE`);
  console.log('='.repeat(60));
  console.log(`📤 URL: ${SUPABASE_URL}/rest/v1/leads_raw`);
  console.log(`📤 ID del registro: ${row.id}`);
  console.log(`📤 Nombre: ${row.nombre || 'Sin nombre'}`);
  console.log(`📤 Total de campos: ${Object.keys(row).length}`);

  try {
    const startTime = Date.now();
    const response = await axios.post(`${SUPABASE_URL}/rest/v1/leads_raw`, row, {
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
      ghl_id: row.id,
      attempted_data: row,
      payload: payload
    };
    
    await saveLog(successLog);
    
    logSection('✅ ÉXITO: REGISTRO GUARDADO EN SUPABASE', {
      'Status HTTP': response.status,
      'Tiempo de respuesta': `${duration}ms`,
      'ID guardado': row.id,
      'Respuesta de Supabase': response.data,
      'Headers de respuesta': response.headers
    });
    
  } catch (err) {
    // ========== ERROR AL GUARDAR EN SUPABASE ==========
    const errorLog = {
      webhook_type: 'CRM',
      type: 'supabase_error',
      message: err.message,
      http_status: err.response?.status,
      supabase_error: err.response?.data || {},
      notion_id: data.id,
      ghl_id: row.id,
      attempted_data: row,
      payload: payload
    };
    
    await saveLog(errorLog);
    
    logSection('❌ ERROR AL GUARDAR EN SUPABASE', {
      'Mensaje de error': err.message,
      'Código de estado HTTP': err.response?.status,
      'Datos del error': err.response?.data,
      'URL intentada': `${SUPABASE_URL}/rest/v1/leads_raw`,
      'ID que intentamos guardar': row.id,
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
    console.log("\n" + "=".repeat(60));
    console.log("📥 WEBHOOK RECIBIDO (CRM)");
    console.log("=".repeat(60));
    console.log("⏰ Timestamp:", new Date().toISOString());
    
    // Log temprano para verificar que el payload llegó
    const receivedBody = req.body;
    const size = (() => { try { return JSON.stringify(receivedBody).length; } catch(e) { return 'N/A'; }})();
    console.log("📦 Tamaño del payload recibido:", size);
    
    const payload = req.body;
    const data = payload.data || payload;
    const p = data?.properties || {};
    
    console.log("🆔 ID de Notion:", data?.id || 'No disponible');
    console.log("📝 Nombre del lead:", getValue(p['Nombre']) || 'No disponible');
    
    // Validar payload
    const isValidPayload = 
      (payload.data && payload.data.object === 'page') ||
      (payload.type === 'page.deleted' && payload.entity);

    if (!isValidPayload) {
      console.warn("⚠️ Payload NO VÁLIDO - no es un evento reconocido");

      const errorLog = {
        webhook_type: 'CRM',
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