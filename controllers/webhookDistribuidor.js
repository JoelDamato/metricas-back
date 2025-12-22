const axios = require('axios');

const webhookUrls = ['/webhook3', '/webhookv2', '/csm', '/comprobantes'];
const queue = [];
let isProcessing = false;
let lastVerification = null;

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
                return { endpoint, success: true, data: response.data };
            } catch (error) {
                console.error(`❌ Error en ${endpoint}:`, error.message);
                return { endpoint, success: false, error: error.message };
            }
        });

        const results = await Promise.allSettled(promises);
        console.log("📊 Resultados:", results.map(r => {
            if (r.status === 'fulfilled') return `${r.value.endpoint}: ${r.value.success ? '✅' : '❌'}`;
            return `error: ${JSON.stringify(r.reason)}`;
        }));
    } catch (error) {
        console.error("❌ Error en distribución:", error);
    } finally {
        isProcessing = false;
        setImmediate(processQueue);
    }
}

exports.handleWebhook = async (req, res) => {
    const payload = req.body;
    console.log("📥 Recibido:", JSON.stringify(payload, null, 2));

    // Manejo de verificación
    if (payload && payload.challenge) {
        console.log('🔐 Challenge de verificación recibido:', payload.challenge);
        lastVerification = { type: 'challenge', value: payload.challenge, receivedAt: new Date().toISOString() };
        return res.status(200).send(payload.challenge);
    }

    if (payload && payload.code) {
        console.log('🔐 Código de verificación recibido:', payload.code);
        lastVerification = { type: 'code', value: payload.code, receivedAt: new Date().toISOString() };
        return res.status(200).json({ message: 'Código de verificación recibido', code: payload.code });
    }

    // Log del tipo de evento
    if (payload.type === 'page.deleted') {
        console.log(`🗑️ Evento de borrado detectado. ID: ${payload.entity?.id}`);
    }

    res.status(200).json({ 
        message: "Webhook recibido y encolado",
        timestamp: new Date().toISOString()
    });
    
    queue.push({ payload });
    processQueue();
};

exports.getLastVerification = (req, res) => {
    if (!lastVerification) return res.status(404).json({ message: 'No hay verificaciones registradas aún.' });
    return res.status(200).json(lastVerification);
};