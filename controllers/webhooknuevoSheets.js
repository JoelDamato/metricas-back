const axios = require('axios');

const googleScriptUrl = "https://script.google.com/macros/s/AKfycbxB1MLI3SwgmfCW9pDAmAe1dI2HUbnGak-NGUGyVpbNxqqDcNjym4LVcJgzjOJ5kLVNcA/exec";

// Cola en memoria para almacenar las tareas entrantes
const queue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;
  const { payload, resolve, reject } = queue.shift();

  try {
    console.log("⏳ Enviando datos a Google Sheets:", payload);

    const response = await axios.post(googleScriptUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    console.log("✅ Enviado correctamente:", response.data);
    resolve(response.data);
  } catch (error) {
    console.error("❌ Error enviando a Google Sheets:", error.message);
    reject(error);
  } finally {
    isProcessing = false;
    // Procesar siguiente en cola
    setImmediate(processQueue); // o setTimeout(processQueue, 0);
  }
}

exports.handleWebhook = async (req, res) => {
  const payload = req.body;
  console.log("📥 Webhook recibido para cola:", payload);

  // Usamos una Promise para saber cuándo termina de procesarse este item
  await new Promise((resolve, reject) => {
    queue.push({ payload, resolve, reject });
    processQueue();
  });

  res.status(200).json({ message: "Webhook recibido y encolado para envío a Google Sheets." });
};
