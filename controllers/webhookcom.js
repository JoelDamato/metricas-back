const axios = require('axios');

// URL de tu App Script desplegado como endpoint web
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbxij3VPCpyGs3-adtVGEjzC1rVd9tgDyGs19_ChKUo5SytA_-K_pz_vghfFBQSVh6ZdHg/exec";

// Cola en memoria para los envíos
const queue = [];
let isProcessing = false;

// Función para procesar la cola uno por uno
async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;

  const { payload } = queue.shift();

  try {
    console.log("⏳ Enviando a Google Sheets...");
    console.log("📦 Payload completo:", JSON.stringify(payload, null, 2));
    console.log("🔍 Tipo de evento:", payload.type);
    console.log("🆔 Entity ID:", payload.entity?.id);

    const response = await axios.post(googleScriptUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    console.log("✅ Respuesta de Google Sheets:", JSON.stringify(response.data, null, 2));
    console.log("📊 Status code:", response.status);
  } catch (error) {
    console.error("❌ Error al enviar a Google Sheets:", error.message);
    
    if (error.response) {
      console.error("📄 Response status:", error.response.status);
      console.error("📄 Response data:", JSON.stringify(error.response.data, null, 2));
      console.error("📄 Response headers:", error.response.headers);
    } else if (error.request) {
      console.error("🔌 No se recibió respuesta del servidor");
      console.error("🔌 Request enviado:", error.request);
    } else {
      console.error("⚙️ Error en configuración:", error.message);
    }
  } finally {
    isProcessing = false;
    console.log("🔄 Procesamiento finalizado, siguiente en cola...");
    setImmediate(processQueue); // Procesar el siguiente en la cola
  }
}

// Handler del webhook
exports.handleWebhook = async (req, res) => {
  const payload = req.body;

  console.log("\n========================================");
  console.log("📥 COMPROBANTES - Webhook recibido");
  console.log("========================================");
  console.log("🕐 Timestamp:", new Date().toISOString());
  console.log("📦 Payload completo:", JSON.stringify(payload, null, 2));
  console.log("🔍 Tipo de evento:", payload.type || 'NO ESPECIFICADO');
  console.log("🆔 Entity ID:", payload.entity?.id || 'NO DISPONIBLE');
  console.log("📊 Data object:", payload.data?.object || 'NO DISPONIBLE');
  console.log("========================================\n");

  // Validar que el payload tenga contenido
  if (!payload || Object.keys(payload).length === 0) {
    console.warn("⚠️ Payload vacío recibido");
  }

  // Detectar tipo de operación
  if (payload.type === 'page.deleted') {
    console.log("🗑️ Operación detectada: BORRAR página");
  } else if (payload.data && payload.data.object === 'page') {
    console.log("📝 Operación detectada: CREAR/ACTUALIZAR página");
  } else {
    console.log("❓ Operación NO RECONOCIDA");
  }

  // Responder rápido al cliente (Notion u otro)
  res.status(200).json({ 
    message: "Webhook recibido y encolado para envío a Google Sheets.",
    receivedAt: new Date().toISOString(),
    eventType: payload.type || 'unknown',
    entityId: payload.entity?.id || 'unknown'
  });

  console.log("✅ Respuesta 200 enviada al cliente");
  console.log("📋 Agregando a cola de procesamiento...");

  // Agregar a la cola para envío asincrónico
  queue.push({ payload });
  console.log("📊 Items en cola:", queue.length);
  
  processQueue();
};