// index.js (Versión final corregida para Local y Render)

// --- 1. IMPORTACIONES ---
const express = require('express');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();

// --- 2. INICIAR SERVIDOR EXPRESS Y MIDDLEWARES ---
const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());

// --- 3. VARIABLES GLOBALES ---
let client = null;
let isReady = false;

// --- 4. LÓGICA DEL BOT DE WHATSAPP (CONDICIONAL) ---
if (process.env.ENABLE_WHATSAPP !== 'false') {
    console.log('Iniciando configuración del bot de WhatsApp...');
    
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const qrcode = require('qrcode-terminal');
    const puppeteer = require('puppeteer');

    // --- Configuración dinámica de Puppeteer ---
    const puppeteerOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    };

    // --- Configuración dinámica de la ruta de la sesión ---
    let dataPath;

    if (process.env.NODE_ENV === 'production') {
        // Configuración para Render (Producción)
        console.log('Usando configuración para Render...');
        // No especificar executablePath para que use el Chrome bundled de puppeteer
        dataPath = '/tmp/wa-session';
    } else {
        // Configuración para Local (tu Mac)
        console.log('Usando configuración para Mac local...');
        puppeteerOptions.executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        dataPath = 'wa-session';
    }

    // --- Creación del cliente de WhatsApp ---
    client = new Client({
        authStrategy: new LocalAuth({ dataPath: dataPath }),
        puppeteer: puppeteerOptions
    });

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
        // Reintentar conexión después de 5 segundos
        setTimeout(() => {
            client.initialize();
        }, 5000);
    });

    client.on('auth_failure', (msg) => {
        console.error('❌ Fallo de autenticación:', msg);
        isReady = false;
    });

    // Inicializar el cliente con manejo de errores
    try {
        client.initialize();
    } catch (error) {
        console.error('❌ Error al inicializar WhatsApp:', error);
    }
} else {
    console.log('⚠️ WhatsApp desactivado por variable de entorno ENABLE_WHATSAPP=false');
}

// --- 5. RUTAS DE LA API ---

// Tus rutas existentes
const otrasRutas = require('./routes/rutas');
app.use('/', otrasRutas);

// Ruta para verificar el estado del bot
app.get('/whatsapp-status', (req, res) => {
    if (process.env.ENABLE_WHATSAPP === 'false') {
        return res.json({ 
            enabled: false, 
            ready: false, 
            message: 'WhatsApp está desactivado por configuración' 
        });
    }
    
    res.json({ 
        enabled: true, 
        ready: isReady, 
        message: isReady ? 'Bot conectado y listo' : 'Bot no está listo aún' 
    });
});

// Ruta para enviar mensajes con el bot
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    console.log(`Petición de WhatsApp recibida para enviar a: ${number}`);
    
    // Verificar si WhatsApp está habilitado
    if (process.env.ENABLE_WHATSAPP === 'false') {
        return res.status(503).json({ 
            success: false, 
            error: 'WhatsApp está desactivado en este entorno' 
        });
    }
    
    // Verificar si el cliente está listo
    if (!client || !isReady) {
        return res.status(503).json({ 
            success: false, 
            error: 'El bot no está listo todavía. Intenta más tarde.' 
        });
    }
    
    // Validar parámetros
    if (!number || !message) {
        return res.status(400).json({ 
            success: false, 
            error: 'Faltan los parámetros "number" o "message".' 
        });
    }
    
    try {
        const chatId = `549${number}@c.us`;
        await client.sendMessage(chatId, message);
        console.log(`📤 Mensaje de WhatsApp enviado exitosamente a ${number}`);
        res.status(200).json({ 
            success: true, 
            message: `Mensaje enviado a ${number}` 
        });
    } catch (error) {
        console.error(`❌ Error al enviar mensaje de WhatsApp a ${number}:`, error);
        res.status(500).json({ 
            success: false, 
            error: 'Error interno al procesar el envío.' 
        });
    }
});

// Ruta de salud general
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        whatsapp_enabled: process.env.ENABLE_WHATSAPP !== 'false',
        whatsapp_ready: isReady
    });
});

// --- 6. MANEJO DE ERRORES GLOBALES ---
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// --- 7. INICIAR SERVIDOR ---
const PORT = process.env.PORT || 30003;
app.listen(PORT, () => {
    console.log(`🚀 Servidor API unificado escuchando en el puerto ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📱 WhatsApp: ${process.env.ENABLE_WHATSAPP !== 'false' ? 'Habilitado' : 'Deshabilitado'}`);
});