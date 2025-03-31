// routes/notionRoutes.js
const express = require('express');
const router = express.Router();// Cambié la referencia de "estatico" a "notionController"
const webhookController = require('../controllers/webhookController');
const getclientmes = require('../controllers/getllamadas');
const metricasController = require('../controllers/getmetricas');
const getdashboard = require ('../controllers/getdashboard')
const { updateMonthlyGoal, getMonthlyGoals } = require("../controllers/postmetricas");
const updateObjetivoCloser = require("../controllers/postObjetivoCloser");
const  getObjetivosCloser  = require("../controllers/getObjetivoMensual");
const { calcularComisiones } = require('../controllers/comisionController');
module.exports = router;
/*---------------*/


router.post("/update-goal", updateMonthlyGoal);
router.get("/goals", getMonthlyGoals);
router.get('/metricas', metricasController.getAllData);
router.get('/llamadas', getclientmes.getAllData);
router.get('/dashboard', getdashboard.getAllData);
router.post('/update-objetivo-closer', updateObjetivoCloser.updateObjetivoCloser);
router.get('/objetivos-closer', getObjetivosCloser.getObjetivosCloser);
router.get('/comisiones-meg', calcularComisiones);
/*--------------*/

router.post('/webhook', webhookController.handleWebhook);



module.exports = router;
