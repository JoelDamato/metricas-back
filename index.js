const express = require('express');
const cors = require('cors');
const compression = require('compression'); // ✅ importás acá
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 30003;

// Middleware
app.use(cors());
app.use(compression()); // ✅ activás compresión GZIP
app.use(express.json()); // Para recibir JSON

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(async () => {
  console.log('Conexión a MongoDB exitosa');

  const Metricas = require('./models/metricasdata');

  const indicesAcrear = [
    { "Venta Meg": 1 },
    { "Venta Club": 1 },
    { "Llamadas efectuadas": 1 },
    { "Agenda": 1 },
    { "Cash collected total": 1 },
    { "Facturación": 1 },
    { "Flagllamadas": 1 }
  ];

  const existentes = await Metricas.collection.indexes();
  const clavesExistentes = existentes.map(index => JSON.stringify(index.key));

  for (const indice of indicesAcrear) {
    const clave = JSON.stringify(indice);
    if (!clavesExistentes.includes(clave)) {
      console.log(`Creando índice en ${clave}...`);
      await Metricas.collection.createIndex(indice);
      console.log(`Índice en ${clave} creado correctamente`);
    } else {
      console.log(`El índice en ${clave} ya existe`);
    }
  }
})
.catch((err) => console.error('Error al conectar con MongoDB:', err));

// Rutas
const notionRoutes = require('./routes/rutas');
app.use('/', notionRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
