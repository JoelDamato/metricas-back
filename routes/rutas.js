// routes/notionRoutes.js
const express = require('express');
const router = express.Router();// Cambié la referencia de "estatico" a "notionController"
const webhookController = require('../controllers/webhookController');
const webhook = require('../controllers/webhookcliente');
const mongoDataController = require('../controllers/getmongo');
const mongoData = require('../controllers/getclient');

const getclientmes = require('../controllers/getclientmes');

// Ruta para obtener todos los documentos
router.get('/data', mongoDataController.getAllData);
router.get('/data-mes', getclientmes.getAllData);
router.get('/data/cliente', mongoData.getAllData);
router.post('/webhook', webhookController.handleWebhook);
router.post('/webhook/cliente', webhook.handleWebhook);


module.exports = router;
