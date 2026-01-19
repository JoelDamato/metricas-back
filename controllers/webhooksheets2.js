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

    // Checkboxes / Booleanos
    aplica: p['Aplica']?.checkbox ?? null,
    lista_negra: p['Lista negra']?.checkbox ?? null,
    recuperado: p['Recuperado']?.checkbox ?? null,
    cliente_viejo: p['Cliente viejo']?.checkbox ?? null,
    agendo: p['Agendo']?.checkbox ?? null,

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
  const row = mapToSupabase(payload);
  console.log(`🚀 Enviando Lead: ${row.nombre || 'Sin nombre'} (${row.id})`);

  try {
    await axios.post(`${SUPABASE_URL}/rest/v1/leads_raw`, row, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      params: { on_conflict: 'id' }
    });
    console.log('✅ Supabase actualizado');
  } catch (err) {
    console.error('❌ Error Supabase Detail:', err.response?.data || err.message);
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
  res.status(200).json({ status: "ok" });
  queue.push({ payload: req.body });
  processQueue();
};