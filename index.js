const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 310003;

// Middleware
app.use(cors());
app.use(express.json()); // Middleware para manejar JSON

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)

.then(async () => {
    console.log('Conexión a MongoDB exitosa');

    // Obtener el modelo
    const Metricas = require('./models/metricasdata');

    // Verificar si el índice en "Venta Meg" ya existe
    const indices = await Metricas.collection.indexes();
    const indiceExistente = indices.some(index => index.key && index.key["Venta Meg"]);
    console.log("Índices existentes:", indices);
    if (!indiceExistente) {
        console.log('Creando índice en "Venta Meg"...');
        await Metricas.collection.createIndex({ "Venta Meg": 1 });
        console.log('Índice en "Venta Meg" creado correctamente');
    } else {
        console.log('El índice en "Venta Meg" ya existe');
    }
})
.catch((err) => console.error('Error al conectar con MongoDB:', err));

// Importar rutas de Notion
const notionRoutes = require('./routes/rutas');
app.use('/', notionRoutes);

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
