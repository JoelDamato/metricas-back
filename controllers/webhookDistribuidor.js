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

// Supabase config y tablas a borrar
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseTablesToDelete = ['leads_raw', 'csm', 'comprobantes'];

// Helper: stringify seguro para objetos con ciclos
function safeStringify(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, function(key, value) {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
        }
        return value;
    });
}

// Helper: hora actual de Argentina (UTC-3) en ISO sin milisegundos
function argentinaNowISO() {
    const now = new Date();
    const argentinaNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000) - (3 * 60 * 60 * 1000));
    return argentinaNow.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Función para guardar logs en Supabase desde el distribuidor
async function saveLog(logData) {
    try {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            console.warn('⚠️ Supabase no configurado, no se guardará el log');
            return;
        }

        const processed = { ...logData };
        if (processed.payload && typeof processed.payload !== 'string') {
            try { processed.payload = safeStringify(processed.payload); } catch (e) { processed.payload = String(processed.payload); }
        }
        if (processed.attempted_data && typeof processed.attempted_data !== 'string') {
            try { processed.attempted_data = safeStringify(processed.attempted_data); } catch (e) { processed.attempted_data = String(processed.attempted_data); }
        }
        if (processed.supabase_error && typeof processed.supabase_error !== 'string') {
            try { processed.supabase_error = safeStringify(processed.supabase_error); } catch (e) { processed.supabase_error = String(processed.supabase_error); }
        }

        if (!Object.prototype.hasOwnProperty.call(processed, 'created_at')) {
            processed.created_at = argentinaNowISO();
        }

        await axios.post(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/webhook_logs`, processed, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('📝 Log guardado en Supabase (distribuidor)');
    } catch (err) {
        console.error('❌ Error guardando log en Supabase (distribuidor):', err.message);
    }
}

// Función que borra registros en Supabase por GHL ID o Notion ID en las tablas listadas
async function deleteByGhlId(ghlId, notionId) {
    // Si no hay ningún id para buscar, retornar vacío
    if (!ghlId && !notionId) return [];
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.warn('⚠️ Supabase no configurado (SUPABASE_URL/SUPABASE_KEY)');
        return [];
    }

    const results = [];
    // Para evitar queries duplicadas por la misma expresión
    const triedFilters = new Set();

    for (const table of supabaseTablesToDelete) {
        // Construir lista de posibles filtros por prioridad
        const filters = [];
        if (ghlId) {
            // En tu esquema, el GHL ID puede estar guardado en la columna `ghl_id` o directamente en `id`
            filters.push({ col: 'ghl_id', val: ghlId });
            filters.push({ col: 'id', val: ghlId });
        }
        // Si recibimos notionId explícito, intentarlo también contra `id`
        if (notionId) {
            filters.push({ col: 'id', val: notionId });
        }

        // Ejecutar cada filtro (si no se repite)
        for (const f of filters) {
            const filterKey = `${table}::${f.col}::${f.val}`;
            if (triedFilters.has(filterKey)) continue;
            triedFilters.add(filterKey);

            try {
                const safeVal = String(f.val).replace(/'/g, "''");
                const filter = `${f.col}=eq.'${safeVal}'`;
                const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?${filter}`;

                console.log(`🗑️ Intentando DELETE en tabla ${table} con filtro ${filter}`);
                const res = await axios.delete(url, {
                    headers: {
                        apikey: SUPABASE_KEY,
                        Authorization: `Bearer ${SUPABASE_KEY}`
                    }
                });

                results.push({ table, filter: filter, success: true, status: res.status, data: res.data });
                console.log(`🗑️ Supabase: borrado en tabla ${table}, status ${res.status}`);
            } catch (err) {
                console.error(`❌ Error borrando en tabla ${table} con filtro ${f.col}:`, err.response?.data || err.message);
                results.push({ table, filter: `${f.col}=eq.'${String(f.val)}'`, success: false, error: err.response?.data || err.message, status: err.response?.status });
            }
        }
    }

    return results;
}

// Función que borra registros en Supabase por notionid en las tablas listadas
async function deleteByNotionId(notionId) {
    if (!notionId) return [];
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.warn('⚠️ Supabase no configurado (SUPABASE_URL/SUPABASE_KEY)');
        return [];
    }

    const results = [];
    for (const table of supabaseTablesToDelete) {
        try {
            const safeVal = String(notionId).replace(/'/g, "''");
            const filter = `notionid=eq.'${safeVal}'`;
            const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?${filter}`;

            console.log(`🗑️ Intentando DELETE en tabla ${table} con filtro ${filter}`);
            const res = await axios.delete(url, {
                headers: {
                    apikey: SUPABASE_KEY,
                    Authorization: `Bearer ${SUPABASE_KEY}`
                }
            });

            results.push({ table, filter, success: true, status: res.status, data: res.data });
            console.log(`🗑️ Supabase: borrado en tabla ${table}, status ${res.status}`);
        } catch (err) {
            console.error(`❌ Error borrando en tabla ${table} con filtro notionid:`, err.response?.data || err.message);
            results.push({ table, filter: `notionid=eq.'${String(notionId)}'`, success: false, error: err.response?.data || err.message, status: err.response?.status });
        }
    }
    return results;
}

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
        
        // Llamada no bloqueante a Supabase para borrar por ghl_id
        (async () => {
            const ghlId = payload.entity?.id;
            const notionId = payload.data?.id;
            console.log(`🔄 Iniciando proceso de borrado en Supabase para GHL ID: ${ghlId} notionId: ${notionId}`);
            const deleteResults = await deleteByNotionId(notionId);
            console.log(`🔄 Proceso de borrado en Supabase finalizado. Resultados:`, deleteResults);
            // Guardar log de borrado
            try {
                await saveLog({ event_type: 'delete', payload: { ghlId, notionId }, deleteResults });
            } catch (e) {
                console.error('❌ Error guardando log de borrado:', e.message);
            }
        })();
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
    
    // Guardar log no bloqueante
    (async () => {
        try {
            console.log('🔍 DEBUG - guardando payload en Supabase logs');
            await saveLog({
                event_type: payload.type || 'unknown',
                payload,
                received_at: new Date().toISOString()
            });
            console.log('🔍 DEBUG - payload guardado en Supabase logs');
        } catch (e) {
            console.error('❌ Error guardando log no bloqueante:', e.message);
        }
    })();

    processQueue();
};

exports.getLastVerification = (req, res) => {
    if (!lastVerification) return res.status(404).json({ message: 'No hay verificaciones registradas aún.' });
    return res.status(200).json(lastVerification);
};