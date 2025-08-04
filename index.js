// index.js (Versión final y robusta para Local y Render)

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

// --- 4. RUTAS ---
const routes = require('./routes/rutas');
app.use('/api', routes);

// --- 5. INICIAR SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
