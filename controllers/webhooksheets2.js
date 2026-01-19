const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// URL de tu App Script desplegado como endpoint web
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbzbjJ8jT6XYDbwls0zWcCJzaerciuqsII9KU9oWXY8t5tVfXz-vZ9DNuqoSFYB2J4jmFg/exec";

// Cola en memoria para los envíos
const queue = [];
let isProcessing = false;

/**
 * Mapea el payload de entrada al formato de la tabla leads_raw de Supabase
 */
function mapToSupabase(payload) {
  // CORRECCIÓN: Notion a veces envía los datos dentro de 'data'. 
  // Si existe payload.data, usamos eso. Si no, usamos el payload raíz.
  const data = payload.data || payload;
  const p = data.properties || {};

  return {
    // Campos principales
    id: data.id, // Ahora no será null
    created_time: data.created_time,
    last_edited_time: data.last_edited_time,
    archived: data.archived ?? false,

    // Selects
    origen: p.Origen?.select?.name ?? null,
    primer_origen: p['Primer origen']?.select?.name ?? null,

    // UTMs (Rich Text)
    utm_source: p.Utm_source?.rich_text?.[0]?.plain_text ?? null,
    utm_medium: p.Utm_medium?.rich_text?.[0]?.plain_text ?? null,
    utm_campaign: p.Utm_campaign?.rich_text?.[0]?.plain_text ?? null,
    utm_content: p.Utm_content?.rich_text?.[0]?.plain_text ?? null,
    utm_term: p.Utm_term?.rich_text?.[0]?.plain_text ?? null,

    // Clasificación
    etapa: p.Etapa?.select?.name ?? null,
    temperatura: p.Temperatura?.select?.name ?? null,
    calidad_lead: p['Calidad del lead']?.select?.name ?? null,

    // Checkboxes
    aplica: p.Aplica?.checkbox ?? null,
    lista_negra: p['Lista negra']?.checkbox ?? null,
    recuperado: p.Recuperado?.checkbox ?? null,
    cliente_viejo: p['Cliente viejo']?.checkbox ?? null,

    // Responsable
    responsable: p.Responsable?.people?.[0]?.name ?? null,
    responsable_id: p['ID responsable']?.rich_text?.[0]?.plain_text ?? null,

    // Contacto
    telefono: p.Telefono?.phone_number ?? null,
    mail: p.Mail?.email ?? null,
    whatsapp: p.WhatsApp?.phone_number ?? null,
    instagram: p.Instagram?.url ?? null,
    usuario_ig: p['Usuario IG']?.rich_text?.[0]?.plain_text ?? null,
    dni: p.Dni?.rich_text?.[0]?.plain_text ?? null,

    // Números
    facturacion: p.Facturacion?.number ?? null,
    facturacion_total: p['Facturacion total']?.number ?? null,
    cash_collected_total: p['Cash collected total']?.number ?? null,
    saldo: p.Saldo?.number ?? null,
    inversion: p.Inversion?.number ?? null,

    // Otros
    modelo_negocio: p['Modelo de negocio']?.select?.name ?? null,

    // Guardamos el payload original completo en la columna JSONB 'extra'
    extra: payload
  };
}

async function sendToSupabase(payload) {
  const row = mapToSupabase(payload);

  // Debug log para verificar que el ID ya no es null antes de enviar
  console.log(`Attempting Supabase insert for ID: ${row.id}`);

  try {
    await axios.post(
      `${SUPABASE_URL}/rest/v1/leads_raw`,
      row,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates' // Esto hace que si el ID ya existe, lo actualice
        },
        params: {
          on_conflict: 'id'
        }
      }
    );

    console.log('✅ Enviado a Supabase correctamente');
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
    // 1. Enviar a Google Sheets
    console.log("⏳ Enviando a Google Sheets...");
    await axios.post(googleScriptUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log("✅ Google Sheets OK");

    // 2. Enviar a Supabase
    console.log("⏳ Enviando a Supabase...");
    await sendToSupabase(payload);

  } catch (error) {
    console.error("❌ Error en el flujo de envío:", error.message);
  } finally {
    isProcessing = false;
    // Procesar el siguiente en la cola si existe
    if (queue.length > 0) {
      setImmediate(processQueue);
    }
  }
}

// Handler del webhook
exports.handleWebhook = async (req, res) => {
  const payload = req.body;

  console.log("📥 Webhook recibido de Notion");

  // Responder rápido al emisor para evitar timeouts
  res.status(200).json({ message: "Payload recibido y encolado." });

  // Agregar a la cola para proceso asincrónico
  queue.push({ payload });
  processQueue();
};