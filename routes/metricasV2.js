const express = require('express');
const controller = require('../modules/metricasv2/controllers/metricas.controller');
const authController = require('../modules/metricasv2/controllers/auth.controller');

const router = express.Router();

router.get('/auth/session', authController.session);
router.post('/auth/login', authController.login);
router.post('/auth/logout', authController.logout);
router.get('/health', controller.health);
router.get('/views', controller.getResources);
router.get('/views/:resource', controller.getResourceRows);
router.get('/kpi-closers/rules', controller.getKpiCloserRules);
router.post('/kpi-closers/rules', controller.saveKpiCloserRules);
router.get('/marketing/inversion', controller.getMarketingInvestment);
router.post('/marketing/inversion', controller.saveMarketingInvestment);
router.get('/marketing/aov-dia-1', controller.getMarketingAovDia1);
router.get('/marketing/ventas-totales', controller.getMarketingVentasTotales);
router.post('/assistant/ask', controller.askAssistant);

module.exports = router;
