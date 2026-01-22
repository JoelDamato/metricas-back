const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbzbjJ8jT6XYDbwls0zWcCJzaerciuqsII9KU9oWXY8t5tVfXz-vZ9DNuqoSFYB2J4jmFg/exec";

const queue = [];
let isProcessing = false;

// Función para guardar logs en Supabase
async function saveLog(logData) {
  try {
    await axios.post(`${SUPABASE_URL}/rest/v1/webhook_logs`, logData, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('📝 Log guardado en Supabase');
  } catch (err) {
    console.error('❌ Error al guardar log:', err.message);
  }
}

function mapToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};

  // Helper para extraer texto de Notion (Rich Text o Title)
  const getText = (prop) => prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || null;
  
  // Helper para buscar propiedad con variaciones de nombre (case-insensitive, espacios)
  const findProperty = (name) => {
    const keys = Object.keys(p);
    const exact = keys.find(k => k === name);
    if (exact) return p[exact];
    const lower = keys.find(k => k.toLowerCase() === name.toLowerCase());
    if (lower) return p[lower];
    return null;
  };

  // Obtener GHL ID, si está vacío o null usar el ID de Notion
  const ghlId = getText(p['GHL ID']);
  const finalId = (ghlId && ghlId.trim() !== '') ? ghlId : data.id;

  return {
    id: finalId,
    created_time: data.created_time,
    last_edited_time: data.last_edited_time,
    archived: data.archived ?? false,

    // Identidad
    nombre: getText(p['Nombre']),
    dni: getText(p['Dni']),
    mail: p['Mail']?.email ?? null,
    telefono: p['Telefono']?.phone_number ?? null,
    whatsapp: p['WhatsApp']?.phone_number ?? null,
    instagram: p['Instagram']?.url ?? null,
    usuario_ig: getText(p['Usuario IG']),

    // Clasificación
    origen: p['Origen']?.select?.name ?? null,
    primer_origen: p['Primer origen']?.select?.name ?? null,
    etapa: p['Etapa']?.select?.name ?? null,
    temperatura: p['Temperatura']?.select?.name ?? null,
    calidad_lead: p['Calidad del lead']?.select?.name ?? null,
    modelo_negocio: p['Modelo de negocio']?.select?.name ?? null,

    // Marketing
    utm_source: getText(p['Utm_source']),
    utm_medium: getText(p['Utm_medium']),
    utm_campaign: getText(p['Utm_campaign']),
    utm_content: getText(p['Utm_content']),
    utm_term: getText(p['Utm_term']),
    adname: getText(p['Adname']),
    adset: getText(p['Adset']),
    campaign: getText(p['Campaign']),

    // Responsables
    responsable: p['Responsable']?.people?.[0]?.name ?? null,
    responsable_id: getText(p['ID responsable']),
    setter: p['Setter']?.select?.name ?? null,
    closer: p['Closer']?.select?.name ?? null,

    aplica: p['Aplica']?.select?.name ?? null,
    lista_negra: getText(p['Lista negra']),
    recuperado: getText(p['Recuperado']),
    cliente_viejo: getText(p['Cliente viejo']),
    agendo: p['Agendo']?.select?.name ?? null,
    respondio_apertura: p['Respondio apertura']?.select?.name ?? null,
    confirmo_mensaje: p['Confirmo mensaje']?.select?.name ?? null,
    llamada_meg: p['Llamada MEG']?.select?.name ?? null,

    // Números
    facturacion: p['Facturacion']?.number ?? null,
    facturacion_total: p['Facturacion total']?.number ?? null,
    cash_collected_total: p['Cash collected total']?.number ?? null,
    saldo: p['Saldo']?.number ?? null,
    inversion: p['Inversion']?.number ?? null,
    score: p['Score']?.number ?? null,

    // Fechas (Mantenidas como string del formato Notion)
    fecha_llamada: p['Fecha de llamada']?.date?.start ?? null,
    fecha_agenda: p['Fecha de agendamiento']?.date?.start ?? null,
    fecha_venta: p['Ult fecha de venta']?.date?.start ?? null,

    extra: payload // Backup de todo el JSON
  };
}

async function sendToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};
  
  // Helper para extraer texto de Notion (Rich Text o Title)
  const getText = (prop) => prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || null;
  
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
  logSection('DATOS QUE LLEGAN DE NOTION', {
    'ID de Notion': data.id,
    'Nombre del Lead': getText(p['Nombre']),
    'GHL ID (raw)': p['GHL ID'],
    'GHL ID (extraído)': getText(p['GHL ID']),
    'Todas las propiedades disponibles': Object.keys(p).sort(),
  });
  
  // Mostrar propiedades importantes de forma individual
  console.log('\n📋 PROPIEDADES IMPORTANTES DE NOTION:');
  const importantProps = ['GHL ID', 'Aplica', 'Agendo', 'Respondio apertura', 'Confirmo mensaje', 'Llamada Meg'];
  importantProps.forEach(propName => {
    const prop = p[propName];
    if (prop) {
      console.log(`\n  🔹 ${propName}:`);
      console.log(`     Tipo: ${prop.type || 'N/A'}`);
      if (prop.type === 'select') {
        console.log(`     Valor: ${prop.select?.name || 'null'}`);
      } else if (prop.type === 'rich_text' || prop.type === 'title') {
        console.log(`     Valor: ${getText(prop) || 'null'}`);
      } else {
        console.log(`     Valor completo:`, JSON.stringify(prop, null, 4));
      }
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
      webhook_type: 'sheets2',
      type: 'invalid_id',
      message: 'El ID es null, undefined o cadena vacía',
      notion_id: data.id,
      ghl_id: getText(p['GHL ID']),
      payload: payload,
      created_at: new Date().toISOString()
    };
    
    await saveLog(errorLog);
    
    logSection('❌ ERROR: ID INVÁLIDO - NO SE ENVIARÁ A SUPABASE', {
      'GHL ID recibido': getText(p['GHL ID']),
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
      webhook_type: 'sheets2',
      type: 'success',
      message: null,
      http_status: response.status,
      supabase_error: null,
      notion_id: data.id,
      ghl_id: row.id,
      attempted_data: row,
      payload: payload,
      created_at: new Date().toISOString()
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
      webhook_type: 'sheets2',
      type: 'supabase_error',
      message: err.message,
      http_status: err.response?.status,
      supabase_error: err.response?.data,
      notion_id: data.id,
      ghl_id: row.id,
      attempted_data: row,
      payload: payload,
      created_at: new Date().toISOString()
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
  try {
    console.log("⏳ Procesando Sheets...");
    await axios.post(googleScriptUrl, payload, { headers: { 'Content-Type': 'application/json' } });
    
    console.log("⏳ Procesando Supabase...");
    await sendToSupabase(payload);
  } catch (error) {
    console.error("❌ Error en flujo:", error.message);
    
    // Log de error general en el flujo
    const errorLog = {
      webhook_type: 'sheets2',
      type: 'process_queue_error',
      message: error.message,
      payload: payload,
      created_at: new Date().toISOString()
    };
    
    await saveLog(errorLog);
  } finally {
    isProcessing = false;
    if (queue.length > 0) setImmediate(processQueue);
  }
}

exports.handleWebhook = async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log("📥 WEBHOOK RECIBIDO");
  console.log("=".repeat(60));
  console.log("⏰ Timestamp:", new Date().toISOString());
  console.log("📦 Tamaño del payload:", JSON.stringify(req.body).length, "caracteres");
  
  const data = req.body?.data || req.body;
  console.log("🆔 ID de Notion:", data?.id || 'No disponible');
  console.log("📝 Nombre del lead:", data?.properties?.['Nombre']?.title?.[0]?.plain_text || 
              data?.properties?.['Nombre']?.rich_text?.[0]?.plain_text || 'No disponible');
  
  console.log("\n📋 Payload completo (JSON):");
  console.log(JSON.stringify(req.body, null, 2));
  
  res.status(200).json({ status: "ok" });
  queue.push({ payload: req.body });
  processQueue();
};