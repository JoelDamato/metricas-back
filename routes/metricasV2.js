const express = require('express');
const controller = require('../modules/metricasv2/controllers/metricas.controller');

const router = express.Router();

router.get('/health', controller.health);
router.get('/views', controller.getResources);
router.get('/views/:resource', controller.getResourceRows);
router.get('/kpi-closers/rules', controller.getKpiCloserRules);
router.post('/kpi-closers/rules', controller.saveKpiCloserRules);

module.exports = router;
