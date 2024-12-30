// routes/notionRoutes.js
const express = require('express');
const router = express.Router();
const { getCallsDatas } = require('../controllers/ofertasganadas'); // Importa el controlador
const { getfactt } = require('../controllers/facturacionycash');
const { getCallsData } = require('../controllers/llamadas');
const { getInteractionsData } = require('../controllers/estatico'); // Cambié la referencia de "estatico" a "notionController"

// Define la ruta y enlaza al controlador
router.get('/notion-data', getCallsDatas);
router.get('/facturacion-cash', getfactt);
router.get('/llamadas', getCallsData);
router.get('/estatico', getInteractionsData);

module.exports = router;
