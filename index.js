// index.js - Versión de emergencia SIN WhatsApp para que funcione YA

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

console.log('🚀 Iniciando servidor sin WhatsApp...');

// --- 3. RUTAS DE LA API ---

// Tus rutas existentes
const otrasRutas = require('./routes/rutas');
app.use('/', otrasRutas);

// Ruta de salud
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        whatsapp_enabled: false,
        message: 'Servidor funcionando sin WhatsApp'
    });
});

// Mock de WhatsApp para no romper el frontend
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;
    console.log(`📱 Simulando envío de WhatsApp a ${number}: ${message}`);
    
    res.status(200).json({ 
        success: true, 
        message: `Mensaje simulado enviado a ${number}`,
        note: 'WhatsApp desactivado temporalmente'
    });
});

app.get('/whatsapp-status', (req, res) => {
    res.json({ 
        enabled: false, 
        ready: false, 
        message: 'WhatsApp desactivado temporalmente' 
    });
});

// --- 4. INICIAR SERVIDOR ---
const PORT = process.env.PORT || 30003;
app.listen(PORT, () => {
    console.log(`🚀 Servidor API funcionando en puerto ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⚠️  WhatsApp temporalmente desactivado`);
});