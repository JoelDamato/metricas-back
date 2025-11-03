// routes/notionRoutes.js
const express = require('express');
const router = express.Router();// Cambié la referencia de "estatico" a "notionController"

const webhookController3 = require('../controllers/webhooknuevoSheets.js');
const webhookController4 = require('../controllers/webhooksheets2.js');
const webhookController5 = require('../controllers/webhookcsm.js');
const webhookController6 = require('../controllers/webhookcom.js');
const webhookDistribuidor = require('../controllers/webhookDistribuidor.js');

/*Sheets*/
router.post('/webhook3', webhookController3.handleWebhook);
router.post('/webhookv2', webhookController4.handleWebhook);
router.post('/csm', webhookController5.handleWebhook);
router.post('/comprobantes', webhookController6.handleWebhook);
router.post('/distribuidor', webhookDistribuidor.handleWebhook);



module.exports = router;
