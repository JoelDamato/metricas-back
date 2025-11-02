const axios = require('axios');

// URL de tu App Script desplegado como endpoint web
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbxbmQwhuABL8Fg3F4ucHXftVaA1v0HAFib2QLz7jRUTNbwUI7Pb7HIDlU6JB6exg6K2/exec";

// Cola en memoria para los envíos
const queue = [];
let isProcessing = false;

// Función para procesar la cola uno por uno
async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;

  const { payload } = queue.shift();

  try {
    console.log("⏳ Enviando a Google Sheets:", payload);

    const response = await axios.post(googleScriptUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    console.log("✅ Enviado correctamente:", response.data);
  } catch (error) {
    console.error("❌ Error al enviar a Google Sheets:", error.message);
  } finally {
    isProcessing = false;
    setImmediate(processQueue); // Procesar el siguiente en la cola
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
