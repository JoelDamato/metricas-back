const MetricasCliente = require('../models/metricascliente.js'); // Asegurate que la ruta sea correcta

exports.getMetricasCliente = async (req, res) => {
  try {
    const metricas = await MetricasCliente.find(); // Podés agregar filtros si querés
    res.status(200).json(metricas);
  } catch (error) {
    console.error('❌ Error al obtener las métricas:', error);
    res.status(500).json({ error: 'Error al obtener las métricas' });
  }
};
