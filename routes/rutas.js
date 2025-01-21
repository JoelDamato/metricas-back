// routes/notionRoutes.js
const express = require('express');
const router = express.Router();// Cambié la referencia de "estatico" a "notionController"
const webhookController = require('../controllers/webhookController');
const webhookController = require('../controllers/webhookcliente');
const mongoDataController = require('../controllers/getmongo');

// Ruta para obtener todos los documentos
router.get('/data', mongoDataController.getAllData);
router.post('/webhook', webhookController.handleWebhook);
router.post('/webhook/cliente', webhookController.handleWebhook);


module.exports = router;
