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

    console.log(`📝 Log guardado: ${tipo} - ${mensaje}`);
  } catch (error) {
    console.error('❌ Error guardando log:', error.message);
  }
}

// Extraer el Notion ID del payload
function extraerNotionId(payload) {
  console.log('\n🔍 ========================================');
  console.log('🔍 EXTRAYENDO NOTION ID DEL PAYLOAD');
  console.log('🔍 ========================================');
  
  // Validar que payload sea un objeto
  if (!payload || typeof payload !== 'object') {
    console.log('⚠️ Payload no es un objeto válido');
    console.log('   Tipo:', typeof payload);
    console.log('   Valor:', payload);
    return null;
  }

  console.log('📦 Estructura del payload:');
  console.log('   - payload.entity:', payload.entity);
  console.log('   - payload.entity?.id:', payload.entity?.id);
  console.log('   - payload.id:', payload.id);
  console.log('   - payload.data?.id:', payload.data?.id);
  console.log('   - payload.page_id:', payload.page_id);
  console.log('   - payload.notionid:', payload.notionid);

  // Para eventos de borrado, el ID está en entity.id
  const notionId = payload.entity?.id || 
                   payload.id || 
                   payload.data?.id || 
                   payload.page_id || 
                   payload.notionid;
  
  console.log('\n✅ Notion ID extraído:', notionId);
  console.log('   - Tipo:', typeof notionId);
  console.log('   - Longitud:', notionId?.length);
  console.log('   - Válido:', !!notionId);
  console.log('🔍 ========================================\n');
  
  return notionId;
}

// Borrar por Notion ID usando el campo 'id' (PRIMARY KEY) en todas las tablas
async function borrarDeSupabase(notionId) {
  if (!notionId || !SUPABASE_URL || !SUPABASE_KEY) {
    console.log('❌ Falta notionId o config de Supabase');
    console.log('   - notionId:', notionId);
    console.log('   - SUPABASE_URL:', SUPABASE_URL ? 'Configurado' : 'NO configurado');
    console.log('   - SUPABASE_KEY:', SUPABASE_KEY ? 'Configurado' : 'NO configurado');
    return [];
  }

  console.log(`\n🗑️ ========================================`);
  console.log(`🗑️ INICIANDO BORRADO`);
  console.log(`🗑️ Notion ID: ${notionId}`);
  console.log(`🗑️ Tipo de ID: ${typeof notionId}`);
  console.log(`🗑️ Longitud del ID: ${notionId.length}`);
  console.log(`🗑️ ========================================\n`);
  
  await guardarLog('info', `Iniciando borrado para Notion ID: ${notionId}`, {
    notionId,
    httpStatus: 200
  });
  
  const resultados = [];

  for (const tabla of tablasSupabase) {
    try {
      // Primero BUSCAR si existe el registro
      const urlBuscar = `${SUPABASE_URL}/rest/v1/${tabla}?id=eq.${notionId}&select=*`;
      
      console.log(`\n🔍 BUSCANDO en tabla: ${tabla}`);
      console.log(`   URL: ${urlBuscar}`);
      
      const busqueda = await axios.get(urlBuscar, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });
      
      console.log(`   📊 Registros encontrados: ${busqueda.data.length}`);
      if (busqueda.data.length > 0) {
        console.log(`   📄 Datos encontrados:`, JSON.stringify(busqueda.data, null, 2));
      }
      
      // Ahora intentar borrar
      const urlBorrar = `${SUPABASE_URL}/rest/v1/${tabla}?id=eq.${notionId}`;
      
      console.log(`\n🗑️ BORRANDO de tabla: ${tabla}`);
      console.log(`   URL: ${urlBorrar}`);
      
      const response = await axios.delete(urlBorrar, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'return=representation'
        }
      });

      const borrados = Array.isArray(response.data) ? response.data.length : 0;
      console.log(`   ✅ Registros borrados: ${borrados}`);
      console.log(`   📊 Status HTTP: ${response.status}`);
      if (borrados > 0) {
        console.log(`   📄 Datos borrados:`, JSON.stringify(response.data, null, 2));
      }
      
      // Log por cada tabla
      await guardarLog('success', `Tabla ${tabla}: ${borrados} registro(s) borrado(s)`, {
        notionId,
        resultados: { 
          tabla, 
          borrados, 
          registros_encontrados: busqueda.data.length,
          registros_borrados: response.data 
        },
        httpStatus: response.status
      });
      
      resultados.push({ 
        tabla, 
        encontrados: busqueda.data.length,
        borrados, 
        exito: true 
      });
      
    } catch (error) {
      console.error(`\n❌ ERROR en tabla ${tabla}:`);
      console.error(`   Mensaje: ${error.message}`);
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Data:`, error.response?.data);
      
      // Log de error por tabla
      await guardarLog('error', `Error en tabla ${tabla}: ${error.message}`, {
        notionId,
        supabaseError: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        },
        resultados: { tabla },
        httpStatus: error.response?.status || 500
      });
      
      resultados.push({ 
        tabla, 
        encontrados: 0,
        borrados: 0, 
        exito: false, 
        error: error.message 
      });
    }
  }

  console.log(`\n🗑️ ========================================`);
  console.log(`🗑️ RESUMEN DEL BORRADO`);
  console.log(`🗑️ Total de tablas procesadas: ${resultados.length}`);
  console.log(`🗑️ Total de registros borrados: ${resultados.reduce((sum, r) => sum + r.borrados, 0)}`);
  console.log(`🗑️ ========================================\n`);

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

  console.log('\n🎯 Webhook de borrado recibido:', new Date().toISOString());
  console.log('📦 Tipo de payload recibido:', typeof payload);

  // ⚠️ CRÍTICO: Parsear si viene como string - DEBE IR PRIMERO
  if (typeof payload === 'string') {
    try {
      console.log('🔄 Parseando payload (primer parseo)...');
      payload = JSON.parse(payload);
      console.log('✅ Primer parseo exitoso. Tipo resultante:', typeof payload);
      
      // 🔥 DOBLE PARSEO: Si después de parsear sigue siendo string, parsear de nuevo
      if (typeof payload === 'string') {
        console.log('🔄 Payload sigue siendo string, parseando segunda vez...');
        payload = JSON.parse(payload);
        console.log('✅ Segundo parseo exitoso');
      }
      
    } catch (error) {
      console.error('❌ Error parseando JSON:', error.message);
      await guardarLog('error', `Error parseando JSON: ${error.message}`, {
        supabaseError: error.message,
        payload: req.body,
        httpStatus: 400
      });
      return res.status(400).json({ error: 'JSON inválido' });
    }
  }
  
  console.log('📋 Payload final (tipo):', typeof payload);
  console.log('📋 Payload tiene entity?:', !!payload?.entity);

  // Verificación (si Notion te envía un challenge)
  if (payload.challenge) {
    console.log('🔐 Challenge de verificación');
    await guardarLog('info', `Challenge recibido: ${payload.challenge}`, {
      notionId: 'verification',
      httpStatus: 200
    });
    return res.status(200).send(payload.challenge);
  }

  // Ahora sí extraer el ID (después de parsear)
  const notionId = extraerNotionId(payload);
  
  if (!notionId) {
    console.log('⚠️ No se encontró Notion ID en el payload');
    console.log('📋 Payload completo:', JSON.stringify(payload, null, 2));
    
    await guardarLog('error', 'No se encontró Notion ID en el payload', {
      notionId: 'unknown',
      payload,
      httpStatus: 400
    });
    return res.status(400).json({ 
      error: 'No se encontró Notion ID',
      payload_recibido: payload
    });
  }

  console.log(`🔑 Notion ID extraído: ${notionId}`);
  console.log(`📋 Se buscará en el campo 'id' (PRIMARY KEY) de cada tabla`);

  // Log: webhook recibido CON el ID ya extraído
  await guardarLog('info', `Webhook de borrado recibido - Tipo: ${payload.type || 'unknown'}`, {
    notionId: notionId,
    payload,
    httpStatus: 200
  });

  try {
    // Log: inicio del proceso
    await guardarLog('info', `Iniciando proceso de borrado para Notion ID: ${notionId}`, {
      notionId,
      httpStatus: 200
    });

    // 1. Borrar de Supabase usando el campo 'id'
    const resultadosBorrado = await borrarDeSupabase(notionId);
    const totalBorrados = resultadosBorrado.reduce((sum, r) => sum + r.borrados, 0);
    
    // Log: resultado del borrado
    await guardarLog('success', `Borrado completado: ${totalBorrados} registro(s) eliminado(s)`, {
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
      mensaje: 'Webhook de borrado procesado exitosamente',
      notionId,
      supabase: {
        totalBorrados,
        detalles: resultadosBorrado,
        campo_busqueda: 'id (PRIMARY KEY con Notion ID)'
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
    await guardarLog('error', `Error procesando webhook de borrado: ${error.message}`, {
      notionId,
      supabaseError: error.message,
      httpStatus: 500
    });

    return res.status(500).json({ 
      error: 'Error procesando webhook de borrado',
      mensaje: error.message 
    });
  }
};

// Endpoint opcional para ver stats
exports.getStats = (req, res) => {
  res.json({
    controladores: webhookUrls.length,
    tablasSupabase: tablasSupabase,
    supabaseConfigurado: !!(SUPABASE_URL && SUPABASE_KEY),
    campo_busqueda: 'id (PRIMARY KEY con Notion ID)'
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
    campo_busqueda: 'id (PRIMARY KEY con Notion ID)',
    timestamp: new Date().toISOString()
  });
};

// 🆕 Endpoint para probar si un ID existe en las tablas
exports.testNotionId = async (req, res) => {
  const { notionId } = req.query;
  
  if (!notionId) {
    return res.status(400).json({ error: 'Falta parámetro notionId' });
  }
  
  console.log(`\n🧪 ========================================`);
  console.log(`🧪 TEST: Buscando Notion ID: ${notionId}`);
  console.log(`🧪 ========================================\n`);
  
  const resultados = [];
  
  for (const tabla of tablasSupabase) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/${tabla}?id=eq.${notionId}&select=*`;
      
      console.log(`🔍 Buscando en tabla: ${tabla}`);
      console.log(`   URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });
      
      const encontrados = response.data.length;
      console.log(`   📊 Registros encontrados: ${encontrados}`);
      
      if (encontrados > 0) {
        console.log(`   📄 Datos:`, JSON.stringify(response.data, null, 2));
      }
      
      resultados.push({
        tabla,
        encontrados,
        datos: response.data
      });
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      resultados.push({
        tabla,
        error: error.message
      });
    }
  }
  
  console.log(`\n🧪 ========================================`);
  console.log(`🧪 TEST COMPLETADO`);
  console.log(`🧪 ========================================\n`);
  
  return res.status(200).json({
    notionId,
    resultados,
    timestamp: new Date().toISOString()
  });
};