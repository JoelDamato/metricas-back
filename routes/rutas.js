// routes/notionRoutes.js
const express = require('express');
const router = express.Router();// Cambié la referencia de "estatico" a "notionController"

const webhookController3 = require('../controllers/webhooknuevoSheets.js');



/*Sheets*/
router.post('/webhook3', webhookController3.handleWebhook);


module.exports = router;
