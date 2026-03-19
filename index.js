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

app.get('/metricas', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/metricas-v2/index.html'));
});
app.use('/metricas', express.static(path.join(__dirname, 'public/metricas-v2'), { index: false, redirect: false }));

app.use('/api', routes);
app.use('/api/metricas', metricasV2Routes);
app.use('/api/v2', metricasV2Routes);
app.use('/api/v2/metricas', metricasV2Routes);
app.use(metricasV2ErrorHandler);

// --- 5. INICIAR SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
