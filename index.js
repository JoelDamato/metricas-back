// index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // Middleware para manejar JSON

// Importar rutas de Notion
const notionRoutes = require('./routes/rutas');
app.use('/', notionRoutes); // Usar las rutas de Notion en el prefijo "/notion"

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
