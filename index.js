// index.js (Versión final corregida para Local y Render)

// --- 1. IMPORTACIONES ---
const express = require('express');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const puppeteer = require('puppeteer');

// --- 2. INICIAR SERVIDOR EXPRESS Y MIDDLEWARES ---
const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());

// --- 3. LÓGICA DEL BOT DE WHATSAPP ---
console.log('Iniciando configuración del bot de WhatsApp...');

// --- Configuración dinámica de Puppeteer ---
const puppeteerOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
};

// --- Configuración dinámica de la ruta de la sesión ---
let dataPath;

if (process.env.NODE_ENV === 'production') {
    // Configuración para Render (Producción)
    console.log('Usando configuración para Render...');
    puppeteerOptions.executablePath = puppeteer.executablePath();
    dataPath = '/var/data';
} else {
    // Configuración para Local (tu Mac)
    console.log('Usando configuración para Mac local...');
    puppeteerOptions.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    dataPath = 'wa-session'; // Carpeta local sin permisos especiales
}

// --- Creación del cliente de WhatsApp ---
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: dataPath }), // <-- Usamos la ruta dinámica
    puppeteer: puppeteerOptions
});

let isReady = false;

client.on('qr', (qr) => {
    console.log('📱 Escaneá este QR con tu celular.');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    isReady = true;
    console.log('✅ Bot listo y conectado a WhatsApp.');
});

client.on('disconnected', (reason) => {
    console.log('🔌 Cliente de WhatsApp desconectado:', reason);
    isReady = false;
    client.initialize();
});

// Inicializar el cliente.
client.initialize();

// --- 4. RUTAS DE LA API ---

// Tus rutas existentes
const otrasRutas = require('./routes/rutas');
app.use('/', otrasRutas);

// Ruta para enviar mensajes con el bot
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    console.log(`Petición de WhatsApp recibida para enviar a: ${number}`);
    
    if (!isReady) {
        return res.status(503).json({ success: false, error: 'El bot no está listo todavía.' });
    }
    if (!number || !message) {
        return res.status(400).json({ success: false, error: 'Faltan los parámetros "number" o "message".' });
    }
    try {
        const chatId = `549${number}@c.us`;
        await client.sendMessage(chatId, message);
        console.log(`📤 Mensaje de WhatsApp enviado exitosamente a ${number}`);
        res.status(200).json({ success: true, message: `Mensaje enviado a ${number}` });
    } catch (error) {
        console.error(`❌ Error al enviar mensaje de WhatsApp a ${number}:`, error);
        res.status(500).json({ success: false, error: 'Error interno al procesar el envío.' });
    }
});

// --- 5. INICIAR SERVIDOR ---
const PORT = process.env.PORT || 30003;
app.listen(PORT, () => {
  console.log(`🚀 Servidor API unificado escuchando en el puerto ${PORT}`);
});