// index.js (Versión final y robusta para Local y Render)

// --- 1. IMPORTACIONES ---
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// --- 2. INICIAR SERVIDOR EXPRESS Y MIDDLEWARES ---
const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());

// --- 3. VARIABLES GLOBALES ---
let client = null;
let isReady = false;

// --- 4. RUTAS ---
const routes = require('./routes/rutas');
const metricasV2Routes = require('./routes/metricasV2');
const metricasV2ErrorHandler = require('./modules/metricasv2/errorHandler');
const authMiddleware = require('./modules/auth/middleware');

app.use(authMiddleware.attachAuthUser);

app.use('/contacto-estado', express.static(path.join(__dirname, 'public/contacto-estado'), { index: false, redirect: false }));
app.use('/metricas-assets', express.static(path.join(__dirname, 'public/metricas-v2/assets'), { index: false, redirect: false }));
app.get(['/contacto-estado', '/contacto-estado/:ghlId'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public/contacto-estado/index.html'));
});

app.get('/metricas', authMiddleware.metricasPageGuard, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/metricas-v2/index.html'));
});
app.use('/metricas', authMiddleware.metricasPageGuard, express.static(path.join(__dirname, 'public/metricas-v2'), { index: false, redirect: false }));

app.use('/api', routes);
app.use('/api/metricas', authMiddleware.metricasApiGuard, metricasV2Routes);
app.use('/api/v2', authMiddleware.metricasApiGuard, metricasV2Routes);
app.use('/api/v2/metricas', authMiddleware.metricasApiGuard, metricasV2Routes);
app.use(metricasV2ErrorHandler);
app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    ok: false,
    message: error.message || 'Error interno'
  });
});

// --- 5. INICIAR SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
