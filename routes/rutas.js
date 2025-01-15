// routes/notionRoutes.js
const express = require('express');
const router = express.Router();
const { getCallsDatas } = require('../controllers/ofertasganadas'); // Importa el controlador
const { getfactt } = require('../controllers/facturacionycash');
const { getCallsData } = require('../controllers/llamadas');
const { getInteractionsData } = require('../controllers/estatico'); // Cambié la referencia de "estatico" a "notionController"
const webhookController = require('../controllers/webhookController');
const mongoDataController = require('../controllers/getmongo');

// Ruta para obtener todos los documentos
router.get('/data', mongoDataController.getAllData);
router.get('/data/:id', mongoDataController.getDataById);
router.get('/notion-data', getCallsDatas);
router.get('/facturacion-cash', getfactt);
router.get('/llamadas', getCallsData);
router.get('/estatico', getInteractionsData);
router.post('/webhook', webhookController.handleWebhook);

module.exports = router;
