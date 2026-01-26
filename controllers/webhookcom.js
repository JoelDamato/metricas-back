const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbxij3VPCpyGs3-adtVGEjzC1rVd9tgDyGs19_ChKUo5SytA_-K_pz_vghfFBQSVh6ZdHg/exec";

const queue = [];
let isProcessing = false;

// Función para normalizar fechas al formato de Supabase (date)
function normalizeDate(dateValue) {
  if (!dateValue) return null;
  
  // Si ya es null o undefined, retornar null
  if (dateValue === null || dateValue === undefined) return null;
  
  // Si es string vacío, retornar null
  if (typeof dateValue === 'string' && dateValue.trim() === '') return null;
  
  try {
    // Intentar parsear la fecha
    const date = new Date(dateValue);
    
    // Verificar que sea una fecha válida
    if (isNaN(date.getTime())) return null;
    
    // Ajustar restando 3 horas
    const adjusted = new Date(date.getTime() - 3 * 60 * 60 * 1000);

    // Retornar ISO completo con hora (supabase timestamp) sin milisegundos
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

    // Siempre enviar created_at: null si no se proporciona (Supabase puede setearlo automáticamente si está configurado)
    if (!Object.prototype.hasOwnProperty.call(processedData, 'created_at')) {
      const now = new Date();
      const argentinaNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000) - (3 * 60 * 60 * 1000));
      // Formato ISO sin milisegundos
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
    console.error('📋 Datos que intentamos enviar:', JSON.stringify(logData, null, 2));
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
  const finalId = (ghlId && ghlId.toString().trim() !== '') ? ghlId.toString() : data.id;

  return {
    id: finalId,
    adname: getValue(p['Adname']),
    adset: getValue(p['Adset']),
    agenda_format: getValue(p['Agenda Format']),
    csm_2_0: getValue(p['CSM 2.0']),
    calidad: getValue(p['Calidad']),
    campaign: getValue(p['Campaign']),
    cantidad_de_pagos: getValue(p['Cantidad de pagos']),
    cash_collected: getValue(p['Cash collected']),
    cash_collected_ars: getValue(p['Cash collected ARS']),
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
    mail: getValue(p['Mail']),
    medios_de_pago: getValue(p['Medios de pago']),
    modelo_de_negocio: getValue(p['Modelo de negocio']),
    monto_pesos: getValue(p['Monto Pesos']),
    origen: getValue(p['Origen']),
    producto_format: getValue(p['Producto Format']),
    productos: getValue(p['Productos']),
    rebotar_pago: getValue(p['Rebotar pago']),
    rectificar_pago: getValue(p['Rectificar pago']),
    responsable_actual: getValue(p['Responsable Actual']),
    score: getValue(p['Score']),
    tc: getValue(p['TC']),
    telefono: getValue(p['Telefono']),
    tipo: getValue(p['Tipo']),
    tipo_banco: getValue(p['Tipo Banco']),
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
    f_renovacion: getValue(p['F. renovacion']),
    f_renovacion_string: getValue(p['F. Renovacion string'])
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
  logSection('DATOS QUE LLEGAN DE NOTION (COMPROBANTES)', {
    'ID de Notion': data.id,
    'GHL ID (raw)': p['GHL ID'],
    'GHL ID (extraído)': getValue(p['GHL ID']),
    'Cliente': getValue(p['Cliente']),
    'Comprobante': getValue(p['Comprobante']),
    'Todas las propiedades disponibles': Object.keys(p).sort(),
  });
  
  // Mostrar propiedades importantes de forma individual
  console.log('\n📋 PROPIEDADES IMPORTANTES DE COMPROBANTES:');
  const importantProps = ['GHL ID', 'Identificador', 'Cliente', 'Comprobante', 'Estado', 'Facturacion', 'Cash collected total'];
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
  logSection('DATOS MAPEADOS PARA SUPABASE (COMPROBANTES)', row);
  
  // Validar que el ID sea válido antes de enviar
  if (!row.id || row.id === '') {
    const errorLog = {
      webhook_type: 'com',
      type: 'invalid_id',
      message: 'El ID es null, undefined o cadena vacía',
      notion_id: data.id,
      ghl_id: getValue(p['GHL ID']),
      payload: payload,
      created_at: new Date().toISOString()
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
  console.log(`🚀 INTENTANDO GUARDAR EN SUPABASE (COMPROBANTES)`);
  console.log('='.repeat(60));
  console.log(`📤 URL: ${SUPABASE_URL}/rest/v1/comprobantes`);
  console.log(`📤 ID del registro: ${row.id}`);
  console.log(`📤 Cliente: ${row.cliente || 'Sin cliente'}`);
  console.log(`📤 Total de campos: ${Object.keys(row).length}`);

  try {
    const startTime = Date.now();
    const response = await axios.post(`${SUPABASE_URL}/rest/v1/comprobantes`, row, {
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
    
    logSection('✅ ÉXITO: COMPROBANTE GUARDADO EN SUPABASE', {
      'Status HTTP': response.status,
      'Tiempo de respuesta': `${duration}ms`,
      'ID guardado': row.id,
      'Respuesta de Supabase': response.data,
      'Headers de respuesta': response.headers
    });
    
  } catch (err) {
    // ========== ERROR AL GUARDAR EN SUPABASE ==========
    const errorLog = {
      webhook_type: 'com',
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
    
    logSection('❌ ERROR AL GUARDAR COMPROBANTE EN SUPABASE', {
      'Mensaje de error': err.message,
      'Código de estado HTTP': err.response?.status,
      'Datos del error': err.response?.data,
      'URL intentada': `${SUPABASE_URL}/rest/v1/comprobantes`,
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
    console.log("⏳ Procesando Sheets (Comprobantes)...");
    await axios.post(googleScriptUrl, payload, { 
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    console.log("⏳ Procesando Supabase (Comprobantes)...");
    await sendToSupabase(payload);
  } catch (error) {
    console.error("❌ Error en flujo de comprobantes:", error.message);
    
    // Log de error general en el flujo
    const errorLog = {
      webhook_type: 'com',
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
  console.log("📥 WEBHOOK RECIBIDO (COMPROBANTES)");
  console.log("=".repeat(60));
  console.log("⏰ Timestamp:", new Date().toISOString());
  console.log("📦 Tamaño del payload:", JSON.stringify(req.body).length, "caracteres");
  
  const payload = req.body;
  const data = payload.data || payload;
  const p = data?.properties || {};
  
  console.log("🆔 ID de Notion:", data?.id || 'No disponible');
  console.log("📝 Cliente:", p['Cliente']?.rich_text?.[0]?.plain_text || 
              p['Cliente']?.title?.[0]?.plain_text || 'No disponible');
  console.log("📄 Comprobante:", p['Comprobante']?.rich_text?.[0]?.plain_text || 
              p['Comprobante']?.title?.[0]?.plain_text || 'No disponible');
  
  // Validar payload
  const isValidPayload = 
    (payload.data && payload.data.object === 'page') ||
    (payload.type === 'page.deleted' && payload.entity);

  if (!isValidPayload) {
    console.warn("⚠️ Payload NO VÁLIDO - no es un evento reconocido");
    return res.status(400).json({ 
      error: "Payload inválido",
      received: payload.type || 'unknown'
    });
  }

  console.log("\n📋 Payload completo (JSON):");
  console.log(JSON.stringify(req.body, null, 2));
  
  res.status(200).json({ 
    status: "ok",
    message: "Webhook de comprobantes recibido",
    receivedAt: new Date().toISOString()
  });
  
  queue.push({ payload: req.body });
  processQueue();
};