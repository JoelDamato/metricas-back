// routes/notionRoutes.js
const express = require('express');
const router = express.Router();// Cambié la referencia de "estatico" a "notionController"

const webhookController3 = require('../controllers/webhooknuevoSheets.js');
const webhookController4 = require('../controllers/webhooksheets2.js');
const webhookController5 = require('../controllers/webhookcsm.js');
const webhookController6 = require('../controllers/webhookcom.js');
const webhookDistribuidor = require('../controllers/webhookDistribuidor.js');
const metricasController = require('../modules/metricasv2/controllers/metricas.controller');
const contactStatusController = require('../controllers/contactStatus');

/*Sheets*/
router.post('/webhook3', webhookController3.handleWebhook);
router.post('/webhookv2', webhookController4.handleWebhook);
router.post('/csm', webhookController5.handleWebhook);
router.post('/comprobantes', webhookController6.handleWebhook);
router.post('/distribuidor', webhookDistribuidor.handleWebhook);
router.get('/distribuidor/last-verification', webhookDistribuidor.getLastVerification);
router.get('/contacto-estado/:ghlId?', contactStatusController.getContactStatus);

// Compatibilidad: reglas KPI Closers vía router principal /api
router.get('/metricas/kpi-closers/rules', metricasController.getKpiCloserRules);
router.post('/metricas/kpi-closers/rules', metricasController.saveKpiCloserRules);
router.get('/kpi-closers/rules', metricasController.getKpiCloserRules);
router.post('/kpi-closers/rules', metricasController.saveKpiCloserRules);

module.exports = router;
