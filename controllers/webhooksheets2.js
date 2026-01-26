const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// URL de tu App Script desplegado como endpoint web
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbyLw7tUDMcx8taru71YQBnF3SVvKzvjknL7kuTqnnvw-n3MXRFNVx5eMxog28WdDklM/exec";

// Cola en memoria para los envíos
const queue = [];
let isProcessing = false;

// Función para normalizar fechas: resta 3 horas y devuelve ISO sin milisegundos
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

// Función para guardar logs en Supabase
async function saveLog(logData) {
  try {
    // Convertir objetos grandes a JSON strings para evitar errores
    const processedData = { ...logData };
    if (processedData.payload && typeof processedData.payload === 'object') {
      processedData.payload = JSON.stringify(processedData.payload);
    }
    if (processedData.attempted_data && typeof processedData.attempted_data === 'object') {
      processedData.attempted_data = JSON.stringify(processedData.attempted_data);
    }
    if (processedData.supabase_error && typeof processedData.supabase_error === 'object') {
      processedData.supabase_error = JSON.stringify(processedData.supabase_error);
    }

    // NO enviar created_at, dejar que use el default de la base de datos
    delete processedData.created_at;

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

async function sendToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};
  
  // Helper para extraer texto de Notion (Rich Text o Title)
  const getText = (prop) => prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || null;
  
  // TEST SIMPLIFICADO - Solo campos básicos
  const row = {
    id: getText(p['GHL ID']) || data.id,
    nombre: getText(p['Nombre']),
    created_time: normalizeDate(data.created_time),
    last_edited_time: normalizeDate(data.last_edited_time),
    archived: data.archived ?? false,
    
    // Identidad básica
    dni: getText(p['Dni']),
    mail: getText(p['Mail']),
    telefono: getText(p['Telefono']),
    whatsapp: getText(p['WhatsApp']),
    instagram: getText(p['Instagram']),
    usuario_ig: getText(p['Usuario IG']),
    
    // Clasificación
    origen: getText(p['Origen']),
    primer_origen: getText(p['Primer origen']),
    etapa: getText(p['Etapa']),
    temperatura: p['Temperatura']?.select?.name ?? null,
    calidad_lead: getText(p['Calidad del lead']),
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
    setter: getText(p['Setter']),
    closer: getText(p['Closer']),
    
    // Estados
    aplica: p['Aplica']?.select?.name ?? null,
    lista_negra: p['Lista negra']?.checkbox ?? false,
    recuperado: p['Recuperado']?.select?.name ?? null,
    cliente_viejo: p['Cliente viejo']?.checkbox ?? false,
    agendo: p['Agendo']?.select?.name ?? null,
    respondio_apertura: p['Respondio apertura']?.select?.name ?? null,
    confirmo_mensaje: p['Confirmo mensaje']?.select?.name ?? null,
    llamada_meg: p['Llamada MEG']?.select?.name ?? null,
    
    // Números - extraer de rich_text si no son number type
// Números - extraer de rich_text si no son number type
facturacion: p['Facturacion']?.number ?? null,
facturacion_total: p['Facturacion total']?.number ?? null,
cash_collected_total: p['Cash collected total']?.number ?? null,
saldo: p['Saldo']?.number ?? null,
inversion: p['Inversion']?.number ?? null,
score: p['Score']?.number ?? null,
    
    // Fechas
    fecha_llamada: normalizeDate(p['Fecha de llamada']?.date?.start),
    fecha_agenda: normalizeDate(p['Fecha de agendamiento']?.date?.start),
    fecha_venta: normalizeDate(p['Ult fecha de venta']?.date?.start),
    
    extra: payload
  };
  
  console.log('🧪 Datos a enviar:', JSON.stringify(row, null, 2));
  
  // Validar que el ID sea válido
  if (!row.id || row.id === '') {
    const errorLog = {
      webhook_type: 'CRM',
      type: 'invalid_id',
      message: 'El ID es null, undefined o cadena vacía',
      notion_id: data.id,
      ghl_id: getText(p['GHL ID']),
      payload: payload
    };
    
    await saveLog(errorLog);
    console.log('❌ ERROR: ID INVÁLIDO');
    return;
  }

  try {
    console.log('🚀 Enviando a:', `${SUPABASE_URL}/rest/v1/leads_raw`);
    
    const response = await axios.post(`${SUPABASE_URL}/rest/v1/leads_raw`, row, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      params: { on_conflict: 'id' }
    });
    
    console.log('✅ ÉXITO: Registro guardado en Supabase');
    
    await saveLog({
      webhook_type: 'CRM',
      type: 'success',
      message: 'Registro guardado exitosamente',
      http_status: response.status,
      notion_id: data.id,
      ghl_id: row.id,
      attempted_data: row,
      payload: payload
    });
    
  } catch (err) {
    console.error('❌ ERROR AL GUARDAR:', err.message);
    console.error('Status:', err.response?.status);
    console.error('Data:', JSON.stringify(err.response?.data, null, 2));
    
    const debugInfo = {
      error_message: err.message,
      supabase_url: SUPABASE_URL,
      url_completa: `${SUPABASE_URL}/rest/v1/leads_raw`,
      http_status: err.response?.status,
      supabase_error: err.response?.data,
      id_intentado: row.id,
      nombre_intentado: row.nombre
    };
    
    await saveLog({
      webhook_type: 'CRM',
      type: 'supabase_error',
      message: JSON.stringify(debugInfo, null, 2),
      http_status: err.response?.status,
      supabase_error: err.response?.data,
      notion_id: data.id,
      ghl_id: row.id,
      attempted_data: row,
      payload: payload
    });
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
    
    await saveLog({
      webhook_type: 'CRM',
      type: 'process_queue_error',
      message: error.message,
      payload: payload
    });
  } finally {
    isProcessing = false;
    if (queue.length > 0) setImmediate(processQueue);
  }
}

exports.handleWebhook = async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log("📥 WEBHOOK RECIBIDO - CRM");
  console.log("=".repeat(60));
  
  const data = req.body?.data || req.body;
  console.log("🆔 ID de Notion:", data?.id || 'No disponible');
  
  res.status(200).json({ status: "ok" });
  queue.push({ payload: req.body });
  processQueue();
};