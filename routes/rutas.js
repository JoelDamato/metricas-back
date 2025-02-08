// routes/notionRoutes.js
const express = require('express');
const router = express.Router();// Cambié la referencia de "estatico" a "notionController"
const webhookController = require('../controllers/webhookController');

const mongoDataController = require('../controllers/getmongo.js');


const getclientmes = require('../controllers/getclientmes');


const metricasController = require('../controllers/getmetricas');


router.get('/metricas', metricasController.getAllData);

// Ruta para obtener todos los documentos
router.get('/data', mongoDataController.getAllData);

router.get('/data-mes', getclientmes.getAllData);


router.post('/webhook', webhookController.handleWebhook);



module.exports = router;
