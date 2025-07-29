const Metricas = require('../models/metricasdata'); // Asegúrate de que la ruta sea correcta

exports.getAllData = async (req, res) => {
  try {
    console.log("Iniciando análisis de consulta con explain...");

    const metricas = await Metricas.find(
      { "Venta Meg": { $gt: 0 } } // 🔥 Filtra por "Venta Meg"
    )
    .hint({ "Venta Meg": 1 }) // 🚀 Usa el índice para acelerar la consulta
    .lean();
    

    console.log("Detalles de ejecución de la consulta:", JSON.stringify(metricas, null, 2));

    res.status(200).json(metricas);
  } catch (error) {
    console.error('Error al obtener las métricas:', error);
    res.status(500).json({ message: 'Error al obtener las métricas' });
  }
};
