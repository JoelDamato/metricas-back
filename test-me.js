// index.js (para correr en tu Mac localmente)

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

// --- 1. INICIAR SERVIDOR EXPRESS ---
const app = express();
app.use(express.json());

// --- 2. CONFIGURACIÓN DEL CLIENTE DE WHATSAPP ---

// Ruta al Google Chrome instalado en tu Mac
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: 'wa-session' }),
    puppeteer: {
        headless: true,
        executablePath: chromePath, // <-- LA CLAVE: Usar tu Chrome local
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Variable para verificar el estado de conexión del cliente
let isReady = false;

console.log('Iniciando bot...');

// Evento para generar el QR la primera vez
client.on('qr', (qr) => {
    console.log('📱 Escaneá este QR con tu celular.');
    qrcode.generate(qr, { small: true });
});

// Evento cuando el cliente está listo para usarse
client.on('ready', () => {
    isReady = true;
    console.log('✅ Bot listo y conectado a WhatsApp.');
});

// Evento en caso de fallo de autenticación
client.on('auth_failure', msg => {
    console.error('❌ Fallo de autenticación:', msg);
});

// Evento si el cliente se desconecta
client.on('disconnected', (reason) => {
    console.log('🔌 Cliente desconectado:', reason);
    isReady = false;
    client.initialize();
});

// Inicializar el cliente de WhatsApp
client.initialize();


// --- 3. DEFINICIÓN DE ENDPOINTS (RUTAS DE LA API) ---
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    console.log(`Petición recibida para enviar a: ${number}`);
    if (!isReady) {
        return res.status(503).json({ success: false, error: 'El bot no está listo todavía.' });
    }
    if (!number || !message) {
        return res.status(400).json({ success: false, error: 'Faltan los parámetros "number" o "message".' });
    }
    try {
        const chatId = `549${number}@c.us`;
        await client.sendMessage(chatId, message);
        console.log(`📤 Mensaje enviado exitosamente a ${number}`);
        res.status(200).json({ success: true, message: `Mensaje enviado a ${number}` });
    } catch (error) {
        console.error(`❌ Error al enviar mensaje a ${number}:`, error);
        res.status(500).json({ success: false, error: 'Error interno al procesar el envío.' });
    }
});


// --- 4. INICIAR SERVIDOR PARA ESCUCHAR PETICIONES ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor API escuchando en el puerto ${PORT}`);
});