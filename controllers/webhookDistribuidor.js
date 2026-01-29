const axios = require('axios');

// URLs de tus controladores
const webhookUrls = [
  'https://metricas-back-eylj.onrender.com/api/webhook3',
  'https://metricas-back-eylj.onrender.com/api/webhookv2',
  'https://metricas-back-eylj.onrender.com/api/csm',
  'https://metricas-back-eylj.onrender.com/api/comprobantes'
];

// Config de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Tablas donde buscar y borrar
const tablasSupabase = ['leads_raw', 'csm', 'comprobantes'];

// Guardar log en Supabase
async function guardarLog(tipo, mensaje, datos = {}) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;

    const log = {
      webhook_type: 'NOTION_DELETE',  // Identificador del webhook
      type: tipo,                      // success, error, info, etc.
      message: mensaje,
      http_status: datos.httpStatus || null,
      supabase_error: datos.supabaseError ? JSON.stringify(datos.supabaseError) : null,
      notion_id: datos.notionId || null,
      ghl_id: datos.notionId || null,  // Mismo que notion_id
      attempted_data: datos.resultados ? JSON.stringify(datos.resultados) : null,
      payload: datos.payload ? JSON.stringify(datos.payload) : null,
      created_at: new Date().toISOString(),
      notionid: datos.notionId || null
    };

    await axios.post(`${SUPABASE_URL}/rest/v1/webhook_logs`, log, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📝 Log guardado: ${tipo}`);
  } catch (error) {
    console.error('❌ Error guardando log:', error.message);
  }
}

// Extraer el Notion ID del payload
function extraerNotionId(payload) {
  return payload.id || 
         payload.entity?.id || 
         payload.data?.id || 
         payload.page_id || 
         payload.notionid;
}

// Borrar por notionid en todas las tablas
async function borrarDeSupabase(notionId) {
  if (!notionId || !SUPABASE_URL || !SUPABASE_KEY) {
    console.log('❌ Falta notionId o config de Supabase');
    return [];
  }

  console.log(`🗑️ Borrando notionId: ${notionId}`);
  
  await guardarLog('info', `Iniciando borrado para notionId: ${notionId}`, {
    notionId,
    httpStatus: 200
  });
  
  const resultados = [];

  for (const tabla of tablasSupabase) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/${tabla}?notionid=eq.${notionId}`;
      
      const response = await axios.delete(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=representation'
        }
      });

      const borrados = Array.isArray(response.data) ? response.data.length : 0;
      console.log(`✅ Tabla ${tabla}: ${borrados} registro(s) borrado(s)`);
      
      // Log por cada tabla
      await guardarLog('success', `Tabla ${tabla}: ${borrados} registro(s) borrado(s)`, {
        notionId,
        resultados: { tabla, borrados },
        httpStatus: response.status
      });
      
      resultados.push({ tabla, borrados, exito: true });
      
    } catch (error) {
      console.error(`❌ Error en tabla ${tabla}:`, error.message);
      
      // Log de error por tabla
      await guardarLog('error', `Error en tabla ${tabla}: ${error.message}`, {
        notionId,
        supabaseError: error.message,
        resultados: { tabla },
        httpStatus: error.response?.status || 500
      });
      
      resultados.push({ tabla, borrados: 0, exito: false, error: error.message });
    }
  }

  return resultados;
}

// Enviar a tus controladores
async function enviarAControladores(payload) {
  console.log(`📤 Enviando a ${webhookUrls.length} controladores...`);
  
  const promesas = webhookUrls.map(url => 
    axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    }).catch(error => ({ error: error.message, url }))
  );

  const resultados = await Promise.all(promesas);
  const exitosos = resultados.filter(r => !r.error).length;
  
  console.log(`✅ Enviado a ${exitosos}/${webhookUrls.length} controladores`);
  return resultados;
}

// Handler principal
exports.handleWebhook = async (req, res) => {
  let payload = req.body;

  console.log('\n🎯 Webhook recibido:', new Date().toISOString());

  // Parsear si viene como string
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      await guardarLog('error', `Error parseando JSON: ${error.message}`, {
        supabaseError: error.message,
        payload: req.body,
        httpStatus: 400
      });
      return res.status(400).json({ error: 'JSON inválido' });
    }
  }

  // Log: webhook recibido
  const webhookId = extraerNotionId(payload) || 'unknown';
  await guardarLog('info', `Webhook recibido - Tipo: ${payload.type || 'unknown'}`, {
    notionId: webhookId,
    payload,
    httpStatus: 200
  });

  // Verificación (si Notion te envía un challenge)
  if (payload.challenge) {
    console.log('🔐 Challenge de verificación');
    await guardarLog('info', `Challenge recibido: ${payload.challenge}`, {
      notionId: 'verification',
      httpStatus: 200
    });
    return res.status(200).send(payload.challenge);
  }

  // Extraer el ID
  const notionId = extraerNotionId(payload);
  
  if (!notionId) {
    console.log('⚠️ No se encontró notionId en el payload');
    await guardarLog('error', 'No se encontró notionId en el payload', {
      notionId: 'unknown',
      payload,
      httpStatus: 400
    });
    return res.status(400).json({ error: 'No se encontró notionId' });
  }

  console.log(`🔑 Notion ID: ${notionId}`);

  try {
    // Log: inicio del proceso
    await guardarLog('info', `Iniciando proceso para notionId: ${notionId}`, {
      notionId,
      httpStatus: 200
    });

    // 1. Borrar de Supabase
    const resultadosBorrado = await borrarDeSupabase(notionId);
    const totalBorrados = resultadosBorrado.reduce((sum, r) => sum + r.borrados, 0);
    
    // Log: resultado del borrado
    await guardarLog('success', `Borrado completado: ${totalBorrados} registro(s)`, {
      notionId,
      resultados: resultadosBorrado,
      httpStatus: 200
    });

    // 2. Enviar a controladores
    const resultadosControladores = await enviarAControladores(payload);
    const exitosos = resultadosControladores.filter(r => !r.error).length;

    // Log: resultado del envío a controladores
    await guardarLog('success', `Enviado a controladores: ${exitosos}/${webhookUrls.length} exitosos`, {
      notionId,
      resultados: { exitosos, total: webhookUrls.length },
      httpStatus: 200
    });

    // Responder
    return res.status(200).json({
      mensaje: 'Webhook procesado',
      notionId,
      supabase: {
        totalBorrados,
        detalles: resultadosBorrado
      },
      controladores: {
        total: webhookUrls.length,
        exitosos
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Error:', error.message);
    
    // Log: error crítico
    await guardarLog('error', `Error procesando webhook: ${error.message}`, {
      notionId,
      supabaseError: error.message,
      httpStatus: 500
    });

    return res.status(500).json({ 
      error: 'Error procesando webhook',
      mensaje: error.message 
    });
  }
};

// Endpoint opcional para ver stats
exports.getStats = (req, res) => {
  res.json({
    controladores: webhookUrls.length,
    tablasSupabase: tablasSupabase,
    supabaseConfigurado: !!(SUPABASE_URL && SUPABASE_KEY)
  });
};

// Endpoint para ver última verificación (si lo usabas)
exports.getLastVerification = (req, res) => {
  res.status(200).json({
    message: 'Endpoint de verificación disponible',
    timestamp: new Date().toISOString()
  });
};

// Endpoint para ver estadísticas de eventos (si lo usabas)
exports.getEventStats = (req, res) => {
  res.status(200).json({
    supabaseConfigured: !!(SUPABASE_URL && SUPABASE_KEY),
    tablesToDelete: tablasSupabase,
    webhookUrls: webhookUrls.length,
    timestamp: new Date().toISOString()
  });
};