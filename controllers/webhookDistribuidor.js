const axios = require('axios');

// 🆕 URLs COMPLETAS directamente
const webhookUrls = [
    'https://metricas-back-eylj.onrender.com/api/webhook3',
    'https://metricas-back-eylj.onrender.com/api/webhookv2',
    'https://metricas-back-eylj.onrender.com/api/csm',
    'https://metricas-back-eylj.onrender.com/api/comprobantes'
];

const queue = [];
let isProcessing = false;
let lastVerification = null;

async function processQueue() {
    if (isProcessing || queue.length === 0) return;
    
    isProcessing = true;
    const { payload } = queue.shift();

    console.log("\n🔄 ========================================");
    console.log("🔄 INICIANDO DISTRIBUCIÓN");
    console.log("🔄 ========================================");
    console.log("📦 Payload a distribuir:", JSON.stringify(payload, null, 2));
    console.log("🎯 Endpoints destino:", webhookUrls);
    console.log("🔄 ========================================\n");

    try {
        const promises = webhookUrls.map(async (url) => {
            console.log(`\n📤 Intentando enviar a: ${url}`);
            
            try {
                const response = await axios.post(url, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                });
                
                console.log(`✅ ÉXITO en ${url}`);
                console.log(`📊 Status: ${response.status}`);
                console.log(`📄 Response data:`, JSON.stringify(response.data, null, 2));
                
                return { url, success: true, data: response.data, status: response.status };
            } catch (error) {
                console.log(`❌ FALLO en ${url}`);
                console.log(`⚠️ Error message:`, error.message);
                
                if (error.response) {
                    console.log(`📊 Response status:`, error.response.status);
                    console.log(`📄 Response data:`, JSON.stringify(error.response.data, null, 2));
                    console.log(`📋 Response headers:`, error.response.headers);
                } else if (error.request) {
                    console.log(`🔌 No response received`);
                } else {
                    console.log(`⚙️ Error en setup:`, error.message);
                }
                
                return { 
                    url, 
                    success: false, 
                    error: error.message,
                    status: error.response?.status || 'NO_RESPONSE'
                };
            }
        });

        console.log("\n⏳ Esperando respuestas de todos los endpoints...\n");
        const results = await Promise.allSettled(promises);
        
        console.log("\n📊 ========================================");
        console.log("📊 RESUMEN DE DISTRIBUCIÓN");
        console.log("📊 ========================================");
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const value = result.value;
                const statusEmoji = value.success ? '✅' : '❌';
                console.log(`${statusEmoji} ${value.url}:`);
                console.log(`   └─ Success: ${value.success}`);
                console.log(`   └─ Status: ${value.status || value.error}`);
                if (value.data) {
                    console.log(`   └─ Data:`, JSON.stringify(value.data, null, 2));
                }
            } else {
                console.log(`💥 ${webhookUrls[index]}: PROMISE REJECTED`);
                console.log(`   └─ Reason:`, result.reason);
            }
        });
        
        console.log("📊 ========================================\n");
        
        // Resumen simple
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failCount = results.length - successCount;
        console.log(`📈 Resultados: ${successCount} exitosos, ${failCount} fallidos de ${results.length} totales\n`);
        
    } catch (error) {
        console.error("\n💥 ========================================");
        console.error("💥 ERROR CRÍTICO EN DISTRIBUCIÓN");
        console.error("💥 ========================================");
        console.error("❌ Error:", error.message);
        console.error("📚 Stack:", error.stack);
        console.error("💥 ========================================\n");
    } finally {
        isProcessing = false;
        console.log("🔄 Distribución finalizada. Procesando siguiente en cola...\n");
        setImmediate(processQueue);
    }
}

exports.handleWebhook = async (req, res) => {
    const payload = req.body;
    
    console.log("\n🎯 ========================================");
    console.log("🎯 DISTRIBUIDOR - WEBHOOK RECIBIDO");
    console.log("🎯 ========================================");
    console.log("🕐 Timestamp:", new Date().toISOString());
    console.log("📥 Payload recibido:", JSON.stringify(payload, null, 2));
    console.log("🎯 ========================================\n");

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

    // Análisis del payload
    console.log("🔍 ANÁLISIS DEL PAYLOAD:");
    console.log("   ├─ Type:", payload.type || 'NO ESPECIFICADO');
    console.log("   ├─ Entity ID:", payload.entity?.id || 'NO DISPONIBLE');
    console.log("   ├─ Data object:", payload.data?.object || 'NO DISPONIBLE');
    console.log("   └─ Integration ID:", payload.integration_id || 'NO DISPONIBLE');

    // Detección de tipo de evento
    if (payload.type === 'page.deleted') {
        console.log(`\n🗑️ ========================================`);
        console.log(`🗑️ EVENTO DE BORRADO DETECTADO`);
        console.log(`🗑️ ========================================`);
        console.log(`🆔 ID a borrar: ${payload.entity?.id}`);
        console.log(`📍 Parent database: ${payload.data?.parent?.id || 'NO ESPECIFICADO'}`);
        console.log(`🗑️ ========================================\n`);
    } else if (payload.data && payload.data.object === 'page') {
        console.log(`\n📝 ========================================`);
        console.log(`📝 EVENTO DE CREAR/ACTUALIZAR DETECTADO`);
        console.log(`📝 ========================================`);
        console.log(`🆔 Page ID: ${payload.data?.id || 'NO ESPECIFICADO'}`);
        console.log(`📝 ========================================\n`);
    } else {
        console.log(`\n❓ ========================================`);
        console.log(`❓ TIPO DE EVENTO NO RECONOCIDO`);
        console.log(`❓ ========================================`);
        console.log(`⚠️ Este payload podría no ser procesado correctamente`);
        console.log(`❓ ========================================\n`);
    }

    // Responder al cliente
    res.status(200).json({ 
        message: "Webhook recibido y encolado para distribución",
        timestamp: new Date().toISOString(),
        eventType: payload.type || 'unknown',
        willDistributeTo: webhookUrls
    });
    
    console.log("✅ Respuesta 200 enviada al cliente (Notion)");
    console.log("📋 Encolando payload para distribución...");
    
    queue.push({ payload });
    console.log(`📊 Items en cola: ${queue.length}\n`);
    
    processQueue();
};

exports.getLastVerification = (req, res) => {
    if (!lastVerification) return res.status(404).json({ message: 'No hay verificaciones registradas aún.' });
    return res.status(200).json(lastVerification);
};