// routes/notionRoutes.js
const express = require('express');
const router = express.Router();// Cambié la referencia de "estatico" a "notionController"
const webhookController = require('../controllers/webhookController');
const webhookController2 = require('../controllers/webhookcliente');
const getclientmes = require('../controllers/getllamadas');
const metricasController = require('../controllers/getmetricas');
const getdashboard = require ('../controllers/getdashboard')
const { updateMonthlyGoal, getMonthlyGoals } = require("../controllers/postmetricas");
const updateObjetivoCloser = require("../controllers/postObjetivoCloser");
const  getObjetivosCloser  = require("../controllers/getObjetivoMensual");
const { getMetricasCliente } = require('../controllers/getclientes.js'); // Ajustá ruta
const { getVentasPorMesDeAgendamiento } = require('../controllers/getventas');
const { getVentasAgrupadas } = require('../controllers/getresumenventas');
const getclientmesclub = require('../controllers/getclub');
const { importarMetricasCliente } = require('../controllers/importarMetricasCliente');
const { importarMetricasdata } = require('../controllers/importarMetricasdata');
const { handlePrecioClub } = require("../controllers/getprice");
const webhookController3 = require('../controllers/webhooknuevoSheets.js');



module.exports = router;
/*---------------*/

router.get('/importar-metricascliente', async (req, res) => {
  try {
    const resultado = await importarMetricasCliente();
    res.status(200).json({ message: "Importación completada", ...resultado });
  } catch (error) {
    console.error("❌ Error en importación:", error);
    res.status(500).json({ error: "Error durante la importación", details: error.message });
  }
});
router.get('/importar-metricasdata', async (req, res) => {
  try {
    const resultado = await importarMetricasdata();
    res.status(200).json({ message: "Importación completada", ...resultado });
  } catch (error) {
    console.error("❌ Error en importación:", error);
    res.status(500).json({ error: "Error durante la importación", details: error.message });
  }
});


router.get('/resumen/ventas-agendadas-agrupadas', getVentasAgrupadas);
router.get('/resumen/ventas-agendadas', getVentasPorMesDeAgendamiento);
router.post("/update-goal", updateMonthlyGoal);
router.route("/precio-club").get(handlePrecioClub).post(handlePrecioClub);
router.get("/goals", getMonthlyGoals);
router.get('/metricas', metricasController.getAllData);
router.get('/llamadas', getclientmes.getAllData);
router.get('/club', getclientmesclub.getAllData);
router.get('/metricascliente', getMetricasCliente);
router.get('/dashboard', getdashboard.getAllData);
router.post('/update-objetivo-closer', updateObjetivoCloser.updateObjetivoCloser);
router.get('/objetivos-closer', getObjetivosCloser.getObjetivosCloser);



/*--------------*/

router.post('/webhook', webhookController.handleWebhook);
router.post('/webhook2', webhookController2.handleWebhook);


/*Sheets*/
router.post('/webhook3', webhookController3.handleWebhook);


module.exports = router;
