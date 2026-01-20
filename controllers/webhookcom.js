const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbxij3VPCpyGs3-adtVGEjzC1rVd9tgDyGs19_ChKUo5SytA_-K_pz_vghfFBQSVh6ZdHg/exec";

const queue = [];
let isProcessing = false;

function mapToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};

  // Helper para extraer texto de Notion (Rich Text o Title)
  const getText = (prop) => prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || null;
  
  // Helper para extraer número
  const getNumber = (prop) => prop?.number ?? null;
  
  // Helper para extraer fecha
  const getDate = (prop) => prop?.date?.start ?? null;
  
  // Helper para extraer select
  const getSelect = (prop) => prop?.select?.name ?? null;
  
  // Helper para extraer checkbox
  const getCheckbox = (prop) => prop?.checkbox ?? null;
  
  // Helper para extraer fórmula (puede ser string o number)
  const getFormula = (prop) => {
    if (!prop?.formula) return null;
    if (prop.formula.type === 'string') return prop.formula.string;
    if (prop.formula.type === 'number') return prop.formula.number?.toString();
    return null;
  };

  // Obtener GHL ID de la fórmula, si está vacío usar el ID de Notion
  const ghlId = getFormula(p['GHL ID']) 
  const finalId = (ghlId && ghlId.trim() !== '') ? ghlId : data.id;

  return {
    id: finalId, // GHL ID que relaciona con leads_raw
    adname: getText(p['Adname']),
    adset: getText(p['Adset']),
    agenda_format: getText(p['Agenda Format']),
    csm_2_0: getText(p['CSM 2.0']),
    calidad: getSelect(p['Calidad']),
    campaign: getText(p['Campaign']),
    cantidad_de_pagos: getNumber(p['Cantidad de pagos']),
    cash_collected: getNumber(p['Cash collected']),
    cash_collected_ars: getNumber(p['Cash collected ARS']),
    cash_collected_total: getNumber(p['Cash collected Total']),
    cliente: getText(p['Cliente']),
    cobranza_relacionada: getText(p['Cobranza relacionada']),
    comprobante: getText(p['Comprobante']),
    conciliacion_financiera: getText(p['Conciliacion Financiera']),
    conciliacion_financiera_2: getText(p['Conciliacion financiera']),
    conciliar: getText(p['Conciliar']),
    correspondiente_format: getText(p['Correspondiente format']),
    creado_por: p['Creado por']?.people?.[0]?.name ?? null,
    dni_cuit: getText(p['Dni Cuit']),
    estado: getSelect(p['Estado']),
    facturacion: getNumber(p['Facturacion']),
    facturacion_ars: getNumber(p['Facturacion ARS']),
    facturacion_arca: getNumber(p['Facturacion Arca']),
    facturar: getText(p['Facturar']),
    fecha_correspondiente: getDate(p['Fecha correspondiente']),
    fecha_creado: getDate(p['Fecha creado']),
    fecha_de_agendamiento: getDate(p['Fecha de agendamiento']),
    fecha_facturado: getDate(p['Fecha facturado']),
    fecha_respaldo: getDate(p['Fecha respaldo']),
    finalizar: getText(p['Finalizar']),
    info_comprobantes: getText(p['Info Comprobantes']),
    mail: p['Mail']?.email ?? null,
    medios_de_pago: getText(p['Medios de pago']),
    modelo_de_negocio: getSelect(p['Modelo de negocio']),
    monto_pesos: getNumber(p['Monto Pesos']),
    origen: getSelect(p['Origen']),
    producto_format: getText(p['Producto Format']),
    productos: getText(p['Productos']),
    rebotar_pago: getText(p['Rebotar pago']),
    rectificar_pago: getText(p['Rectificar pago']),
    responsable_actual: p['Responsable Actual']?.people?.[0]?.name ?? null,
    score: getNumber(p['Score']),
    tc: getText(p['TC']),
    telefono: p['Telefono']?.phone_number ?? null,
    tipo: getSelect(p['Tipo']),
    tipo_banco: getText(p['Tipo Banco']),
    venta_relacionada: getText(p['Venta relacionada']),
    verificacion: getText(p['Verificacion']),
    verificacion_comisiones: getText(p['Verificacion comisiones']),
    crear_registro_csm: getText(p['🟢 Crear registro CSM']),
    agenda_periodo_a: getText(p['Agenda periodo A']),
    agenda_periodo_m: getText(p['Agenda periodo M']),
    correspondiente_periodo_m: getText(p['Correspondiente periodo M']),
    correspondiente_periodo_a: getText(p['Correspondiente periodo A']),
    estado_cc: getText(p['Estado CC']),
    fecha_de_venta_format: getDate(p['Fecha de venta format']),
    llamada_meg: getSelect(p['Llamada Meg']),
    cheque: getCheckbox(p['Cheque?']),
    fecha_de_acreditacion: getDate(p['Fecha de acreditacion']),
    fecha_de_llamada: getDate(p['Fecha de llamada']),
    calendario_agendado: getDate(p['Calendario agendado']),
    venta_periodo_m: getText(p['Venta periodo M']),
    venta_periodo_a: getText(p['Venta periodo A']),
    neto_club: getNumber(p['Neto Club']),
    medios_de_pago_format: getText(p['Medios de pago Format']),
    setter: getSelect(p['Setter']),
    f_acreditacion: getDate(p['F.acreditacion']),
    f_acreditacion_format: getDate(p['F.acreditacion format']),
    cliente_format: getText(p['Cliente Format']),
    porcentaje_venta_vieja_format: getNumber(p['% venta vieja format']),
    acreditado_periodo_m: getText(p['Acreditado periodo M']),
    acreditado_periodo_y: getText(p['Acreditado periodo Y']),
    porcentaje_venta_vieja: getNumber(p['% venta vieja']),
    f_venta: getDate(p['F.venta']),
    f_transaccion_string: getText(p['F.transaccion string']),
    f_renovacion: getDate(p['F. renovacion']),
    f_renovacion_string: getText(p['F. Renovacion string'])
  };
}

async function sendToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};
  
  // Helper para extraer texto de Notion (Rich Text o Title)
  const getText = (prop) => prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || null;
  
  // Helper para extraer fórmula
  const getFormula = (prop) => {
    if (!prop?.formula) return null;
    if (prop.formula.type === 'string') return prop.formula.string;
    if (prop.formula.type === 'number') return prop.formula.number?.toString();
    return null;
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
    'GHL ID (fórmula raw)': p['GHL ID'],
    'GHL ID (extraído)': getFormula(p['GHL ID']) || getText(p['GHL ID']),
    'Identificador': getText(p['Identificador']),
    'Cliente': getText(p['Cliente']),
    'Comprobante': getText(p['Comprobante']),
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
      if (prop.type === 'formula') {
        console.log(`     Tipo de fórmula: ${prop.formula?.type || 'N/A'}`);
        console.log(`     Valor: ${getFormula(prop) || 'null'}`);
      } else if (prop.type === 'select') {
        console.log(`     Valor: ${prop.select?.name || 'null'}`);
      } else if (prop.type === 'rich_text' || prop.type === 'title') {
        console.log(`     Valor: ${getText(prop) || 'null'}`);
      } else if (prop.type === 'number') {
        console.log(`     Valor: ${prop.number ?? 'null'}`);
      } else {
        console.log(`     Valor completo:`, JSON.stringify(prop, null, 4));
      }
    } else {
      console.log(`\n  🔹 ${propName}: NO EXISTE en las propiedades`);
    }
  });
  
  const row = mapToSupabase(payload);
  
  // ========== DATOS MAPEADOS PARA SUPABASE ==========
  logSection('DATOS MAPEADOS PARA SUPABASE (COMPROBANTES)', row);
  
  // Validar que el ID sea válido antes de enviar
  if (!row.id || row.id === '') {
    logSection('❌ ERROR: ID INVÁLIDO - NO SE ENVIARÁ A SUPABASE', {
      'GHL ID recibido (fórmula)': getFormula(p['GHL ID']) || getText(p['GHL ID']),
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
    logSection('✅ ÉXITO: COMPROBANTE GUARDADO EN SUPABASE', {
      'Status HTTP': response.status,
      'Tiempo de respuesta': `${duration}ms`,
      'ID guardado': row.id,
      'Respuesta de Supabase': response.data,
      'Headers de respuesta': response.headers
    });
    
  } catch (err) {
    // ========== ERROR AL GUARDAR EN SUPABASE ==========
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