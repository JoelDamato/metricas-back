const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// URL de tu App Script desplegado como endpoint web
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbzbjJ8jT6XYDbwls0zWcCJzaerciuqsII9KU9oWXY8t5tVfXz-vZ9DNuqoSFYB2J4jmFg/exec";

// Cola en memoria para los envíos
const queue = [];
let isProcessing = false;

function mapToSupabase(payload) {
  const p = payload.properties || {};

  return {
    id: payload.id,
    created_time: payload.created_time,
    last_edited_time: payload.last_edited_time,
    archived: payload.archived ?? false,

    origen: p.Origen?.select?.name ?? null,
    primer_origen: p['Primer origen']?.select?.name ?? null,

    utm_source: p.Utm_source?.rich_text?.[0]?.plain_text ?? null,
    utm_medium: p.Utm_medium?.rich_text?.[0]?.plain_text ?? null,
    utm_campaign: p.Utm_campaign?.rich_text?.[0]?.plain_text ?? null,
    utm_content: p.Utm_content?.rich_text?.[0]?.plain_text ?? null,
    utm_term: p.Utm_term?.rich_text?.[0]?.plain_text ?? null,

    etapa: p.Etapa?.select?.name ?? null,
    temperatura: p.Temperatura?.select?.name ?? null,
    calidad_lead: p['Calidad del lead']?.select?.name ?? null,

    aplica: p.Aplica?.checkbox ?? null,
    lista_negra: p['Lista negra']?.checkbox ?? null,
    recuperado: p.Recuperado?.checkbox ?? null,
    cliente_viejo: p['Cliente viejo']?.checkbox ?? null,

    responsable: p.Responsable?.people?.[0]?.name ?? null,
    responsable_id: p['ID responsable']?.rich_text?.[0]?.plain_text ?? null,

    telefono: p.Telefono?.phone_number ?? null,
    mail: p.Mail?.email ?? null,
    whatsapp: p.WhatsApp?.phone_number ?? null,
    instagram: p.Instagram?.url ?? null,
    usuario_ig: p['Usuario IG']?.rich_text?.[0]?.plain_text ?? null,
    dni: p.Dni?.rich_text?.[0]?.plain_text ?? null,

    facturacion: p.Facturacion?.number ?? null,
    facturacion_total: p['Facturacion total']?.number ?? null,
    cash_collected_total: p['Cash collected total']?.number ?? null,
    saldo: p.Saldo?.number ?? null,
    inversion: p.Inversion?.number ?? null,

    modelo_negocio: p['Modelo de negocio']?.select?.name ?? null,

    extra: payload
  };
}
async function sendToSupabase(payload) {
  const row = mapToSupabase(payload);

  try {
    await axios.post(
      `${SUPABASE_URL}/rest/v1/leads_raw`,
      row,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        params: {
          on_conflict: 'id'
        }
      }
    );

    console.log('✅ Enviado a Supabase');
  } catch (err) {
    console.error(
      '❌ Error Supabase:',
      err.response?.data || err.message
    );
  }
}


// Función para procesar la cola uno por uno
async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;

  const { payload } = queue.shift();

  try {
    console.log("⏳ Enviando a Google Sheets");
    await axios.post(googleScriptUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    console.log("⏳ Enviando a Supabase");
    await sendToSupabase(payload);

    console.log("✅ Enviado correctamente a Sheets y Supabase");
  } catch (error) {
    console.error("❌ Error en el envío:", error.message);
  } finally {
    isProcessing = false;
    setImmediate(processQueue); // procesa el siguiente
  }
}


// Handler del webhook
exports.handleWebhook = async (req, res) => {
  const payload = req.body;

  console.log("📥 Webhook recibido de notion:", payload);

  // Responder rápido al cliente (Notion u otro)
  res.status(200).json({ message: "Webhook recibido y encolado para envío a Google Sheets." });

  // Agregar a la cola para envío asincrónico
  queue.push({ payload });
  processQueue();
};
