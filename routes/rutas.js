// routes/notionRoutes.js
const express = require('express');
const router = express.Router();// Cambié la referencia de "estatico" a "notionController"

const webhookController3 = require('../controllers/webhooknuevoSheets.js');
const webhookNotionController = require('../controllers/webhookNotionController.js');

/*Sheets*/
router.post('/webhook3', webhookController3.handleWebhook);
router.post('/webhookNotion', webhookNotionController.handleWebhook);



module.exports = router;
