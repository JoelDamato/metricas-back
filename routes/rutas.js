// routes/notionRoutes.js
const express = require('express');
const router = express.Router();// Cambié la referencia de "estatico" a "notionController"
const webhookController = require('../controllers/webhookController');
const mongoDataController = require('../controllers/getmongo');

// Ruta para obtener todos los documentos
router.get('/data', mongoDataController.getAllData);
router.get('/data/:id', mongoDataController.getDataById);
router.post('/webhook', webhookController.handleWebhook);

module.exports = router;
