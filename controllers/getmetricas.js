const Metricas = require('../models/metricasdata');
const { performance } = require('perf_hooks');

exports.getAllData = async (req, res) => {
  try {

    console.log("🚀 Iniciando consulta por Flagllamadas...");
    const inicio = performance.now();

    const proyeccion = {
      "Fecha correspondiente": 1,
      "Responsable": 1,
      "Venta Meg": 1,
      "Cash collected total": 1,
      "Origen": 1,
      "Agenda": 1,
      "Precio": 1,
      "Aplica?": 1,
      "Llamadas efectuadas": 1,
      "Nombre cliente": 1,
      "Venta Club": 1,
      "Call Confirm Exitoso": 1,
      "Fecha de agendamiento": 1,
      "id": 1
    };
    const metricas = await Metricas.find({ Flagllamadas: true }, proyeccion)
    .hint({ Flagllamadas: 1 }) // 👈 Forzamos uso del índice
    .lean();
  
    const fin = performance.now();
    const duracion = ((fin - inicio) / 1000).toFixed(2);

    console.log(`✅ Consulta completada: ${metricas.length} documentos en ${duracion}s`);
    res.status(200).json(metricas);
  } catch (error) {
    console.error('❌ Error al obtener las métricas:', error);
    res.status(500).json({ message: 'Error al obtener las métricas' });
  }
};
