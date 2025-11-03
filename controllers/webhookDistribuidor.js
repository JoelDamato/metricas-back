const axios = require('axios');

const webhookUrls = ['/webhook3', '/webhookv2', '/csm', '/comprobantes'];
const queue = [];
let isProcessing = false;

async function processQueue() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;
    const { payload } = queue.shift();

    try {
        const baseUrl = `${process.env.BASE_URL || 'https://metricas-back.onrender.com/api'}`;
        const promises = webhookUrls.map(async (endpoint) => {
            try {
                const url = `${baseUrl}${endpoint}`;
                const response = await axios.post(url, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                });
                console.log(`✅ Enviado a ${endpoint}:`, response.data);
                return { endpoint, success: true };
            } catch (error) {
                console.error(`❌ Error en ${endpoint}:`, error.message);
                return { endpoint, success: false, error: error.message };
            }
        });

        const results = await Promise.allSettled(promises);
        console.log("📊 Resultados:", results.map(r => `${r.value.endpoint}: ${r.value.success ? '✅' : '❌'}`));
    } catch (error) {
        console.error("❌ Error en distribución:", error);
    } finally {
        isProcessing = false;
        setImmediate(processQueue);
    }
}

exports.handleWebhook = async (req, res) => {
    const payload = req.body;
    console.log("📥 Recibido:", payload);
    res.status(200).json({ 
        message: "Webhook recibido y encolado",
        timestamp: new Date().toISOString()
    });
    queue.push({ payload });
    processQueue();
};