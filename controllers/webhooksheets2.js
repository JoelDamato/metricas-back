const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbzbjJ8jT6XYDbwls0zWcCJzaerciuqsII9KU9oWXY8t5tVfXz-vZ9DNuqoSFYB2J4jmFg/exec";

const queue = [];
let isProcessing = false;

function mapToSupabase(payload) {
  const data = payload.data || payload;
  const p = data.properties || {};

  // Helper para extraer texto de Notion (Rich Text o Title)
  const getText = (prop) => prop?.rich_text?.[0]?.plain_text || prop?.title?.[0]?.plain_text || null;

  return {
    id: data.id,
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

    aplica: getText(p['Aplica']),
    lista_negra: getText(p['Lista negra']),
    recuperado: getText(p['Recuperado']),
    cliente_viejo: getText(p['Cliente viejo']),
    agendo: p['Agendo']?.select?.name ?? null,

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
  
  // Log de cómo llegan las propiedades desde Notion
  console.log("\n🔍 === ESTRUCTURA ORIGINAL DE NOTION ===");
  console.log("📋 Propiedad 'Aplica' completa:", JSON.stringify(p['Aplica'], null, 2));
  console.log("📋 Propiedad 'Lista negra' completa:", JSON.stringify(p['Lista negra'], null, 2));
  console.log("📋 Propiedad 'Agendo' completa:", JSON.stringify(p['Agendo'], null, 2));
  console.log("📋 Tipo de propiedad 'Aplica':", p['Aplica']?.type);
  console.log("📋 Tipo de propiedad 'Lista negra':", p['Lista negra']?.type);
  console.log("📋 Tipo de propiedad 'Agendo':", p['Agendo']?.type);
  
  const row = mapToSupabase(payload);
  
  console.log("\n🔄 === OBJETO MAPEADO (antes de enviar) ===");
  console.log("📤 Campos mapeados:");
  console.log("  - aplica:", row.aplica, "tipo:", typeof row.aplica);
  console.log("  - lista_negra:", row.lista_negra, "tipo:", typeof row.lista_negra);
  console.log("  - recuperado:", row.recuperado, "tipo:", typeof row.recuperado);
  console.log("  - cliente_viejo:", row.cliente_viejo, "tipo:", typeof row.cliente_viejo);
  console.log("  - agendo:", row.agendo, "tipo:", typeof row.agendo);
  console.log(`\n🚀 Enviando Lead: ${row.nombre || 'Sin nombre'} (${row.id})`);
  console.log("📦 Objeto completo a enviar a Supabase:", JSON.stringify(row, null, 2));

  try {
    const response = await axios.post(`${SUPABASE_URL}/rest/v1/leads_raw`, row, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      params: { on_conflict: 'id' }
    });
    console.log('\n✅ Supabase actualizado exitosamente');
    console.log("📥 Respuesta de Supabase:", JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('\n❌ Error Supabase Detail:', err.response?.data || err.message);
    console.error("📤 Lo que intentamos enviar:", JSON.stringify(row, null, 2));
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
  } finally {
    isProcessing = false;
    if (queue.length > 0) setImmediate(processQueue);
  }
}

exports.handleWebhook = async (req, res) => {
  console.log("📥 Webhook recibido");
  console.log("📦 Payload original completo:", JSON.stringify(req.body, null, 2));
  res.status(200).json({ status: "ok" });
  queue.push({ payload: req.body });
  processQueue();
};