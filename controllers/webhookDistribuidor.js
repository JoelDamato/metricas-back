const axios = require('axios');

// 🆕 URLs COMPLETAS directamente
const webhookUrls = [
  'https://metricas-back-eylj.onrender.com/api/webhook3',
  'https://metricas-back-eylj.onrender.com/api/webhookv2',
  'https://metricas-back-eylj.onrender.com/api/csm',
  'https://metricas-back-eylj.onrender.com/api/comprobantes'
];

const queue = [];
let isProcessing = false;
let lastVerification = null;

// 🆕 Sistema de deduplicación
const processedEvents = new Map();
const EVENT_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutos

// Supabase config y tablas a borrar
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseTablesToDelete = ['leads_raw', 'csm', 'comprobantes'];

// Helper: stringify seguro para objetos con ciclos
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

// Helper: hora actual de Argentina (UTC-3) en ISO sin milisegundos
function argentinaNowISO() {
  const now = new Date();
  const argentinaNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000) - (3 * 60 * 60 * 1000));
  return argentinaNow.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// 🆕 Función para limpiar eventos antiguos
function cleanOldEvents() {
  const now = Date.now();
  let cleaned = 0;
  for (let [key, timestamp] of processedEvents.entries()) {
    if (now - timestamp > EVENT_EXPIRY_TIME) {
      processedEvents.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 Limpiados ${cleaned} eventos antiguos del cache`);
  }
}

// 🆕 Función para generar ID único del evento
function getEventId(payload) {
  const possibleIds = [
    payload.id,
    payload.entity?.id,
    payload.data?.id
  ];

  const foundId = possibleIds.find(id => id !== undefined && id !== null);
  
  if (foundId) {
    return foundId;
  }

  const type = payload.type || 'unknown';
  const timestamp = payload.timestamp || Date.now();
  return `${type}-${timestamp}`;
}

// 🆕 Función para verificar si es un evento duplicado
function isDuplicate(eventId) {
  cleanOldEvents();
  
  if (processedEvents.has(eventId)) {
    const firstSeen = processedEvents.get(eventId);
    const timeSinceFirst = Date.now() - firstSeen;
    console.log(`⚠️ EVENTO DUPLICADO detectado: ${eventId}`);
    return true;
  }
  
  processedEvents.set(eventId, Date.now());
  return false;
}

// 🆕 FUNCIÓN MEJORADA para extraer el Notion ID del payload
function extractNotionId(payload) {
  console.log('🔍 Extrayendo Notion ID del payload...');
  
  const candidates = [
    { path: 'payload.id', value: payload.id },
    { path: 'payload.entity.id', value: payload.entity?.id },
    { path: 'payload.data.id', value: payload.data?.id },
    { path: 'payload.page_id', value: payload.page_id },
    { path: 'payload.notionid', value: payload.notionid }
  ];

  const found = candidates.find(c => c.value);
  const notionId = found?.value;

  if (notionId) {
    console.log(`✅ Notion ID encontrado: ${notionId} (origen: ${found.path})`);
  } else {
    console.log('❌ No se encontró Notion ID');
  }
  
  return notionId;
}

// 🆕 FUNCIÓN PRINCIPAL DE LOGGING - Guarda en Supabase
async function saveLog(logData) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn('⚠️ Supabase no configurado, no se guardará el log');
      return;
    }

    const processed = { ...logData };

    // Convertir objetos a strings
    if (processed.payload && typeof processed.payload !== 'string') {
      try {
        processed.payload = safeStringify(processed.payload);
      } catch (e) {
        processed.payload = String(processed.payload);
      }
    }

    if (processed.delete_results && typeof processed.delete_results !== 'string') {
      try {
        processed.delete_results = safeStringify(processed.delete_results);
      } catch (e) {
        processed.delete_results = String(processed.delete_results);
      }
    }

    if (processed.error_details && typeof processed.error_details !== 'string') {
      try {
        processed.error_details = safeStringify(processed.error_details);
      } catch (e) {
        processed.error_details = String(processed.error_details);
      }
    }

    if (!Object.prototype.hasOwnProperty.call(processed, 'created_at')) {
      processed.created_at = argentinaNowISO();
    }

    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/webhook_logs`;

    const response = await axios.post(url, processed, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    console.log('✅ Log guardado en Supabase:', processed.type || 'log');
    return response.data;
  } catch (err) {
    console.error('❌ Error guardando log en Supabase:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
  }
}

// Función que borra registros en Supabase por notionid
async function deleteByNotionId(notionId) {
  console.log(`🗑️ Iniciando borrado para Notion ID: ${notionId}`);
  
  // 🆕 LOG: Inicio de borrado
  await saveLog({
    type: 'delete_start',
    webhook_id: notionId,
    message: `Iniciando proceso de borrado para notionId: ${notionId}`,
    ghl_id: notionId
  });

  if (!notionId) {
    await saveLog({
      type: 'delete_error',
      webhook_id: 'unknown',
      message: 'notionId es null/undefined - borrado abortado',
      error_details: { notionId }
    });
    return [];
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    await saveLog({
      type: 'delete_error',
      webhook_id: notionId,
      message: 'Supabase no configurado - borrado abortado',
      error_details: {
        hasUrl: !!SUPABASE_URL,
        hasKey: !!SUPABASE_KEY
      }
    });
    return [];
  }

  const results = [];

  for (const table of supabaseTablesToDelete) {
    console.log(`🔄 Procesando tabla: ${table}`);
    
    try {
      const safeVal = String(notionId).replace(/'/g, "''");
      const filter = `notionid=eq.${safeVal}`;
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?${filter}`;

      console.log(`📍 DELETE URL: ${url}`);

      const deleteResponse = await axios.delete(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=representation'
        }
      });

      const deletedCount = Array.isArray(deleteResponse.data) ? deleteResponse.data.length : (deleteResponse.data ? 1 : 0);

      console.log(`✅ Tabla ${table}: ${deletedCount} registro(s) eliminado(s)`);

      // 🆕 LOG: Resultado por tabla
      await saveLog({
        type: 'delete_table_result',
        webhook_id: notionId,
        message: `Tabla ${table}: ${deletedCount} registro(s) eliminado(s)`,
        ghl_id: notionId,
        delete_results: {
          table,
          deletedCount,
          status: deleteResponse.status,
          data: deleteResponse.data
        }
      });

      results.push({
        table,
        filter,
        success: true,
        status: deleteResponse.status,
        deletedCount,
        data: deleteResponse.data
      });

    } catch (err) {
      console.error(`❌ Error en tabla ${table}:`, err.message);

      // 🆕 LOG: Error en tabla específica
      await saveLog({
        type: 'delete_table_error',
        webhook_id: notionId,
        message: `Error borrando en tabla ${table}: ${err.message}`,
        ghl_id: notionId,
        error_details: {
          table,
          error: err.message,
          status: err.response?.status,
          data: err.response?.data
        }
      });

      results.push({
        table,
        filter: `notionid=eq.${String(notionId)}`,
        success: false,
        error: err.response?.data || err.message,
        status: err.response?.status
      });
    }
  }

  const totalDeleted = results.reduce((sum, r) => sum + (r.deletedCount || 0), 0);
  
  console.log(`📊 Borrado completado: ${totalDeleted} registro(s) en total`);

  // 🆕 LOG: Resumen final de borrado
  await saveLog({
    type: 'delete_complete',
    webhook_id: notionId,
    message: `Borrado completado: ${totalDeleted} registro(s) eliminado(s) en ${results.length} tabla(s)`,
    ghl_id: notionId,
    delete_results: {
      totalDeleted,
      tablesProcessed: results.length,
      successfulTables: results.filter(r => r.success).length,
      failedTables: results.filter(r => !r.success).length,
      details: results
    }
  });

  return results;
}

async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;
  const { payload } = queue.shift();

  console.log("🔄 Iniciando distribución...");

  // 🆕 LOG: Inicio de distribución
  await saveLog({
    type: 'distribution_start',
    webhook_id: getEventId(payload),
    message: `Iniciando distribución a ${webhookUrls.length} endpoints`,
    payload: payload
  });

  try {
    const promises = webhookUrls.map(async (url) => {
      console.log(`📤 Enviando a: ${url}`);
      try {
        const response = await axios.post(url, payload, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        console.log(`✅ Éxito en ${url}`);

        return {
          url,
          success: true,
          data: response.data,
          status: response.status
        };
      } catch (error) {
        console.log(`❌ Fallo en ${url}:`, error.message);

        return {
          url,
          success: false,
          error: error.message,
          status: error.response?.status || 'NO_RESPONSE'
        };
      }
    });

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failCount = results.length - successCount;

    console.log(`📈 Distribución: ${successCount} exitosos, ${failCount} fallidos`);

    // 🆕 LOG: Resultado de distribución
    await saveLog({
      type: 'distribution_complete',
      webhook_id: getEventId(payload),
      message: `Distribución completada: ${successCount}/${results.length} exitosos`,
      delete_results: {
        successCount,
        failCount,
        total: results.length,
        results: results.map(r => r.value || { error: r.reason })
      }
    });

  } catch (error) {
    console.error("💥 Error crítico en distribución:", error.message);

    // 🆕 LOG: Error crítico
    await saveLog({
      type: 'distribution_error',
      webhook_id: getEventId(payload),
      message: `Error crítico durante distribución: ${error.message}`,
      error_details: {
        error: error.message,
        stack: error.stack
      }
    });
  } finally {
    isProcessing = false;
    setImmediate(processQueue);
  }
}

exports.handleWebhook = async (req, res) => {
  let payload = req.body;

  console.log("\n🎯 Webhook recibido:", new Date().toISOString());

  // 🆕 Si el payload viene como string, parsearlo
  if (typeof payload === 'string') {
    console.log('🔄 Parseando payload string...');
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      console.error('❌ Error parseando JSON:', e.message);
      
      // 🆕 LOG: Error de parsing
      await saveLog({
        type: 'parsing_error',
        webhook_id: 'unknown',
        message: `Error parseando payload JSON: ${e.message}`,
        error_details: { error: e.message, payload }
      });

      return res.status(400).json({ 
        error: 'Invalid JSON payload',
        message: e.message 
      });
    }
  }

  // 🆕 LOG: Webhook recibido
  await saveLog({
    type: 'webhook_received',
    webhook_id: getEventId(payload),
    message: `Webhook recibido - Tipo: ${payload.type || 'unknown'}`,
    payload: payload
  });

  // Manejo de verificación
  if (payload && payload.challenge) {
    console.log('🔐 Challenge recibido');
    lastVerification = {
      type: 'challenge',
      value: payload.challenge,
      receivedAt: new Date().toISOString()
    };

    await saveLog({
      type: 'verification_challenge',
      webhook_id: 'verification',
      message: `Challenge de verificación recibido: ${payload.challenge}`
    });

    return res.status(200).send(payload.challenge);
  }

  if (payload && payload.code) {
    console.log('🔐 Código de verificación recibido');
    lastVerification = {
      type: 'code',
      value: payload.code,
      receivedAt: new Date().toISOString()
    };

    await saveLog({
      type: 'verification_code',
      webhook_id: 'verification',
      message: `Código de verificación recibido: ${payload.code}`
    });

    return res.status(200).json({
      message: 'Código de verificación recibido',
      code: payload.code
    });
  }

  // Verificar duplicados
  const eventId = getEventId(payload);
  console.log(`🔑 Event ID: ${eventId}`);
  
  if (isDuplicate(eventId)) {
    console.log('⏭️ Evento duplicado ignorado');

    // 🆕 LOG: Duplicado
    await saveLog({
      type: 'duplicate_ignored',
      webhook_id: eventId,
      message: `Evento duplicado ignorado: ${eventId}`
    });

    return res.status(200).json({
      message: "Evento duplicado ignorado",
      eventId,
      timestamp: new Date().toISOString()
    });
  }

  console.log('✨ Evento nuevo');

  // Análisis del payload
  console.log("🔍 Análisis del payload:");
  console.log("  ├─ Type:", payload.type || 'NO ESPECIFICADO');
  console.log("  ├─ ID:", payload.id || 'NO DISPONIBLE');
  console.log("  ├─ Entity ID:", payload.entity?.id || 'NO DISPONIBLE');
  console.log("  └─ Data ID:", payload.data?.id || 'NO DISPONIBLE');

  // Detección de eventos de borrado
  const isDeleteEvent = payload.type === 'page.deleted' || 
                        (payload.type === 'page' && payload.id && !payload.data) ||
                        (payload.id && !payload.data && !payload.entity);

  console.log('🎯 ¿Es evento de borrado?', isDeleteEvent ? 'SÍ' : 'NO');

  if (isDeleteEvent) {
    console.log(`🗑️ Evento de borrado detectado`);

    const notionId = extractNotionId(payload);

    if (!notionId) {
      console.error('❌ No se pudo extraer Notion ID');
      
      // 🆕 LOG: Error extrayendo ID
      await saveLog({
        type: 'delete_failed_no_id',
        webhook_id: eventId,
        message: 'No se pudo extraer notionId del payload de borrado',
        payload: payload,
        error_details: { payload }
      });

      return res.status(400).json({
        error: "No se pudo extraer el Notion ID del payload",
        eventId,
        payload
      });
    }

    try {
      console.log(`🚀 Iniciando borrado para: ${notionId}`);
      
      const deleteResults = await deleteByNotionId(notionId);
      
      const successfulDeletes = deleteResults.filter(r => r.success && r.deletedCount > 0);
      const totalDeleted = successfulDeletes.reduce((sum, r) => sum + r.deletedCount, 0);

      console.log(`✅ Borrado completado: ${totalDeleted} registro(s)`);

      // Responder y NO distribuir
      return res.status(200).json({
        message: "Evento de borrado procesado directamente",
        eventId,
        notionId,
        deleted: true,
        deleteResults,
        totalDeleted,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('💥 Error durante el borrado:', error.message);
      
      // 🆕 LOG: Error crítico de borrado
      await saveLog({
        type: 'delete_critical_error',
        webhook_id: eventId,
        message: `Error crítico durante borrado: ${error.message}`,
        ghl_id: notionId,
        error_details: {
          error: error.message,
          stack: error.stack
        }
      });

      return res.status(500).json({
        error: "Error durante el borrado",
        eventId,
        notionId,
        message: error.message
      });
    }

  } else if (payload.data && payload.data.object === 'page') {
    console.log(`📝 Evento de crear/actualizar detectado`);

    // 🆕 LOG: Evento create/update
    await saveLog({
      type: 'page_create_update',
      webhook_id: eventId,
      message: `Evento de página create/update - ID: ${payload.data?.id}`,
      ghl_id: payload.data?.id,
      payload: payload
    });

  } else {
    console.log(`❓ Tipo de evento no reconocido`);

    // 🆕 LOG: Evento desconocido
    await saveLog({
      type: 'unknown_event',
      webhook_id: eventId,
      message: `Tipo de evento no reconocido: ${payload.type}`,
      payload: payload
    });
  }

  // Responder al cliente
  res.status(200).json({
    message: "Webhook recibido y encolado",
    eventId,
    timestamp: new Date().toISOString(),
    eventType: payload.type || 'unknown',
    willDistributeTo: webhookUrls
  });

  console.log("✅ Respuesta enviada");
  console.log(`📋 Items en cola: ${queue.length + 1}`);

  queue.push({ payload });
  processQueue();
};

exports.getLastVerification = (req, res) => {
  if (!lastVerification) {
    return res.status(404).json({
      message: 'No hay verificaciones registradas aún.'
    });
  }
  return res.status(200).json(lastVerification);
};

exports.getEventStats = (req, res) => {
  cleanOldEvents();
  
  return res.status(200).json({
    totalEventsInCache: processedEvents.size,
    cacheExpiryMinutes: EVENT_EXPIRY_TIME / 60000,
    queueLength: queue.length,
    isProcessing,
    supabaseConfigured: !!(SUPABASE_URL && SUPABASE_KEY),
    tablesToDelete: supabaseTablesToDelete,
    events: Array.from(processedEvents.entries()).map(([id, timestamp]) => ({
      eventId: id,
      receivedAt: new Date(timestamp).toISOString(),
      ageSeconds: ((Date.now() - timestamp) / 1000).toFixed(2)
    }))
  });
};